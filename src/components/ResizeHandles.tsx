import type { CanvasElement } from '../types/canvas'
import { type Bounds } from '../geometry/bounds'
import type { ResizeHandle } from '../tools/useResizeTool'

const RESIZE_HANDLE_SIZE = 8

const RESIZE_HANDLES: Array<{
  handle: ResizeHandle
  x: number
  y: number
  cursor: string
}> = [
  { handle: 'top-left', x: 0, y: 0, cursor: 'nwse-resize' },
  { handle: 'top', x: 0.5, y: 0, cursor: 'ns-resize' },
  { handle: 'top-right', x: 1, y: 0, cursor: 'nesw-resize' },
  { handle: 'right', x: 1, y: 0.5, cursor: 'ew-resize' },
  { handle: 'bottom-right', x: 1, y: 1, cursor: 'nwse-resize' },
  { handle: 'bottom', x: 0.5, y: 1, cursor: 'ns-resize' },
  { handle: 'bottom-left', x: 0, y: 1, cursor: 'nesw-resize' },
  { handle: 'left', x: 0, y: 0.5, cursor: 'ew-resize' },
]

interface ResizeHandlesProps {
  element: CanvasElement | undefined
  bounds: Bounds | null
  resizeTool: {
    onHandleMouseDown: (event: React.MouseEvent, elementId: string, handle: ResizeHandle, bounds?: Bounds) => void
  }
  rotateTool: {
    onHandleMouseDown: (event: React.MouseEvent, elementId: string, bounds: Bounds) => void
  }
}

function ResizeHandles({ element, bounds, resizeTool, rotateTool }: ResizeHandlesProps) {
  if (!element || !bounds) return null

  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const rotation = element.transform.rotation ?? 0

  return (
    <g
      id="resize-handles"
      pointerEvents="all"
      transform={`rotate(${rotation} ${centerX} ${centerY})`}
    >
      {RESIZE_HANDLES.map(({ handle, x, y, cursor }) => (
        <rect
          key={handle}
          x={bounds.x + bounds.width * x - RESIZE_HANDLE_SIZE / 2}
          y={bounds.y + bounds.height * y - RESIZE_HANDLE_SIZE / 2}
          width={RESIZE_HANDLE_SIZE}
          height={RESIZE_HANDLE_SIZE}
          fill="var(--canvas-background)"
          stroke="#2563eb"
          strokeWidth="1.5"
          pointerEvents="all"
          style={{ cursor }}
          onMouseDown={(event) => resizeTool.onHandleMouseDown(event, element.id, handle, bounds)}
          onClick={(event) => event.stopPropagation()}
        />
      ))}
      <line
        x1={centerX}
        y1={bounds.y}
        x2={centerX}
        y2={bounds.y - 28}
        stroke="#2563eb"
        strokeWidth="1.5"
        pointerEvents="none"
      />
      <circle
        cx={centerX}
        cy={bounds.y - 28}
        r={5}
        fill="var(--canvas-background)"
        stroke="#2563eb"
        strokeWidth="1.5"
        style={{ cursor: 'grab' }}
        onMouseDown={(event) => rotateTool.onHandleMouseDown(event, element.id, bounds)}
        onClick={(event) => event.stopPropagation()}
      />
    </g>
  )
}

export default ResizeHandles
