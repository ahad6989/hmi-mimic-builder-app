import { useCallback, useEffect, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { createPolylineElement } from '../types/canvas'

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

  const toSVGPoint = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }

      const point = svg.createSVGPoint()
      point.x = e.clientX
      point.y = e.clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }

      return point.matrixTransform(ctm.inverse())
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
    if (activeTool !== 'polyline' && isDrawing) cancel()
  }, [activeTool, cancel, isDrawing])

  const onCanvasClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const point = toSVGPoint(e)
      if (!isDrawing) {
        startDrawing(point)
        return
      }
      appendPoint(point)
    },
    [appendPoint, isDrawing, startDrawing, toSVGPoint]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isDrawing) setPreviewPoint(toSVGPoint(e))
    },
    [isDrawing, toSVGPoint]
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