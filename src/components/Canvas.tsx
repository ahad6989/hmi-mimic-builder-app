// =============================================================================
// Canvas.tsx — The SVG drawing surface
//
// Responsibilities (and ONLY these):
//   1. Own the SVG element via svgRef and pass it to tool hooks
//   2. Normalize raw pointer events and route them to the active tool
//   3. Render: grid, artwork layer, selection overlay, draw preview
//   4. Sync cursor style to the active tool
//
// What does NOT belong here:
//   - Select tool gesture logic       → src/tools/useSelectTool.ts
//   - Rect tool drawing logic         → will move to src/tools/useRectTool.ts (Week 3)
//   - Inspector / style editing       → Inspector panel
//
// Event routing pattern (the "dispatcher" from the SRS):
//
//   Raw pointer event
//     → handleSVGMouseDown / handleSVGMouseMove / handleSVGMouseUp
//       → checks activeTool
//         → delegates to the correct tool hook's handler
//           → tool hook calls Zustand actions
//             → Zustand notifies React → Canvas re-renders
// =============================================================================

import { useRef, useState, useEffect } from 'react'
import { useEditorStore } from '../store/EditorStore'
import type { CanvasElement } from '../types/canvas'
import { useSelectTool } from '../tools/useSelectTool'
import { useRectTool } from '../tools/useRectTool'
import { useEllipseTool } from '../tools/useEllipseTool'
import { useLineTool } from '../tools/useLineTool'
import { usePolylineTool } from '../tools/usePolylineTool'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_WIDTH  = 800
const CANVAS_HEIGHT = 600
const GRID_SIZE     = 20

/** Selection outline padding around element bounding box (SVG units). */
const SELECTION_PADDING = 4

/** Cursor to show for each tool. */
const TOOL_CURSORS: Record<string, string> = {
  select:  'default',
  rect:    'crosshair',
  ellipse: 'crosshair',
  line:    'crosshair',
  polyline: 'crosshair',
  pen:     'crosshair',
}

