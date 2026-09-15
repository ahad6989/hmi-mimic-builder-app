import type { CanvasElement, Tool } from '../types/canvas'

interface ShapeRendererProps {
  element: CanvasElement
  activeTool: Tool
  onElementMouseDown: (event: React.MouseEvent, id: string) => void
  onContextMenu: (event: React.MouseEvent<SVGElement>, id: string) => void
}

function ShapeRenderer({ element, activeTool, onElementMouseDown, onContextMenu }: ShapeRendererProps) {
  const sharedProps = {
    style: { cursor: activeTool === 'select' ? 'move' : 'crosshair' },
    onMouseDown: (event: React.MouseEvent) => {
      if (activeTool === 'select') onElementMouseDown(event, element.id)
    },
    onClick: (event: React.MouseEvent) => event.stopPropagation(),
    onContextMenu: (event: React.MouseEvent<SVGElement>) => onContextMenu(event, element.id),
  }

  if (element.type === 'rect') {
    return (
      <rect
        key={element.id}
        x={element.transform.x}
        y={element.transform.y}
        width={element.transform.width}
        height={element.transform.height}
        fill={element.style.fill}
        fillOpacity={element.style.fillOpacity}
        stroke={element.style.stroke}
        strokeWidth={element.style.strokeWidth}
        opacity={element.style.opacity ?? 1}
        rx={element.rx}
        {...sharedProps}
      />
    )
  }

  if (element.type === 'ellipse') {
    return (
      <ellipse
        key={element.id}
        cx={element.transform.x + element.transform.width / 2}
        cy={element.transform.y + element.transform.height / 2}
        rx={element.transform.width / 2}
        ry={element.transform.height / 2}
        fill={element.style.fill}
        fillOpacity={element.style.fillOpacity}
        stroke={element.style.stroke}
        strokeWidth={element.style.strokeWidth}
        opacity={element.style.opacity ?? 1}
        {...sharedProps}
      />
    )
  }

  if (element.type === 'line') {
    return (
      <line
        key={element.id}
        x1={element.x1}
        y1={element.y1}
        x2={element.x2}
        y2={element.y2}
        fill="none"
        stroke={element.style.stroke}
        strokeWidth={element.style.strokeWidth}
        opacity={element.style.opacity ?? 1}
        strokeOpacity={element.style.strokeOpacity}
        strokeDasharray={element.style.strokeDashArray}
        strokeLinecap={element.style.strokeLineCap}
        strokeLinejoin={element.style.strokeLineJoin}
        {...sharedProps}
      />
    )
  }

  if (element.type === 'path' && element.pathData) {
    return (
      <path
        key={element.id}
        d={element.pathData}
        fill={element.style.fill}
        fillOpacity={element.style.fillOpacity}
        stroke={element.style.stroke}
        strokeWidth={element.style.strokeWidth}
        opacity={element.style.opacity ?? 1}
        strokeOpacity={element.style.strokeOpacity}
        strokeDasharray={element.style.strokeDashArray}
        strokeLinecap={element.style.strokeLineCap}
        strokeLinejoin={element.style.strokeLineJoin}
        {...sharedProps}
      />
    )
  }

  if (element.type === 'polyline' && element.points) {
    return (
      <polyline
        key={element.id}
        points={element.points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill={element.style.fill}
        fillOpacity={element.style.fillOpacity}
        stroke={element.style.stroke}
        strokeWidth={element.style.strokeWidth}
        opacity={element.style.opacity ?? 1}
        strokeOpacity={element.style.strokeOpacity}
        strokeDasharray={element.style.strokeDashArray}
        strokeLinecap={element.style.strokeLineCap}
        strokeLinejoin={element.style.strokeLineJoin}
        {...sharedProps}
      />
    )
  }

  return null
}

export default ShapeRenderer
