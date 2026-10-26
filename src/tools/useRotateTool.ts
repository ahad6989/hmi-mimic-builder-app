import { useCallback, useRef } from 'react'
import { useEditorStore } from '../store/EditorStore'
import type { Bounds } from '../geometry/bounds'
import { toWorldPoint } from '../geometry/coordinates'

interface RotationDrag {
  elementId: string
  center: { x: number; y: number }
  historyKey: string
}

export function useRotateTool(svgRef: React.RefObject<SVGSVGElement | null>) {
  const rotateElement = useEditorStore((state) => state.rotateElement)
  const dragRef = useRef<RotationDrag | null>(null)

  const getPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const { zoom, panX, panY } = useEditorStore.getState().viewport
      return toWorldPoint(clientX, clientY, svg, zoom, panX, panY)
    },
    [svgRef]
  )

  const onHandleMouseDown = useCallback(
    (event: React.MouseEvent, elementId: string, bounds: Bounds) => {
      event.preventDefault()
      event.stopPropagation()
      dragRef.current = {
        elementId,
        center: {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
        },
        historyKey: crypto.randomUUID(),
      }
    },
    []
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const drag = dragRef.current
      if (!drag) return

      const point = getPoint(event.clientX, event.clientY)
      let rotation = Math.atan2(
        point.y - drag.center.y,
        point.x - drag.center.x
      ) * (180 / Math.PI) + 90

      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15
      rotateElement(drag.elementId, rotation, drag.historyKey)
    },
    [rotateElement, getPoint]
  )

  const onMouseUp = useCallback(() => {
    dragRef.current = null
  }, [])

  return { onHandleMouseDown, onMouseMove, onMouseUp }
}