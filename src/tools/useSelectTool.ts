// =============================================================================
// useSelectTool.ts — Select tool pointer logic
//
// This is a CUSTOM HOOK. Custom hooks are plain functions whose name starts
// with "use". They can call useState, useRef, useEffect, and other hooks
// internally. Components call them and get back values or handlers.
//
// WHY a separate file?
//   Canvas.tsx is responsible for rendering and event routing.
//   This file is responsible for what the Select tool *does* with those events.
//   Separating them means Canvas stays thin, and each tool's logic is isolated.
//
// DATA FLOW:
//   Canvas gives us:  svgRef (so we can convert screen → SVG coordinates)
//   We give Canvas:   event handlers to attach to SVG and shape elements
//   We read from:     useEditorStore.getState() inside event handlers
//   We write to:      selectElement, toggleSelectElement, selectElements,
//                     clearSelection, moveElements
//
// SELECTION MODEL:
//   - Click on a shape         → selects it (replaces the selection)
//   - Shift-click on a shape   → toggles it in / out of the selection
//   - Drag on a selected shape → moves the WHOLE selection together
//   - Drag on an unselected shape → moves just that shape (legacy behaviour)
//   - Drag on empty canvas     → marquee (rubber-band) selection; Shift unions
//   - Click on empty canvas    → clears the selection (Shift-click keeps it)
//
// All geometry lives in WORLD space, so every interaction works identically
// at any zoom / pan setting (screen → world conversion happens once per event).
// =============================================================================

import { useCallback, useRef, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { toWorldPoint } from '../geometry/coordinates'
import {
  boxesIntersect,
  getElementBounds,
  getRotatedAABB,
  unionBounds,
  type Bounds,
} from '../geometry/bounds'
import {
  collectSnapLines,
  snapMoveWithGuides,
  type MoveSnapHeld,
  type SmartGuide,
  type SnapLine,
} from '../geometry/snapping'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How many SCREEN pixels the mouse must travel from mousedown before we
 * treat the gesture as a DRAG rather than a CLICK.
 *
 * Converted to world units per event (threshold / zoom) so the feel is
 * identical at every zoom level.
 */
const SCREEN_DRAG_THRESHOLD = 3

// ---------------------------------------------------------------------------
// Internal types (private to this module)
// ---------------------------------------------------------------------------

/**
 * The state we need to track during an active drag gesture.
 *
 * We store it in a useRef, NOT useState. Why?
 *   - useRef changes do NOT trigger re-renders.
 *   - During a drag we update this on every mousemove (60fps).
 *   - We do NOT want React to re-render the whole component 60 times per second
 *     just to update bookkeeping numbers the user never sees.
 *   - The shapes' visual position updates via Zustand (moveElements), which
 *     DOES trigger a re-render — but only for the coordinate numbers we
 *     actually need to paint. The marquee rectangle is the one exception:
 *     it IS user-visible, so it lives in useState.
 */
interface ElementDrag {
  kind: 'element'
  /** Which element the user pressed on */
  elementId: string
  /**
   * Every element that will move together. Captured at mousedown:
   * the full selection if the pressed element is part of it, otherwise
   * just the pressed element.
   */
  dragIds: string[]
  /** World coordinate where the mouse was when the user pressed down */
  mouseStartX: number
  mouseStartY: number
  /** Total delta already applied to the store (moves are applied incrementally) */
  appliedDeltaX: number
  appliedDeltaY: number
  /** Shift state captured at mousedown (may differ by mouseup) */
  shiftKey: boolean
  /**
   * Union AABB of the ENTIRE moving selection at drag start (rotation-aware).
   * The group aligns like a single object: its edges/centres are the union's.
   */
  startBounds: Bounds
  /** Snap targets captured at drag start (moving shapes excluded). */
  snapLines: SnapLine[]
  /** Object targets locked on the previous sample (anti-jitter hysteresis). */
  held: MoveSnapHeld
  /**
   * Has the mouse moved far enough past the threshold to count as a real drag?
   * Starts false. Becomes true the first time the mouse moves past the
   * threshold. If still false at mouseup → it was a click → select/toggle.
   */
  hasMoved: boolean
  historyKey: string
}

interface MarqueeDrag {
  kind: 'marquee'
  startWorldX: number
  startWorldY: number
  hasMoved: boolean
  shiftKey: boolean
}

type DragState = ElementDrag | MarqueeDrag

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a normalised (positive width/height) rectangle from two corner points. */
function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Bounds {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  }
}

