import { useCallback, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { createRectElement } from '../types/canvas'

const MIN_DRAW_SIZE = 2

interface PreviewRect {
  x: number
  y: number
  width: number
  height: number
}

export function useRectTool(
  svgRef: React.RefObject<SVGSVGElement | null>
) {
  const addElement = useEditorStore((state) => state.addElement)
  const [previewRect, setPreviewRect] = useState<PreviewRect | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 })

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

  const onMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return

      const point = toSVGPoint(e)
      setDrawStart(point)
      setIsDrawing(true)
      setPreviewRect({ x: point.x, y: point.y, width: 0, height: 0 })
    },
    [toSVGPoint]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isDrawing) return

      const point = toSVGPoint(e)
      const x = Math.min(drawStart.x, point.x)
      const y = Math.min(drawStart.y, point.y)
      const width = Math.abs(point.x - drawStart.x)
      const height = Math.abs(point.y - drawStart.y)
      setPreviewRect({ x, y, width, height })
    },
    [drawStart, isDrawing, toSVGPoint]
  )

  const onMouseUp = useCallback(() => {
    if (!isDrawing) return

    if (
      previewRect &&
      previewRect.width > MIN_DRAW_SIZE &&
      previewRect.height > MIN_DRAW_SIZE
    ) {
      addElement(createRectElement(
        previewRect.x,
        previewRect.y,
        previewRect.width,
        previewRect.height
      ))
    }

    setPreviewRect(null)
    setIsDrawing(false)
  }, [addElement, isDrawing, previewRect])

  return { previewRect, onMouseDown, onMouseMove, onMouseUp }
}