// =============================================================================
// usePencilTool.ts — Freehand pencil drawing
//
// Records pointer positions while the button is held down, then commits a
// smoothed SVG path (Catmull-Rom → cubic Bézier) as a regular `path`
// CanvasElement — so selection, movement, styling, undo/redo and SVG export
// all work through the EXISTING architecture with no special cases.
//
// Responsiveness strategy:
//   - Samples are dropped unless the pointer moved ≥ MIN_SAMPLE_DISTANCE
//     world units, so slow/fast drawing both record sensible detail.
//   - The raw stream is decimated live when it exceeds MAX_SAMPLE_POINTS,
//     so a long stroke can never explode into thousands of anchors.
//   - Raw points live in a ref (no re-render per sample); React state only
//     mirrors them for the live preview.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { createPathElement } from '../types/canvas'
import { toWorldPoint } from '../geometry/coordinates'
import { smoothPointStream, thinPoints, type Point } from '../geometry/smoothing'

/** Minimum world distance between recorded samples. */
const MIN_SAMPLE_DISTANCE = 2
/** Hard cap on recorded samples — the stream decimates itself past this. */
const MAX_SAMPLE_POINTS = 800
/** Total stroke length required to produce an element. */
const MIN_STROKE_DISTANCE = 6
/** Anchor cap handed to the final smoothing pass. */
const MAX_SMOOTH_POINTS = 500

export function usePencilTool(
  svgRef: React.RefObject<SVGSVGElement | null>
) {
  const addElement = useEditorStore((state) => state.addElement)
  const activeTool = useEditorStore((state) => state.activeTool)

  // Source of truth during a stroke (refs — no re-render per sample).
  const rawPointsRef = useRef<Point[]>([])
  const distanceRef = useRef(0)
  // Mirror of rawPointsRef for the live preview (React state).
  const [points, setPoints] = useState<Point[]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  const getPoint = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const { zoom, panX, panY } = useEditorStore.getState().viewport
      // NOTE: deliberately NOT snapped — freehand strokes stay freehand.
      return toWorldPoint(e.clientX, e.clientY, svg, zoom, panX, panY)
    },
    [svgRef]
  )

  /** Append a sample, decimating the stream if it grows past the cap. */
  const appendSample = useCallback((point: Point) => {
    let raw = rawPointsRef.current
    const last = raw[raw.length - 1]
    if (last) {
      const dx = point.x - last.x
      const dy = point.y - last.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < MIN_SAMPLE_DISTANCE) return
      distanceRef.current += distance
      raw = [...raw, point]
    } else {
      raw = [point]
    }

    // Keep the recorded stream bounded while the user is still drawing.
    if (raw.length > MAX_SAMPLE_POINTS) {
      raw = thinPoints(raw, MIN_SAMPLE_DISTANCE * 2)
      // If the pointer hovered in place so densely that one pass is not
      // enough, tighten until it fits (same approach as smoothPointStream).
      let multiplier = 2
      let guard = 0
      while (raw.length > MAX_SAMPLE_POINTS && guard < 32) {
        multiplier *= 1.5
        raw = thinPoints(raw, MIN_SAMPLE_DISTANCE * multiplier)
        guard++
      }
    }

    rawPointsRef.current = raw
    setPoints(raw)
  }, [])

  const onMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return
      const point = getPoint(e)
      rawPointsRef.current = [point]
      distanceRef.current = 0
      setPoints([point])
      setIsDrawing(true)
    },
    [getPoint]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isDrawing) return
      appendSample(getPoint(e))
    },
    [isDrawing, appendSample, getPoint]
  )

  /** Commit the stroke as a path element (called on mouse release). */
  const commit = useCallback(() => {
    const raw = rawPointsRef.current
    if (raw.length >= 2 && distanceRef.current >= MIN_STROKE_DISTANCE) {
      const smoothed = smoothPointStream(raw, {
        minDistance: MIN_SAMPLE_DISTANCE * 1.5,
        maxPoints: MAX_SMOOTH_POINTS,
      })
      addElement({ ...createPathElement(smoothed), name: 'Pencil' })
    }
    rawPointsRef.current = []
    distanceRef.current = 0
    setPoints([])
    setIsDrawing(false)
  }, [addElement])

  /** Abandon the current stroke without creating an element. */
  const cancel = useCallback(() => {
    rawPointsRef.current = []
    distanceRef.current = 0
    setPoints([])
    setIsDrawing(false)
  }, [])

  const onMouseUp = useCallback(() => {
    if (isDrawing) commit()
  }, [isDrawing, commit])

  // Switching tools mid-stroke abandons it (same contract as pen/polyline).
  useEffect(() => {
    if (activeTool !== 'pencil' && isDrawing) {
      queueMicrotask(() => cancel())
    }
  }, [activeTool, cancel, isDrawing])

  return {
    points,
    isDrawing,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    commit,
    cancel,
  }
}