/**
 * Value-equality for smart guide arrays so React bails out of re-renders
 * when consecutive drag samples produce identical guides.
 */
function sameGuides(a: SmartGuide[] | null, b: SmartGuide[] | null): boolean {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((guide, index) => {
    const other = b[index]
    return (
      guide.axis === other.axis &&
      Math.abs(guide.value - other.value) < 1e-6 &&
      Math.abs(guide.start - other.start) < 1e-6 &&
      Math.abs(guide.end - other.end) < 1e-6
    )
  })
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useSelectTool
 *
 * Accepts a ref to the SVG element (so it can convert client coordinates to
 * SVG logical coordinates) and the map of rendered SVG nodes (so text bounds
 * are measured accurately during marquee hit-testing).
 *
 * Returns the handlers Canvas.tsx wires to its SVG and shape elements, plus
 * the current marquee rectangle (null when no marquee is being dragged) so
 * Canvas can render the visible selection rectangle.
 */
export function useSelectTool(
  svgRef: React.RefObject<SVGSVGElement | null>,
  renderedElements?: Record<string, SVGGraphicsElement | null>
) {
  // ---- Zustand write actions ----
  // We only grab ACTIONS here, not state values.
  // Actions are stable function references — they never change between renders,
  // so subscribing to them does not cause re-renders.
  const selectElement         = useEditorStore((s) => s.selectElement)
  const selectElements        = useEditorStore((s) => s.selectElements)
  const toggleSelectElement   = useEditorStore((s) => s.toggleSelectElement)
  const clearSelection        = useEditorStore((s) => s.clearSelection)
  const moveElements          = useEditorStore((s) => s.moveElements)

  // ---- Drag state ----
  // useRef — invisible to React's render cycle. Mutating .current never re-renders.
  const dragRef = useRef<DragState | null>(null)

  // ---- Marquee (visible while dragging — this IS user-facing UI) ----
  const [marquee, setMarquee] = useState<Bounds | null>(null)
  // Mirrors `marquee` synchronously so mouseup can read the final rectangle
  // without waiting for a state update.
  const marqueeRectRef = useRef<Bounds | null>(null)

  // ---- Smart guides (Figma-style alignment lines, visible while dragging) ----
  // Null whenever no drag is active or nothing aligns — cleared synchronously
  // at every gesture boundary so guides never outlive the drag.
  const [smartGuides, setSmartGuides] = useState<SmartGuide[] | null>(null)
  const clearSmartGuides = useCallback(() => {
    setSmartGuides((current) => (current === null ? current : null))
  }, [])

  // Suppress the click-to-clear that follows a selection gesture (the
  // trailing SVG click would otherwise wipe the selection we just made).
  const suppressNextCanvasClickRef = useRef(false)

  // ---- SVG coordinate converter ----
  /**
   * Converts client (browser) coordinates into world space — the same space
   * every CanvasElement stores its geometry in.
   *
   * getScreenCTM() returns the browser's authoritative mapping from SVG user
   * units to screen pixels, including the viewBox scale factor and the
   * centring offset applied by preserveAspectRatio="xMidYMid meet". Inverting
   * it lands exactly on the user-space point beneath the cursor.
   *
   * This is deliberately the SAME conversion every other tool uses
   * (useRectTool, useEllipseTool, useLineTool, usePolylineTool, usePenTool,
   * useTextTool, useResizeTool, useRotateTool). Drawing a shape and dragging
   * a shape must agree on what "the point under the cursor" means — two
   * different transforms between those paths makes shapes desync from the
   * pointer for the whole drag.
   *
   * svgRef is read at event time (not subscribed), so the callback identity
   * stays stable for the duration of a drag.
   */
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const { zoom, panX, panY } = useEditorStore.getState().viewport
      return toWorldPoint(clientX, clientY, svg, zoom, panX, panY)
    },
    [svgRef]
  )

  /** World-space drag threshold for the current zoom (constant screen feel). */
  const worldThreshold = useCallback(() => {
    const { zoom } = useEditorStore.getState().viewport
    return SCREEN_DRAG_THRESHOLD / (zoom || 1)
  }, [])

  // ---- Handler: user presses mouse button on a shape ----
  /**
   * Called by Canvas when the user mousedowns on a rendered element.
   *
   * At this point we do NOT know if they want to click (select), shift-click
   * (toggle) or drag (move). We record the starting positions and wait to
   * see how the mouse moves.
   *
   * The set of elements that will move together (dragIds) is captured HERE:
   * if the pressed element already belongs to the selection, the whole
   * selection moves; otherwise only the pressed element moves.
   */
  const onElementMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      if (e.button !== 0) return
      e.stopPropagation()
      // New gesture — clear any stale suppression from a previous gesture
      // (a shape click may have stopped the trailing click before it ran).
      suppressNextCanvasClickRef.current = false
      clearSmartGuides()

      const state = useEditorStore.getState()
      const el = state.elements.find((item) => item.id === elementId)
      if (!el) return

      const pt = toWorld(e.clientX, e.clientY)

      const dragIds = state.selectedElementIds.includes(elementId)
        ? [...state.selectedElementIds]
        : [elementId]

      // The whole moving selection aligns as ONE object: union of every
      // member's rotation-aware AABB.
      const groupBounds = unionBounds(
        state.elements
          .filter((item) => dragIds.includes(item.id))
          .map((item) =>
            getRotatedAABB(
              getElementBounds(item, renderedElements?.[item.id]),
              item.transform.rotation ?? 0
            )
          )
      )

      dragRef.current = {
        kind: 'element',
        elementId,
        dragIds,
        mouseStartX: pt.x,
        mouseStartY: pt.y,
        appliedDeltaX: 0,
        appliedDeltaY: 0,
        shiftKey: e.shiftKey,
        // Snap targets are captured once per gesture; the moving shapes are
        // excluded so a shape never snaps to ITSELF (or its drag partners).
        startBounds: groupBounds,
        snapLines: collectSnapLines(state.elements, dragIds),
        held: { x: null, y: null },
        hasMoved: false,
        historyKey: crypto.randomUUID(),
      }
    },
    [toWorld, renderedElements, clearSmartGuides]
  )

  // ---- Handler: user presses mouse button on EMPTY canvas ----
  /**
   * Called by Canvas when the user mousedowns on the SVG background (no shape).
   * Starts a marquee (rubber-band) selection gesture.
   *
   * The existing selection is intentionally NOT cleared here — a click without
   * dragging clears it on click (onCanvasClick), and a marquee replaces (or,
   * with Shift, extends) it on mouseup.
   */
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return
      suppressNextCanvasClickRef.current = false
      clearSmartGuides()
      const pt = toWorld(e.clientX, e.clientY)
      dragRef.current = {
        kind: 'marquee',
        startWorldX: pt.x,
        startWorldY: pt.y,
        hasMoved: false,
        shiftKey: e.shiftKey,
      }
      marqueeRectRef.current = null
      setMarquee(null)
    },
    [toWorld, clearSmartGuides]
  )

  // ---- Handler: mouse moves across the SVG ----
  /**
   * Called by Canvas on every SVG mousemove.
   *
   * If an element drag is in progress, computes the delta from the start
   * position and moves the whole drag set in real time via Zustand.
   * If a marquee drag is in progress, updates the visible rectangle.
   */
  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const drag = dragRef.current
      if (!drag) return

      const pt = toWorld(e.clientX, e.clientY)
      const threshold = worldThreshold()

      if (drag.kind === 'marquee') {
        const deltaX = pt.x - drag.startWorldX
        const deltaY = pt.y - drag.startWorldY
        if (!drag.hasMoved && Math.sqrt(deltaX * deltaX + deltaY * deltaY) < threshold) return

        const rect = normalizeRect(drag.startWorldX, drag.startWorldY, pt.x, pt.y)
        dragRef.current = { ...drag, hasMoved: true }
        marqueeRectRef.current = rect
        setMarquee(rect)
        return
      }

      const deltaX = pt.x - drag.mouseStartX
      const deltaY = pt.y - drag.mouseStartY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      if (!drag.hasMoved && distance < threshold) return

      // Snap the TOTAL delta first (edges/centre of the dragged bounds align
      // to nearby objects and/or the grid), then apply only the INCREMENT
      // since the last sample so the store never double-counts a move.
      const { snapConfig, viewport } = useEditorStore.getState()
      const snapped = snapMoveWithGuides(
        drag.startBounds,
        deltaX,
        deltaY,
        drag.snapLines,
        snapConfig,
        viewport.zoom,
        { held: drag.held, movingIds: drag.dragIds }
      )

      const stepX = snapped.deltaX - drag.appliedDeltaX
      const stepY = snapped.deltaY - drag.appliedDeltaY

      dragRef.current = {
        ...drag,
        hasMoved: true,
        appliedDeltaX: snapped.deltaX,
        appliedDeltaY: snapped.deltaY,
        held: snapped.held,
      }

      // Update smart guides (bail out early if guides are identical to avoid
      // needless re-renders — sameGuides() does a value comparison).
      setSmartGuides((current) =>
        sameGuides(current, snapped.guides.length > 0 ? snapped.guides : null)
          ? current
          : snapped.guides.length > 0
            ? snapped.guides
            : null
      )

      if (stepX === 0 && stepY === 0) return
      moveElements(drag.dragIds, stepX, stepY, drag.historyKey)
    },
    [toWorld, worldThreshold, moveElements]
  )

  // ---- Handler: mouse button released ----
  /**
   * Resolves the gesture ambiguity:
   *
   * Element gesture:
   *   - hasMoved = false, no Shift → click → select the element
   *   - hasMoved = false, Shift     → shift-click → toggle in selection
   *   - hasMoved = true             → drag → positions already committed
   *
   * Marquee gesture:
   *   - hasMoved = true  → select every intersecting shape (Shift unions)
   *   - hasMoved = false → plain click (let onCanvasClick clear) or
   *                        Shift-click (suppress the clear, keep selection)
   */
  const onMouseUp = useCallback(() => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    clearSmartGuides()

    if (drag.kind === 'marquee') {
      if (drag.hasMoved) {
        const rect = marqueeRectRef.current
        const state = useEditorStore.getState()

        if (rect) {
          const hits = state.elements
            .filter((element) => element.visible && !element.locked)
            .filter((element) => {
              const bounds = getElementBounds(
                element,
                renderedElements?.[element.id]
              )
              const aabb = getRotatedAABB(bounds, element.transform.rotation ?? 0)
              return boxesIntersect(aabb, rect)
            })
            .map((element) => element.id)

          const nextIds = drag.shiftKey
            ? [...state.selectedElementIds, ...hits]
            : hits
          selectElements(nextIds)
        }

        // The upcoming SVG click must not wipe the selection we just made.
        suppressNextCanvasClickRef.current = true
      } else if (drag.shiftKey) {
        // Shift-click on empty canvas keeps the current selection.
        suppressNextCanvasClickRef.current = true
      }

      marqueeRectRef.current = null
      setMarquee(null)
      return
    }

    // Element gesture — both click and drag suppress the trailing SVG click:
    // a click has just set the selection, and a drag must never clear it.
    if (!drag.hasMoved) {
      if (drag.shiftKey) {
        toggleSelectElement(drag.elementId)
      } else {
        selectElement(drag.elementId)
      }
    }
    suppressNextCanvasClickRef.current = true
  }, [selectElement, selectElements, toggleSelectElement, renderedElements])

  // ---- Handler: click on empty canvas ----
  /**
   * Called by Canvas when the user clicks on the SVG background (no shape).
   * Clears the current selection.
   *
   * Why is this separate from onMouseUp?
   *   onMouseUp fires on the SVG for ALL clicks, including shape clicks.
   *   This handler is wired to onClick on the SVG, which only fires when the
   *   click target is the SVG itself — shapes call stopPropagation to prevent
   *   this from firing when they are clicked.
   *
   * After a marquee gesture, a shift-click, or a shape click/drag, the
   * trailing click is suppressed so it does not immediately clear the
   * selection that was just made.
   */
  const onCanvasClick = useCallback(() => {
    if (suppressNextCanvasClickRef.current) {
      suppressNextCanvasClickRef.current = false
      return
    }
    clearSelection()
  }, [clearSelection])

  // Return the handlers for Canvas to attach, plus the visible marquee rect and
  // the Figma-style smart guides (null when no drag is active or nothing aligns).
  return {
    onElementMouseDown,
    onCanvasMouseDown,
    onMouseMove,
    onMouseUp,
    onCanvasClick,
    marquee,
    smartGuides,
  }
}
