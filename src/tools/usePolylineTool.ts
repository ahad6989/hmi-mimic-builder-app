import { useCallback, useEffect, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { createPolylineElement } from '../types/canvas'
import { toWorldPoint } from '../geometry/coordinates'
import { snapPoint } from '../geometry/snapping'

interface Point {
  x: number
  y: number
}

export function usePolylineTool(
  svgRef: React.RefObject<SVGSVGElement | null>
) {
  const activeTool = useEditorStore((state) => state.activeTool)
  const addElement = useEditorStore((state) => state.addElement)
  const [points, setPoints] = useState<Point[]>([])
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const getPoint = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const state = useEditorStore.getState()
      const { zoom, panX, panY } = state.viewport
      const world = toWorldPoint(e.clientX, e.clientY, svg, zoom, panX, panY)
      // Grid / object snapping (screen tolerance scaled by zoom).
      return snapPoint(world, state.elements, state.snapConfig, zoom)
    },
    [svgRef]
  )

  const startDrawing = useCallback((point: Point) => {
    setPoints([point])
    setPreviewPoint(point)
    setIsDrawing(true)
  }, [])

  const appendPoint = useCallback((point: Point) => {
    setPoints((currentPoints) => [...currentPoints, point])
    setPreviewPoint(point)
  }, [])

  const commit = useCallback(() => {
    if (points.length >= 2) {
      addElement(createPolylineElement(points))
    }
    setPoints([])
    setPreviewPoint(null)
    setIsDrawing(false)
  }, [addElement, points])

  const cancel = useCallback(() => {
    setPoints([])
    setPreviewPoint(null)
    setIsDrawing(false)
  }, [])

  useEffect(() => {
    if (activeTool !== 'polyline' && isDrawing) {
      queueMicrotask(() => cancel())
    }
  }, [activeTool, cancel, isDrawing])

  const onCanvasClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const point = getPoint(e)
      if (!isDrawing) {
        startDrawing(point)
        return
      }
      appendPoint(point)
    },
    [appendPoint, isDrawing, startDrawing, getPoint]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isDrawing) setPreviewPoint(getPoint(e))
    },
    [isDrawing, getPoint]
  )

  const onDoubleClick = useCallback(() => {
    commit()
  }, [commit])

  return {
    points,
    previewPoint,
    isDrawing,
    onCanvasClick,
    onMouseMove,
    onDoubleClick,
    commit,
    cancel,
  }
}