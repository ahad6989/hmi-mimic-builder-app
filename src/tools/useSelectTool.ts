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
//   We write to:      selectElement, clearSelection, updateElementPosition
// =============================================================================

import { useRef, useCallback } from 'react'
import { useEditorStore } from '../store/EditorStore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How many SVG logical units the mouse must travel from mousedown before we
 * treat the gesture as a DRAG rather than a CLICK.
 *
 * Without this, a tiny hand tremor while clicking would move the shape.
 */
const DRAG_THRESHOLD = 3

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
 *   - The shape's visual position updates via Zustand (updateElementPosition),
 *     which DOES trigger a re-render — but only for the coordinate numbers
 *     we actually need to paint.
 */
interface DragState {
  /** Which element is being dragged */
  elementId: string

  /** SVG coordinate where the mouse was when the user pressed down */
  mouseStartX: number
  mouseStartY: number

  /** Element's x, y position at the moment the drag started */
  elementStartX: number
  elementStartY: number

  /**
   * Has the mouse moved far enough past DRAG_THRESHOLD to count as a real drag?
   * Starts false. Becomes true the first time the mouse moves > DRAG_THRESHOLD units.
   * If still false at mouseup → it was a click, not a drag → select the element.
   */
  hasMoved: boolean

  historyKey: string
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useSelectTool
 *
 * Accepts a ref to the SVG element (so it can convert client coordinates to
 * SVG logical coordinates).
 *
 * Returns four handlers that Canvas.tsx wires to its SVG and shape elements.
 */
export function useSelectTool(
  svgRef: React.RefObject<SVGSVGElement | null>
) {
  // ---- Zustand write actions ----
  // We only grab ACTIONS here, not state values.
  // Actions are stable function references — they never change between renders,
  // so subscribing to them does not cause re-renders.
  const selectElement         = useEditorStore((s) => s.selectElement)
  const clearSelection        = useEditorStore((s) => s.clearSelection)
  const updateElementPosition = useEditorStore((s) => s.updateElementPosition)

  // ---- Drag state ----
  // useRef — invisible to React's render cycle. Mutating .current never re-renders.
  const dragRef = useRef<DragState | null>(null)

  // ---- SVG coordinate converter ----
  /**
   * Converts client (browser) coordinates into the SVG's user-space units —
   * the same space every CanvasElement stores its geometry in.
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

      const point = svg.createSVGPoint()
      point.x = clientX
      point.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }

      return point.matrixTransform(ctm.inverse())
    },
    [svgRef]
  )

  // ---- Handler: user presses mouse button on a shape ----
  /**
   * Called by Canvas when the user mousedowns on a rendered element.
   *
   * At this point we do NOT know if they want to click (select) or drag (move).
   * We record the starting positions and wait to see how the mouse moves.
   */
  const onElementMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation()

      const el = useEditorStore.getState().elements.find(
        (el) => el.id === elementId
      )
      if (!el) return

      const pt = toWorld(e.clientX, e.clientY)

      dragRef.current = {
        elementId,
        mouseStartX:   pt.x,
        mouseStartY:   pt.y,
        elementStartX: el.transform.x,
        elementStartY: el.transform.y,
        hasMoved:      false,
        historyKey:    crypto.randomUUID(),
      }
    },
    [toWorld]
  )

  // ---- Handler: mouse moves across the SVG ----
  /**
   * Called by Canvas on every SVG mousemove.
   *
   * If a drag is in progress, computes the delta from the start position
   * and moves the element in real time via Zustand.
   */
  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const drag = dragRef.current
      if (!drag) return

      const pt = toWorld(e.clientX, e.clientY)

      const deltaX = pt.x - drag.mouseStartX
      const deltaY = pt.y - drag.mouseStartY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      if (!drag.hasMoved && distance < DRAG_THRESHOLD) return

      if (!drag.hasMoved) {
        dragRef.current = { ...drag, hasMoved: true }
      }

      const newX = drag.elementStartX + deltaX
      const newY = drag.elementStartY + deltaY

      updateElementPosition(drag.elementId, newX, newY, drag.historyKey)
    },
    [toWorld, updateElementPosition]
  )

  // ---- Handler: mouse button released on the SVG ----
  /**
   * Called by Canvas on SVG mouseup.
   *
   * Resolves the gesture ambiguity:
   *   - hasMoved = true  → it was a drag → position already committed, just clean up
   *   - hasMoved = false → it was a click → select the element
   */
  const onMouseUp = useCallback(() => {
    const drag = dragRef.current
    if (!drag) return

    if (!drag.hasMoved) {
      // The user clicked without dragging → select this element
      selectElement(drag.elementId)
    }
    // If it was a real drag, the position is already live in Zustand.
    // Nothing extra to commit.

    // Always clean up
    dragRef.current = null
  }, [selectElement])

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
   */
  const onCanvasClick = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  // Return all four handlers for Canvas to attach
  return {
    onElementMouseDown,
    onMouseMove,
    onMouseUp,
    onCanvasClick,
  }
}
