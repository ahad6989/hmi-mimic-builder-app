import { useCallback, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { createLineElement } from '../types/canvas'

const MIN_DRAW_SIZE = 2

interface PreviewLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function useLineTool(
  svgRef: React.RefObject<SVGSVGElement | null>
) {
  const addElement = useEditorStore((state) => state.addElement)
  const [previewLine, setPreviewLine] = useState<PreviewLine | null>(null)
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
      setPreviewLine({ x1: point.x, y1: point.y, x2: point.x, y2: point.y })
    },
    [toSVGPoint]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isDrawing) return

      const point = toSVGPoint(e)
      setPreviewLine({
        x1: drawStart.x,
        y1: drawStart.y,
        x2: point.x,
        y2: point.y,
      })
    },
    [drawStart, isDrawing, toSVGPoint]
  )

  const onMouseUp = useCallback(() => {
    if (!isDrawing) return

    if (previewLine) {
      const deltaX = previewLine.x2 - previewLine.x1
      const deltaY = previewLine.y2 - previewLine.y1
      const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      if (length > MIN_DRAW_SIZE) {
        addElement(createLineElement(
          previewLine.x1,
          previewLine.y1,
          previewLine.x2,
          previewLine.y2
        ))
      }
    }

    setPreviewLine(null)
    setIsDrawing(false)
  }, [addElement, isDrawing, previewLine])

  return { previewLine, onMouseDown, onMouseMove, onMouseUp }
}