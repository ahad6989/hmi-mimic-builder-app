import { useCallback, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { createEllipseElement } from '../types/canvas'
import { toWorldPoint } from '../geometry/coordinates'
import { snapPoint } from '../geometry/snapping'

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

  const onMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return

      const point = getPoint(e)
      setDrawStart(point)
      setIsDrawing(true)
      setPreviewEllipse({ x: point.x, y: point.y, width: 0, height: 0 })
    },
    [getPoint]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isDrawing) return

      const point = getPoint(e)
      let width = Math.abs(point.x - drawStart.x)
      let height = Math.abs(point.y - drawStart.y)

      if (e.shiftKey) {
        const side = Math.max(width, height)
        width = side
        height = side
        const x = point.x >= drawStart.x ? drawStart.x : drawStart.x - side
        const y = point.y >= drawStart.y ? drawStart.y : drawStart.y - side
        setPreviewEllipse({ x, y, width, height })
        return
      }

      const x = Math.min(drawStart.x, point.x)
      const y = Math.min(drawStart.y, point.y)
      setPreviewEllipse({ x, y, width, height })
    },
    [drawStart, isDrawing, getPoint]
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