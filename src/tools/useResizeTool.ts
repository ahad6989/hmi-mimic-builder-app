import { useCallback, useRef } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { getElementBounds, type Bounds } from '../geometry/bounds'
import type { CanvasElement } from '../types/canvas'

const MIN_RESIZE_SIZE = 2

export type ResizeHandle =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'

interface ResizeDrag {
  elementId: string
  handle: ResizeHandle
  bounds: Bounds
  originalElement: CanvasElement
  historyKey: string
}

function cloneElement(element: CanvasElement): CanvasElement {
  return {
    ...element,
    transform: { ...element.transform },
    points: element.points?.map((point) => ({
      ...point,
      ...(point.handleOut ? { handleOut: { ...point.handleOut } } : {}),
    })),
  }
}

function hasHandle(handle: ResizeHandle, direction: 'left' | 'right' | 'top' | 'bottom') {
  return handle.includes(direction)
}

function getResizedBounds(bounds: Bounds, handle: ResizeHandle, point: { x: number; y: number }) {
  let left = bounds.x
  let top = bounds.y
  let right = bounds.x + bounds.width
  let bottom = bounds.y + bounds.height

  if (hasHandle(handle, 'left')) left = Math.min(point.x, right - MIN_RESIZE_SIZE)
  if (hasHandle(handle, 'right')) right = Math.max(point.x, left + MIN_RESIZE_SIZE)
  if (hasHandle(handle, 'top')) top = Math.min(point.y, bottom - MIN_RESIZE_SIZE)
  if (hasHandle(handle, 'bottom')) bottom = Math.max(point.y, top + MIN_RESIZE_SIZE)

  return { left, top, right, bottom }
}

function getAnchorPoint(bounds: Bounds, handle: ResizeHandle) {
  const left = bounds.x
  const top = bounds.y
  const right = bounds.x + bounds.width
  const bottom = bounds.y + bounds.height

  return {
    x: hasHandle(handle, 'left') ? right : hasHandle(handle, 'right') ? left : left + bounds.width / 2,
    y: hasHandle(handle, 'top') ? bottom : hasHandle(handle, 'bottom') ? top : top + bounds.height / 2,
  }
}

export function useResizeTool(
  svgRef: React.RefObject<SVGSVGElement | null>
) {
  const resizeElement = useEditorStore((state) => state.resizeElement)
  const dragRef = useRef<ResizeDrag | null>(null)

  const toSVGPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }

      const point = svg.createSVGPoint()
      point.x = clientX
      point.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }

      return point.matrixTransform(ctm.inverse())
    },
    [svgRef]
  )

  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string, handle: ResizeHandle) => {
      e.stopPropagation()
      e.preventDefault()
      const element = useEditorStore.getState().elements.find((item) => item.id === elementId)
      if (!element) return

      dragRef.current = {
        elementId,
        handle,
        bounds: getElementBounds(element),
        originalElement: cloneElement(element),
        historyKey: crypto.randomUUID(),
      }
    },
    []
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const drag = dragRef.current
      if (!drag) return

      const point = toSVGPoint(e.clientX, e.clientY)
      const resizedBounds = getResizedBounds(drag.bounds, drag.handle, point)
      const nextWidth = resizedBounds.right - resizedBounds.left
      const nextHeight = resizedBounds.bottom - resizedBounds.top
      const scaleX = drag.bounds.width > 0 ? nextWidth / drag.bounds.width : 1
      const scaleY = drag.bounds.height > 0 ? nextHeight / drag.bounds.height : 1

      resizeElement(
        drag.elementId,
        scaleX,
        scaleY,
        getAnchorPoint(drag.bounds, drag.handle),
        drag.originalElement,
        drag.historyKey
      )
    },
    [resizeElement, toSVGPoint]
  )

  const onMouseUp = useCallback(() => {
    dragRef.current = null
  }, [])

  return {
    onHandleMouseDown,
    onMouseMove,
    onMouseUp,
  }
}
