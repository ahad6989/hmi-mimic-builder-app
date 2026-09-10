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
} from '../types/canvas'

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

  // ---- Selection ----
  /** IDs of every currently selected element. Array supports multi-select later. */
  selectedElementIds: string[]

  // ---- Viewport ----
  viewport: Viewport

  // ---- Actions ----
  setActiveTool: (tool: Tool) => void

  addElement: (element: CanvasElement) => void

  /**
   * Move a single element to a new (x, y) position.
   * Only updates transform.x and transform.y — nothing else.
   */
  updateElementPosition: (id: string, x: number, y: number) => void

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

export const useEditorStore = create<EditorState>((set) => ({

  // Default tool when app opens
  activeTool: 'select',

  // No shapes yet
  elements: [],

  // Nothing selected
  selectedElementIds: [],

  // Initial viewport: 100% zoom, artboard offset 40px from canvas edges
  viewport: { zoom: 1, panX: 40, panY: 40 },

  // ---- Tool actions ----

  setActiveTool: (tool) => set({ activeTool: tool }),

  // ---- Document actions ----

  /** Append a new element to the TOP of the z-stack (renders last = in front). */
  addElement: (element) =>
    set((state) => ({
      elements: [...state.elements, element],
    })),

  /**
   * Move a single element by updating only its transform.x and transform.y.
   *
   * Why map() instead of mutating directly?
   *   Zustand (and React) require IMMUTABLE state updates. We never modify
   *   an existing object — we produce a new one. map() returns a new array.
   *   The spread { ...el, transform: { ...el.transform, x, y } } creates a
   *   new element object with new transform, leaving the old one untouched.
   */
  updateElementPosition: (id, x, y) =>
    set((state) => ({
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
    })),

  // ---- Selection actions ----

  /** Select exactly one element (replaces any existing selection). */
  selectElement: (id) => set({ selectedElementIds: [id] }),

  /** Deselect everything. */
  clearSelection: () => set({ selectedElementIds: [] }),

  /** Replace the entire viewport (zoom + pan) atomically. */
  setViewport: (viewport) => set({ viewport }),
}))