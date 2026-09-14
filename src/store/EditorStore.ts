// =============================================================================
// EditorStore.ts — Global application state (Zustand)
//
// RULE: This file owns STATE and ACTIONS only.
//       It imports all types from src/types/canvas.ts — never re-defines them.
//
// Why Zustand?
//   React's local useState is great for UI state that only one component needs
//   (e.g. "is this dropdown open?"). But activeTool, elements, and
//   selectedElementIds must be readable by Canvas, ToolDock, Inspector, and
//   StatusBar simultaneously. Zustand gives every component a direct,
//   subscription-based connection to shared state without prop-drilling.
// =============================================================================

import { create } from 'zustand'
import {
  type Tool,
  type CanvasElement,
  buildPathData,
} from '../types/canvas'

const ELEMENTS_STORAGE_KEY = 'vectorcraft-elements'
const AUTOSAVE_DELAY_MS = 400

function loadSavedElements(): CanvasElement[] {
  try {
    if (typeof window === 'undefined') return []

    const savedElements = window.localStorage.getItem(ELEMENTS_STORAGE_KEY)
    if (!savedElements) return []

    const parsedElements: unknown = JSON.parse(savedElements)
    return Array.isArray(parsedElements) ? parsedElements as CanvasElement[] : []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

/**
 * The viewport describes how the world-space artboard is displayed on screen.
 *
 *   zoom  — scale factor. 1.0 = 100%, 2.0 = 200% (zoomed in), 0.5 = 50%.
 *   panX  — horizontal offset in screen pixels (shifts the artboard right/left).
 *   panY  — vertical offset in screen pixels  (shifts the artboard up/down).
 *
 * How to read an element's screen position:
 *   screenX = element.transform.x * zoom + panX
 *   screenY = element.transform.y * zoom + panY
 */
export interface Viewport {
  zoom: number
  panX: number
  panY: number
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface EditorState {
  // ---- Tool ----
  activeTool: Tool

  // ---- Document ----
  /** All shapes on the canvas, in z-order (index 0 = bottom). */
  elements: CanvasElement[]
  past: CanvasElement[][]
  future: CanvasElement[][]

  // ---- Selection ----
  /** IDs of every currently selected element. Array supports multi-select later. */
  selectedElementIds: string[]

  // ---- Viewport ----
  viewport: Viewport

  // ---- Actions ----
  setActiveTool: (tool: Tool) => void

  addElement: (element: CanvasElement) => void
  updateElement: (id: string, changes: Partial<CanvasElement>, historyKey?: string) => void
  deleteElement: (id: string) => void

  /**
   * Move a single element to a new (x, y) position.
   * Only updates transform.x and transform.y — nothing else.
   */
  updateElementPosition: (id: string, x: number, y: number, historyKey?: string) => void
  resizeElement: (
    id: string,
    scaleX: number,
    scaleY: number,
    anchorPoint: { x: number; y: number },
    originalElement: CanvasElement,
    historyKey?: string
  ) => void

  undo: () => void
  redo: () => void

  selectElement: (id: string) => void
  clearSelection: () => void

  /**
   * Replace the entire viewport state in one atomic update.
   * Used by focal zoom (which must change zoom AND pan simultaneously)
   * and by pan (which only changes panX/panY).
   */
  setViewport: (viewport: Viewport) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEditorStore = create<EditorState>((set) => {
  let activeHistoryKey: string | null = null

  const cloneElements = (elements: CanvasElement[]) => elements.map((element) => ({
    ...element,
    transform: { ...element.transform },
    style: { ...element.style },
    points: element.points?.map((point) => ({
      ...point,
      ...(point.handleOut ? { handleOut: { ...point.handleOut } } : {}),
    })),
  }))

  const pushHistory = (state: EditorState, historyKey?: string) => {
    if (historyKey && historyKey === activeHistoryKey) {
      return { past: state.past, future: state.future }
    }

    activeHistoryKey = historyKey ?? null
    return {
      past: [...state.past, cloneElements(state.elements)].slice(-50),
      future: [],
    }
  }

  return ({

  // Default tool when app opens
  activeTool: 'select',

  // Restore the document only; undo history intentionally starts fresh.
  elements: loadSavedElements(),

  // Undo/redo snapshots
  past: [],
  future: [],

  // Nothing selected
  selectedElementIds: [],

  // Initial viewport: 100% zoom, artboard offset 40px from canvas edges
  viewport: { zoom: 1, panX: 40, panY: 40 },

  // ---- Tool actions ----

  setActiveTool: (tool) => set({ activeTool: tool }),

  // ---- Document actions ----

  /** Append a new element to the TOP of the z-stack (renders last = in front). */
  addElement: (element) =>
    set((state) => {
      const history = pushHistory(state)
      return {
        elements: [...state.elements, element],
        ...history,
      }
    }),

  updateElement: (id, changes, historyKey) =>
    set((state) => {
      const element = state.elements.find((item) => item.id === id)
      if (!element) return state

      const history = pushHistory(state, historyKey)
      return {
        elements: state.elements.map((item) =>
          item.id === id ? { ...item, ...changes } : item
        ),
        ...history,
      }
    }),

  deleteElement: (id) =>
    set((state) => {
      if (!state.elements.some((element) => element.id === id)) return state

      const history = pushHistory(state)
      return {
        elements: state.elements.filter((element) => element.id !== id),
        selectedElementIds: state.selectedElementIds.filter((selectedId) => selectedId !== id),
        ...history,
      }
    }),

  /**
   * Move a single element by updating only its transform.x and transform.y.
   *
   * Why map() instead of mutating directly?
   *   Zustand (and React) require IMMUTABLE state updates. We never modify
   *   an existing object — we produce a new one. map() returns a new array.
   *   The spread { ...el, transform: { ...el.transform, x, y } } creates a
   *   new element object with new transform, leaving the old one untouched.
   */
  updateElementPosition: (id, x, y, historyKey) =>
    set((state) => {
      const history = pushHistory(state, historyKey)
      return {
        elements: state.elements.map((el) => {
        if (el.id !== id) return el

        const deltaX = x - el.transform.x
        const deltaY = y - el.transform.y
        const nextElement = {
          ...el,
          transform: { ...el.transform, x, y },
        }

        if (el.type !== 'line') return nextElement

        return {
          ...nextElement,
          x1: (el.x1 ?? 0) + deltaX,
          y1: (el.y1 ?? 0) + deltaY,
          x2: (el.x2 ?? 0) + deltaX,
          y2: (el.y2 ?? 0) + deltaY,
        }
        }),
        ...history,
      }
    }),

  resizeElement: (id, scaleX, scaleY, anchorPoint, originalElement, historyKey) =>
    set((state) => {
      const history = pushHistory(state, historyKey)
      return {
        elements: state.elements.map((el) => {
        if (el.id !== id) return el

        const scalePoint = (value: number, anchor: number, scale: number) =>
          anchor + (value - anchor) * scale
        const nextTransform = {
          ...originalElement.transform,
          x: scalePoint(originalElement.transform.x, anchorPoint.x, scaleX),
          y: scalePoint(originalElement.transform.y, anchorPoint.y, scaleY),
          width: originalElement.transform.width * scaleX,
          height: originalElement.transform.height * scaleY,
        }
        const nextElement = { ...el, transform: nextTransform }

        if (originalElement.type === 'line') {
          return {
            ...nextElement,
            x1: scalePoint(originalElement.x1 ?? 0, anchorPoint.x, scaleX),
            y1: scalePoint(originalElement.y1 ?? 0, anchorPoint.y, scaleY),
            x2: scalePoint(originalElement.x2 ?? 0, anchorPoint.x, scaleX),
            y2: scalePoint(originalElement.y2 ?? 0, anchorPoint.y, scaleY),
          }
        }

        if (originalElement.points) {
          const points = originalElement.points.map((point) => ({
            x: scalePoint(point.x, anchorPoint.x, scaleX),
            y: scalePoint(point.y, anchorPoint.y, scaleY),
            ...(point.handleOut
              ? {
                  handleOut: {
                    x: scalePoint(point.handleOut.x, anchorPoint.x, scaleX),
                    y: scalePoint(point.handleOut.y, anchorPoint.y, scaleY),
                  },
                }
              : {}),
          }))

          return {
            ...nextElement,
            points,
            ...(originalElement.type === 'path'
              ? { pathData: buildPathData(points) }
              : {}),
          }
        }

        return nextElement
        }),
        ...history,
      }
    }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state
      activeHistoryKey = null
      const past = [...state.past]
      const previousElements = past.pop()!
      return {
        elements: cloneElements(previousElements),
        past,
        future: [cloneElements(state.elements), ...state.future],
      }
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state
      activeHistoryKey = null
      const future = [...state.future]
      const nextElements = future.shift()!
      return {
        elements: cloneElements(nextElements),
        past: [...state.past, cloneElements(state.elements)].slice(-50),
        future,
      }
    }),

  // ---- Selection actions ----

  /** Select exactly one element (replaces any existing selection). */
  selectElement: (id) => set({ selectedElementIds: [id] }),

  /** Deselect everything. */
  clearSelection: () => set({ selectedElementIds: [] }),

  /** Replace the entire viewport (zoom + pan) atomically. */
  setViewport: (viewport) => set({ viewport }),
  })
})

let autosaveTimer: ReturnType<typeof setTimeout> | undefined

useEditorStore.subscribe((state, previousState) => {
  if (state.elements === previousState.elements) return

  if (autosaveTimer !== undefined) clearTimeout(autosaveTimer)

  autosaveTimer = setTimeout(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ELEMENTS_STORAGE_KEY, JSON.stringify(state.elements))
      }
    } catch {
      // Ignore storage failures so editing remains usable.
    }
  }, AUTOSAVE_DELAY_MS)
})