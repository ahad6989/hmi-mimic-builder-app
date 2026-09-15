import type { PathPoint } from '../types/canvas'

interface DrawPreviewProps {
  rectTool: {
    previewRect: { x: number; y: number; width: number; height: number } | null
  }
  ellipseTool: {
    previewEllipse: { x: number; y: number; width: number; height: number } | null
  }
  lineTool: {
    previewLine: { x1: number; y1: number; x2: number; y2: number } | null
  }
  polylineTool: {
    isDrawing: boolean
    points: Array<{ x: number; y: number }>
    previewPoint: { x: number; y: number } | null
  }
  penTool: {
    isDrawing: boolean
    points: PathPoint[]
    previewPoint: PathPoint | null
  }
}

function buildPenPreviewPath(
  points: PathPoint[],
  previewPoint: PathPoint | null,
  activeHandleIndex: number | null,
  activeHandlePoint: PathPoint | null
) {
  if (points.length === 0) return ''

  const previewPoints = previewPoint ? [...points, previewPoint] : points
  return previewPoints
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`

      const previousPoint = previewPoints[index - 1]
      const isActiveIncomingPreview = index === activeHandleIndex && activeHandlePoint
      const incomingControl = isActiveIncomingPreview ? activeHandlePoint : point

      if (!previousPoint.handleOut && !isActiveIncomingPreview) {
        return `L ${point.x} ${point.y}`
      }

      const outgoingControl = previousPoint.handleOut ?? previousPoint
      return `C ${outgoingControl.x} ${outgoingControl.y} ${incomingControl.x} ${incomingControl.y} ${point.x} ${point.y}`
    })
    .join(' ')
}

function DrawPreview({ rectTool, ellipseTool, lineTool, polylineTool, penTool }: DrawPreviewProps) {
  return (
    <>
      {rectTool.previewRect && (
        <rect
          x={rectTool.previewRect.x}
          y={rectTool.previewRect.y}
          width={rectTool.previewRect.width}
          height={rectTool.previewRect.height}
          fill="var(--canvas-preview-fill)"
          fillOpacity={0.4}
          stroke="var(--canvas-preview-stroke)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          pointerEvents="none"
        />
      )}

      {ellipseTool.previewEllipse && (
        <ellipse
          cx={ellipseTool.previewEllipse.x + ellipseTool.previewEllipse.width / 2}
          cy={ellipseTool.previewEllipse.y + ellipseTool.previewEllipse.height / 2}
          rx={ellipseTool.previewEllipse.width / 2}
          ry={ellipseTool.previewEllipse.height / 2}
          fill="var(--canvas-preview-fill)"
          fillOpacity={0.4}
          stroke="var(--canvas-preview-stroke)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          pointerEvents="none"
        />
      )}

      {lineTool.previewLine && (
        <line
          x1={lineTool.previewLine.x1}
          y1={lineTool.previewLine.y1}
          x2={lineTool.previewLine.x2}
          y2={lineTool.previewLine.y2}
          stroke="var(--canvas-preview-stroke)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          pointerEvents="none"
        />
      )}

      {polylineTool.isDrawing && polylineTool.points.length > 0 && (
        <>
          <polyline
            points={polylineTool.points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke="var(--canvas-preview-stroke)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            pointerEvents="none"
          />
          {polylineTool.previewPoint && (
            <line
              x1={polylineTool.points[polylineTool.points.length - 1].x}
              y1={polylineTool.points[polylineTool.points.length - 1].y}
              x2={polylineTool.previewPoint.x}
              y2={polylineTool.previewPoint.y}
              stroke="var(--canvas-preview-stroke)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
              pointerEvents="none"
            />
          )}
        </>
      )}

      {penTool.isDrawing && penTool.points.length > 0 && (
        <>
          <path
            d={buildPenPreviewPath(penTool.points, penTool.previewPoint, null, null)}
            fill="none"
            stroke="var(--canvas-preview-stroke)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            pointerEvents="none"
          />
          {penTool.previewPoint && (
            <line
              x1={penTool.points[penTool.points.length - 1].x}
              y1={penTool.points[penTool.points.length - 1].y}
              x2={penTool.previewPoint.x}
              y2={penTool.previewPoint.y}
              stroke="var(--canvas-preview-stroke)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
              pointerEvents="none"
            />
          )}
        </>
      )}
    </>
  )
}

export default DrawPreview