function getElementBounds(element: CanvasElement) {
  if (element.type === 'polyline' && element.points && element.points.length > 0) {
    const xValues = element.points.map((point) => point.x)
    const yValues = element.points.map((point) => point.y)
    const x = Math.min(...xValues)
    const y = Math.min(...yValues)
    return {
      x,
      y,
      width: Math.max(...xValues) - x,
      height: Math.max(...yValues) - y,
    }
  }

  return {
    x: element.transform.x,
    y: element.transform.y,
    width: element.transform.width,
    height: element.transform.height,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function Canvas() {
  // ---- Zustand subscriptions ----
  const activeTool         = useEditorStore((s) => s.activeTool)
  const elements           = useEditorStore((s) => s.elements)
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const setActiveTool      = useEditorStore((s) => s.setActiveTool)
  const clearSelection     = useEditorStore((s) => s.clearSelection)

  // ---- SVG ref ----
  // A ref to the <svg> DOM element. We pass this to tool hooks so they can
  // convert screen coordinates to SVG coordinates without needing a React event.
  const svgRef = useRef<SVGSVGElement>(null)

  // ---- Tool hooks ----
  // Each tool hook owns its own internal state and returns event handlers.
  // Canvas just calls them and wires up the returned handlers.
  const selectTool = useSelectTool(svgRef)
  const rectTool = useRectTool(svgRef)
  const ellipseTool = useEllipseTool(svgRef)
  const lineTool = useLineTool(svgRef)
  const polylineTool = usePolylineTool(svgRef)

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key) {
        case 'Escape':
          if (activeTool === 'polyline' && polylineTool.isDrawing) {
            polylineTool.cancel()
          } else {
            clearSelection()
          }
          break
        case 'Enter':
          if (activeTool === 'polyline') polylineTool.commit()
          break
        case 'v': case 'V': setActiveTool('select'); break
        case 'r': case 'R': setActiveTool('rect');   break
        case 'y': case 'Y': setActiveTool('polyline'); break
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeTool, clearSelection, polylineTool, setActiveTool])

  // ---- Coordinate conversion (Canvas-level, used for the mouse readout) ----
  const toSVGPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt  = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    return pt.matrixTransform(ctm.inverse())
  }

  // ---- SVG-level event handlers (the dispatcher) ----

  const handleSVGMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'rect') rectTool.onMouseDown(e)
    if (activeTool === 'ellipse') ellipseTool.onMouseDown(e)
    if (activeTool === 'line') lineTool.onMouseDown(e)
  }

  const handleSVGMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const pt = toSVGPoint(e)
    setMousePosition({ x: Math.round(pt.x), y: Math.round(pt.y) })

    if (activeTool === 'rect') rectTool.onMouseMove(e)
    if (activeTool === 'ellipse') ellipseTool.onMouseMove(e)
    if (activeTool === 'line') lineTool.onMouseMove(e)
    if (activeTool === 'polyline') polylineTool.onMouseMove(e)

    if (activeTool === 'select') {
      // Delegate to select tool — handles real-time drag movement
      selectTool.onMouseMove(e)
    }
  }

  const handleSVGMouseUp = (_e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'rect') rectTool.onMouseUp()
    if (activeTool === 'ellipse') ellipseTool.onMouseUp()
    if (activeTool === 'line') lineTool.onMouseUp()

    if (activeTool === 'select') {
      // Delegate to select tool — resolves click vs drag ambiguity
      selectTool.onMouseUp()
    }
  }

  const handleSVGClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'select') {
      // Only fires on empty canvas (shapes call stopPropagation)
      selectTool.onCanvasClick()
    }
    if (activeTool === 'polyline') polylineTool.onCanvasClick(e)
  }

  const handleSVGDoubleClick = () => {
    if (activeTool === 'polyline') polylineTool.onDoubleClick()
  }

  // ---- Render ----
  return (
    <main className="flex-1 overflow-hidden relative" style={{ background: '#e5e7eb' }}>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="bg-white"
        style={{ cursor: TOOL_CURSORS[activeTool] ?? 'default' }}
        onMouseDown={handleSVGMouseDown}
        onMouseMove={handleSVGMouseMove}
        onMouseUp={handleSVGMouseUp}
        onClick={handleSVGClick}
        onDoubleClick={handleSVGDoubleClick}
      >

        {/* ── Grid ─────────────────────────────────────────────────────── */}
        <defs>
          <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
            <path
              d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#grid)" />

        {/* ── Artwork layer ─────────────────────────────────────────────── */}
        {/*
          Shapes render here. Selection overlay renders AFTER this group,
          so it always appears on top regardless of shape count or z-order.
        */}
        <g id="artwork-layer">
          {elements.map((el) => {
            if (el.type === 'rect') {
              return (
                <rect
                  key={el.id}
                  x={el.transform.x}
                  y={el.transform.y}
                  width={el.transform.width}
                  height={el.transform.height}
                  fill={el.style.fill}
                  fillOpacity={el.style.fillOpacity}
                  stroke={el.style.stroke}
                  strokeWidth={el.style.strokeWidth}
                  rx={el.rx}
                  style={{
                    cursor: activeTool === 'select' ? 'move' : 'crosshair',
                  }}
                  // Route element-level events to the active tool
                  onMouseDown={(e) => {
                    if (activeTool === 'select') {
                      selectTool.onElementMouseDown(e, el.id)
                    }
                  }}
                  // Prevent SVG onClick (clearSelection) from firing
                  // after we've just selected or dragged a shape
                  onClick={(e) => e.stopPropagation()}
                />
              )
            }
            if (el.type === 'ellipse') {
              return (
                <ellipse
                  key={el.id}
                  cx={el.transform.x + el.transform.width / 2}
                  cy={el.transform.y + el.transform.height / 2}
                  rx={el.transform.width / 2}
                  ry={el.transform.height / 2}
                  fill={el.style.fill}
                  fillOpacity={el.style.fillOpacity}
                  stroke={el.style.stroke}
                  strokeWidth={el.style.strokeWidth}
                  style={{
                    cursor: activeTool === 'select' ? 'move' : 'crosshair',
                  }}
                  onMouseDown={(e) => {
                    if (activeTool === 'select') {
                      selectTool.onElementMouseDown(e, el.id)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              )
            }
            if (el.type === 'line') {
              return (
                <line
                  key={el.id}
                  x1={el.x1}
                  y1={el.y1}
                  x2={el.x2}
                  y2={el.y2}
                  fill="none"
                  stroke={el.style.stroke}
                  strokeWidth={el.style.strokeWidth}
                  strokeOpacity={el.style.strokeOpacity}
                  strokeDasharray={el.style.strokeDashArray}
                  strokeLinecap={el.style.strokeLineCap}
                  strokeLinejoin={el.style.strokeLineJoin}
                  style={{
                    cursor: activeTool === 'select' ? 'move' : 'crosshair',
                  }}
                  onMouseDown={(e) => {
                    if (activeTool === 'select') {
                      selectTool.onElementMouseDown(e, el.id)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              )
            }
            if (el.type === 'polyline' && el.points) {
              return (
                <polyline
                  key={el.id}
                  points={el.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill={el.style.fill}
                  fillOpacity={el.style.fillOpacity}
                  stroke={el.style.stroke}
                  strokeWidth={el.style.strokeWidth}
                  strokeOpacity={el.style.strokeOpacity}
                  strokeDasharray={el.style.strokeDashArray}
                  strokeLinecap={el.style.strokeLineCap}
                  strokeLinejoin={el.style.strokeLineJoin}
                  style={{
                    cursor: activeTool === 'select' ? 'move' : 'crosshair',
                  }}
                  onMouseDown={(e) => {
                    if (activeTool === 'select') {
                      selectTool.onElementMouseDown(e, el.id)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              )
            }
            return null
          })}
        </g>

        {/* ── Selection overlay ─────────────────────────────────────────── */}
        {/*
          Rendered AFTER the artwork layer so outlines always sit on top.
          pointerEvents="none" means mouse events pass through to shapes below.
        */}
        <g id="selection-overlay" pointerEvents="none">
          {elements
            .filter((el) => selectedElementIds.includes(el.id))
            .map((el) => {
              const bounds = getElementBounds(el)
              return (
                <rect
                  key={el.id}
                  x={bounds.x - SELECTION_PADDING}
                  y={bounds.y - SELECTION_PADDING}
                  width={bounds.width + SELECTION_PADDING * 2}
                  height={bounds.height + SELECTION_PADDING * 2}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
              )
            })}
        </g>

        {/* ── Draw previews ─────────────────────────────────────────────── */}
        {rectTool.previewRect && (
          <rect
            x={rectTool.previewRect.x}
            y={rectTool.previewRect.y}
            width={rectTool.previewRect.width}
            height={rectTool.previewRect.height}
            fill="#93c5fd"
            fillOpacity={0.4}
            stroke="#2563eb"
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
            fill="#93c5fd"
            fillOpacity={0.4}
            stroke="#2563eb"
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
            stroke="#2563eb"
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
              stroke="#2563eb"
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
                stroke="#2563eb"
                strokeWidth="1.5"
                strokeDasharray="5 5"
                pointerEvents="none"
              />
            )}
          </>
        )}

      </svg>

      {/* ── Status readouts ───────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 bg-white px-3 py-1 rounded shadow text-xs text-gray-600 font-mono">
        {mousePosition.x}, {mousePosition.y}
      </div>
      <div className="absolute bottom-3 right-3 bg-white px-3 py-1 rounded shadow text-xs text-gray-600 font-mono">
        Tool: {activeTool}
      </div>

    </main>
  )
}

export default Canvas