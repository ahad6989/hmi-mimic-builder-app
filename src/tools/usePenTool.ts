import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { createPathElement, type PathPoint } from '../types/canvas'

const SAMPLE_DISTANCE = 2

export function usePenTool(
  svgRef: React.RefObject<SVGSVGElement | null>
) {
  const activeTool = useEditorStore((state) => state.activeTool)
  const addElement = useEditorStore((state) => state.addElement)
  const [points, setPoints] = useState<PathPoint[]>([])
  const [previewPoint, setPreviewPoint] = useState<PathPoint | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const suppressNextClickRef = useRef(false)

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

  const commit = useCallback(() => {
    if (points.length >= 2) {
      addElement(createPathElement(points))
    }
    setPoints([])
    setPreviewPoint(null)
    setIsDrawing(false)
  }, [addElement, points])

  const cancel = useCallback(() => {
    setPoints([])
    setPreviewPoint(null)
    setIsDrawing(false)
    suppressNextClickRef.current = false
  }, [])

  useEffect(() => {
    if (activeTool !== 'pen' && isDrawing) cancel()
  }, [activeTool, cancel, isDrawing])

  const onMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const point = toSVGPoint(e)
      suppressNextClickRef.current = true
      setPoints([point])
      setPreviewPoint(point)
      setIsDrawing(true)
    },
    [toSVGPoint]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isDrawing) return

      const point = toSVGPoint(e)
      setPreviewPoint(point)
      setPoints((currentPoints) => {
        const lastPoint = currentPoints[currentPoints.length - 1]
        if (!lastPoint) return [point]

        const deltaX = point.x - lastPoint.x
        const deltaY = point.y - lastPoint.y
        if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) < SAMPLE_DISTANCE) {
          return currentPoints
        }

        return [...currentPoints, point]
      })
    },
    [isDrawing, toSVGPoint]
  )

  const onMouseUp = useCallback(() => {
    if (isDrawing) commit()
  }, [commit, isDrawing])

  const onCanvasClick = useCallback(() => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
    }
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
