import { useCallback } from 'react'
import type { CanvasElement, Tool } from '../types/canvas'
import { getElementBounds } from '../geometry/bounds'

/** Line spacing (em) — must match TextEditOverlay's LINE_HEIGHT_FACTOR. */
const LINE_HEIGHT_FACTOR = 1.4

interface ShapeRendererProps {
  element: CanvasElement
  activeTool: Tool
  renderedElement?: SVGTextElement | null
  onTextRef?: (id: string, node: SVGTextElement | null) => void
  onElementMouseDown: (event: React.MouseEvent, id: string) => void
  onContextMenu: (event: React.MouseEvent<SVGElement>, id: string) => void
  onTextClick: (id: string) => void
  isBeingEdited?: boolean
}

function ShapeRenderer({ element, activeTool, renderedElement, onTextRef, onElementMouseDown, onContextMenu, onTextClick, isBeingEdited }: ShapeRendererProps) {
  const bounds = getElementBounds(element, renderedElement)
  const rotation = element.transform.rotation ?? 0
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const rotationTransform = `rotate(${rotation} ${centerX} ${centerY})`
  const textRef = useCallback(
    (node: SVGTextElement | null) => onTextRef?.(element.id, node),
    [element.id, onTextRef]
  )
  const sharedProps = {
    style: { cursor: activeTool === 'select' ? 'move' : 'crosshair' },
    onMouseDown: (event: React.MouseEvent) => {
      if (activeTool === 'select') onElementMouseDown(event, element.id)
    },
    ...(activeTool === 'select'
      ? {
          onClick: (event: React.MouseEvent) => event.stopPropagation(),
          onContextMenu: (event: React.MouseEvent<SVGElement>) => onContextMenu(event, element.id),
        }
      : {}),
  }
  const hitStrokeWidth = Math.max(element.style.strokeWidth, 12)

  if (element.type === 'rect') {
    return (
      <g key={element.id} transform={rotationTransform}>
        <rect
          x={element.transform.x}
          y={element.transform.y}
          width={element.transform.width}
          height={element.transform.height}
          fill={element.style.fill}
          fillOpacity={element.style.fillOpacity}
          stroke={element.style.stroke}
          strokeWidth={element.style.strokeWidth}
          opacity={element.style.opacity ?? 1}
          strokeOpacity={element.style.strokeOpacity}
          strokeDasharray={element.style.strokeDashArray}
          strokeLinecap={element.style.strokeLineCap}
          strokeLinejoin={element.style.strokeLineJoin}
          rx={element.rx}
          ry={element.ry}
          {...sharedProps}
        />
      </g>
    )
  }

  if (element.type === 'ellipse') {
    return (
      <g key={element.id} transform={rotationTransform} data-el-id={element.id}>
        <ellipse
          cx={element.transform.x + element.transform.width / 2}
          cy={element.transform.y + element.transform.height / 2}
          rx={element.transform.width / 2}
          ry={element.transform.height / 2}
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
      </g>
    )
  }

  if (element.type === 'line') {
    return (
      <g key={element.id} transform={rotationTransform}>
        {activeTool === 'select' && (
          <line
            x1={element.x1}
            y1={element.y1}
            x2={element.x2}
            y2={element.y2}
            fill="none"
            stroke="transparent"
            strokeWidth={hitStrokeWidth}
            {...sharedProps}
          />
        )}
        <line
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
        />
      </g>
    )
  }

  if (element.type === 'path' && element.pathData) {
    return (
      <g key={element.id} transform={rotationTransform}>
        {activeTool === 'select' && (
          <path
            d={element.pathData}
            fill="none"
            stroke="transparent"
            strokeWidth={hitStrokeWidth}
            {...sharedProps}
          />
        )}
        <path
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
        />
      </g>
    )
  }

  if (element.type === 'polyline' && element.points) {
    return (
      <g key={element.id} transform={rotationTransform}>
        {activeTool === 'select' && (
          <polyline
            points={element.points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke="transparent"
            strokeWidth={hitStrokeWidth}
            {...sharedProps}
          />
        )}
        <polyline
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
        />
      </g>
    )
  }

  if (element.type === 'text') {
    const textStyle = element.textStyle
    const content = textStyle.content ?? ''
    const lines = content.split('\n')
    const fontSize = textStyle.fontSize
    const lineHeight = fontSize * LINE_HEIGHT_FACTOR
    // SVG <text> ignores '\n', so render one <tspan> per line. Stack them with
    // dy = lineHeight and centre the whole block vertically on the anchor: the
    // first baseline sits at transform.y - (n-1)*lineHeight/2 so the block's
    // midline is the anchor — mirroring exactly how TextEditOverlay centres its
    // content box, so the text does not jump on commit.
    const firstBaselineY = element.transform.y - (lines.length - 1) * lineHeight / 2;
    return (
      <g key={element.id} transform={rotationTransform} visibility={isBeingEdited ? 'hidden' : 'visible'}>
        {textStyle.backgroundColor && textStyle.backgroundColor !== 'transparent' && (
          <rect
            x={bounds.x}
            y={bounds.y}
            width={bounds.width}
            height={bounds.height}
            fill={textStyle.backgroundColor}
            pointerEvents="none"
          />
        )}
        <text
          ref={textRef}
          x={element.transform.x}
          y={firstBaselineY}
          textAnchor="middle"
          fill={textStyle.color}
          fontFamily={textStyle.fontFamily}
          fontSize={textStyle.fontSize}
          fontWeight={textStyle.fontWeight}
          fontStyle={textStyle.fontStyle}
          textDecoration={textStyle.textDecoration}
          {...sharedProps}
          onClick={(event) => {
            event.stopPropagation()
            if (activeTool === 'select') onTextClick(element.id)
          }}
          onDoubleClick={(event) => {
            event.stopPropagation()
            if (activeTool === 'select') onTextClick(element.id)
          }}
        >
          {lines.map((line, index) => (
            <tspan key={index} x={element.transform.x} dy={index === 0 ? 0 : lineHeight}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    )
  }

  return null
}

export default ShapeRenderer
