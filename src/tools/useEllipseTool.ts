import { useCallback, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { createEllipseElement } from '../types/canvas'

const MIN_DRAW_SIZE = 2

interface PreviewEllipse {
  x: number
  y: number
  width: number
  height: number
}

export function useEllipseTool(
  svgRef: React.RefObject<SVGSVGElement | null>
) {
  const addElement = useEditorStore((state) => state.addElement)
  const [previewEllipse, setPreviewEllipse] = useState<PreviewEllipse | null>(null)
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
      setPreviewEllipse({ x: point.x, y: point.y, width: 0, height: 0 })
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
      setPreviewEllipse({ x, y, width, height })
    },
    [drawStart, isDrawing, toSVGPoint]
  )

  const onMouseUp = useCallback(() => {
    if (!isDrawing) return

    if (
      previewEllipse &&
      previewEllipse.width > MIN_DRAW_SIZE &&
      previewEllipse.height > MIN_DRAW_SIZE
    ) {
      addElement(createEllipseElement(
        previewEllipse.x + previewEllipse.width / 2,
        previewEllipse.y + previewEllipse.height / 2,
        previewEllipse.width / 2,
        previewEllipse.height / 2
      ))
    }

    setPreviewEllipse(null)
    setIsDrawing(false)
  }, [addElement, isDrawing, previewEllipse])

  return { previewEllipse, onMouseDown, onMouseMove, onMouseUp }
}