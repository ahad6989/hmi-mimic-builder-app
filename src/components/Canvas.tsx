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
import { createRectElement } from '../types/canvas'
import { useSelectTool } from '../tools/useSelectTool'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_WIDTH  = 800
const CANVAS_HEIGHT = 600
const GRID_SIZE     = 20

/** Minimum drag size to commit a drawn shape. Prevents accidental 0×0 shapes. */
const MIN_DRAW_SIZE = 2

/** Selection outline padding around element bounding box (SVG units). */
const SELECTION_PADDING = 4

/** Cursor to show for each tool. */
const TOOL_CURSORS: Record<string, string> = {
  select:  'default',
  rect:    'crosshair',
  ellipse: 'crosshair',
  line:    'crosshair',
  pen:     'crosshair',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function Canvas() {
  // ---- Zustand subscriptions ----
  const activeTool         = useEditorStore((s) => s.activeTool)
  const elements           = useEditorStore((s) => s.elements)
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const addElement         = useEditorStore((s) => s.addElement)
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

  // ---- Local state (rect tool drawing — will move to useRectTool in Week 3) ----
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [previewRect, setPreviewRect] = useState<{
    x: number; y: number; width: number; height: number
  } | null>(null)
  const [isDrawing, setIsDrawing]   = useState(false)
  const [drawStart, setDrawStart]   = useState({ x: 0, y: 0 })

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key) {
        case 'Escape': clearSelection(); break
        case 'v': case 'V': setActiveTool('select'); break
        case 'r': case 'R': setActiveTool('rect');   break
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [clearSelection, setActiveTool])

  // ---- Coordinate conversion (Canvas-level, used for rect drawing) ----
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
    if (activeTool !== 'rect') return
    if (e.button !== 0) return // left button only

    const pt = toSVGPoint(e)
    setDrawStart(pt)
    setIsDrawing(true)
    setPreviewRect({ x: pt.x, y: pt.y, width: 0, height: 0 })
  }

  const handleSVGMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const pt = toSVGPoint(e)
    setMousePosition({ x: Math.round(pt.x), y: Math.round(pt.y) })

    if (activeTool === 'rect' && isDrawing) {
      // Update the draw preview
      const x      = Math.min(drawStart.x, pt.x)
      const y      = Math.min(drawStart.y, pt.y)
      const width  = Math.abs(pt.x - drawStart.x)
      const height = Math.abs(pt.y - drawStart.y)
      setPreviewRect({ x, y, width, height })
    }

    if (activeTool === 'select') {
      // Delegate to select tool — handles real-time drag movement
      selectTool.onMouseMove(e)
    }
  }

   const handleSVGMouseUp = (_e: React.MouseEvent<SVGSVGElement>) => {    if (activeTool === 'rect' && isDrawing) {
      if (
        previewRect &&
        previewRect.width  > MIN_DRAW_SIZE &&
        previewRect.height > MIN_DRAW_SIZE
      ) {
        addElement(createRectElement(
          previewRect.x,
          previewRect.y,
          previewRect.width,
          previewRect.height
        ))
      }
      setPreviewRect(null)
      setIsDrawing(false)
    }

    if (activeTool === 'select') {
      // Delegate to select tool — resolves click vs drag ambiguity
      selectTool.onMouseUp()
    }
  }

  const handleSVGClick = () => {
    if (activeTool === 'select') {
      // Only fires on empty canvas (shapes call stopPropagation)
      selectTool.onCanvasClick()
    }
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
            .map((el) => (
              <rect
                key={el.id}
                x={el.transform.x       - SELECTION_PADDING}
                y={el.transform.y       - SELECTION_PADDING}
                width={el.transform.width  + SELECTION_PADDING * 2}
                height={el.transform.height + SELECTION_PADDING * 2}
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
            ))}
        </g>

        {/* ── Draw preview (rect tool ghost) ────────────────────────────── */}
        {previewRect && (
          <rect
            x={previewRect.x}
            y={previewRect.y}
            width={previewRect.width}
            height={previewRect.height}
            fill="#93c5fd"
            fillOpacity={0.4}
            stroke="#2563eb"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            pointerEvents="none"
          />
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