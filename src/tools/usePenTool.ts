// =============================================================================
// usePenTool.ts — Pen tool (click-to-place bezier paths)
//
// INTERACTION MODEL
//   - Click empty canvas         → place an anchor (path stays open, keeps
//                                  accepting more anchors)
//   - Click again elsewhere      → another anchor; straight segments (L) are
//                                  implied between plain anchors
//   - Press & drag FROM an anchor→ pull symmetric tangent handles (out/in)
//                                  which produce real cubic C segments
//   - Mouse move (button released) → rubber-band preview of the next segment
//   - Enter / Double-click       → commit the path as a `path` element
//   - Escape / switch tool       → cancel without creating anything
//
// DATA
//   Reuses the existing PathPoint / buildPathData / createPathElement
//   structures — a committed pen path is an ordinary path CanvasElement, so
//   selection, movement, styling, undo/redo and SVG export need no changes.
//
// SNAPPING
//   Anchor placement snaps to grid / object edges & centres (zoom-scaled
//   tolerance) like every other drawing tool.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { createPathElement, type PathPoint } from '../types/canvas'
import { toWorldPoint } from '../geometry/coordinates'
import { snapPoint } from '../geometry/snapping'

/** Screen distance (px) within which a press is treated as "on the last anchor". */
const HANDLE_SNAP_RADIUS_PX = 8
/** Screen distance (px) a press must travel before it counts as a handle drag. */
const HANDLE_PULL_THRESHOLD_PX = 3

interface PenGesture {
  /** Index of the anchor the gesture started on. */
  anchorIndex: number
  /** World position where the press happened. */
  startX: number
  startY: number
  /** True once the pointer travelled past the pull threshold (handles updating). */
  pulling: boolean
}

export function usePenTool(
  svgRef: React.RefObject<SVGSVGElement | null>
) {
  const activeTool = useEditorStore((state) => state.activeTool)
  const addElement = useEditorStore((state) => state.addElement)

  const [points, setPoints] = useState<PathPoint[]>([])
  const [previewPoint, setPreviewPoint] = useState<PathPoint | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const gestureRef = useRef<PenGesture | null>(null)

  /** Raw world position with NO snapping — used for handle dragging. */
  const getRawPoint = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const { zoom, panX, panY } = useEditorStore.getState().viewport
      return toWorldPoint(e.clientX, e.clientY, svg, zoom, panX, panY)
    },
    [svgRef]
  )

  /** World position with grid / object snapping applied (for anchors). */
  const getSnappedPoint = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const state = useEditorStore.getState()
      const { zoom, panX, panY } = state.viewport
      const world = toWorldPoint(e.clientX, e.clientY, svg, zoom, panX, panY)
      return snapPoint(world, state.elements, state.snapConfig, zoom)
    },
    [svgRef]
  )

  /** Convert a screen-pixel distance to world units for the current zoom. */
  const worldRadius = useCallback((px: number) => {
    const { zoom } = useEditorStore.getState().viewport
    return px / (zoom > 0 ? zoom : 1)
  }, [])

  const commit = useCallback(() => {
    if (points.length >= 2) {
      addElement(createPathElement(points))
    }
    setPoints([])
    setPreviewPoint(null)
    setIsDrawing(false)
    gestureRef.current = null
  }, [addElement, points])

  const cancel = useCallback(() => {
    setPoints([])
    setPreviewPoint(null)
    setIsDrawing(false)
    gestureRef.current = null
  }, [])

  useEffect(() => {
    if (activeTool !== 'pen' && isDrawing) {
      queueMicrotask(() => cancel())
    }
  }, [activeTool, cancel, isDrawing])

  // ---- Press: place an anchor, or start pulling a tangent handle --------

  const onMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return

      const raw = getRawPoint(e)

      // Press near the LAST anchor → tangent-handle gesture (no new anchor).
      const lastIndex = points.length - 1
      if (lastIndex >= 0) {
        const last = points[lastIndex]
        const radius = worldRadius(HANDLE_SNAP_RADIUS_PX)
        const dx = raw.x - last.x
        const dy = raw.y - last.y
        if (Math.sqrt(dx * dx + dy * dy) <= radius) {
          gestureRef.current = {
            anchorIndex: lastIndex,
            startX: last.x,
            startY: last.y,
            pulling: false,
          }
          return
        }
      }

      // Otherwise: place a new (snapped) anchor. The press may turn into a
      // handle pull if the user keeps dragging — the gesture starts on the
      // anchor that was just placed, so click-drag creates curves naturally.
      const anchor = getSnappedPoint(e)
      const nextPoints = [...points, { x: anchor.x, y: anchor.y }]
      setPoints(nextPoints)
      setIsDrawing(true)
      setPreviewPoint({ x: anchor.x, y: anchor.y })
      gestureRef.current = {
        anchorIndex: nextPoints.length - 1,
        startX: anchor.x,
        startY: anchor.y,
        pulling: false,
      }
    },
    [getRawPoint, getSnappedPoint, points, worldRadius]
  )

  // ---- Move: rubber-band preview + handle dragging -----------------------

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const gesture = gestureRef.current

      // A press that travels past the threshold becomes a handle pull.
      if (gesture && !gesture.pulling) {
        const raw = getRawPoint(e)
        const dx = raw.x - gesture.startX
        const dy = raw.y - gesture.startY
        if (Math.sqrt(dx * dx + dy * dy) >= worldRadius(HANDLE_PULL_THRESHOLD_PX)) {
          gesture.pulling = true
        }
      }

      if (gesture?.pulling) {
        // Pull symmetric handles around the gesture's anchor: the cursor
        // position becomes handleOut; handleIn mirrors it (smooth tangent).
        const raw = getRawPoint(e)
        setPoints((current) => {
          const index = gesture.anchorIndex
          if (index < 0 || index >= current.length) return current
          const anchor = current[index]
          const next = [...current]
          next[index] = {
            ...anchor,
            handleOut: { x: raw.x, y: raw.y },
            handleIn: { x: 2 * anchor.x - raw.x, y: 2 * anchor.y - raw.y },
          }
          return next
        })
        setPreviewPoint({ x: raw.x, y: raw.y })
        return
      }

      if (!isDrawing) return
      const point = getSnappedPoint(e)
      setPreviewPoint({ x: point.x, y: point.y })
    },
    [getRawPoint, getSnappedPoint, isDrawing, worldRadius]
  )

  // ---- Release: ends the press gesture (path stays open) -----------------

  const onMouseUp = useCallback(() => {
    gestureRef.current = null
  }, [])

  const onCanvasClick = useCallback(() => {
    // Anchors are placed on mousedown; nothing to do on the trailing click.
  }, [])

  const onDoubleClick = useCallback(() => {
    commit()
  }, [commit])

  return {
    points,
    previewPoint,
    isDrawing,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onCanvasClick,
    onDoubleClick,
    commit,
    cancel,
  }
}
