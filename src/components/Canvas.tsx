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
import { getElementBounds } from '../geometry/bounds'
import { useSelectTool } from '../tools/useSelectTool'
import { useRectTool } from '../tools/useRectTool'
import { useEllipseTool } from '../tools/useEllipseTool'
import { useLineTool } from '../tools/useLineTool'
import { usePolylineTool } from '../tools/usePolylineTool'
import { usePenTool } from '../tools/usePenTool'
import { useResizeTool } from '../tools/useResizeTool'
import ShapeRenderer from './ShapeRenderer'
import SelectionOverlay from './SelectionOverlay'
import ResizeHandles from './ResizeHandles'
import DrawPreview from './DrawPreview'
import ShapeContextMenu from './ShapeContextMenu'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_WIDTH  = 800
const CANVAS_HEIGHT = 600
const GRID_SIZE     = 20

/** Selection outline padding around element bounding box (SVG units). */
const TOOL_CURSORS: Record<string, string> = {
  select:  'default',
  rect:    'crosshair',
  ellipse: 'crosshair',
  line:    'crosshair',
  polyline: 'crosshair',
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
  const setActiveTool      = useEditorStore((s) => s.setActiveTool)
  const clearSelection     = useEditorStore((s) => s.clearSelection)
  const selectElement       = useEditorStore((s) => s.selectElement)
  const deleteElement       = useEditorStore((s) => s.deleteElement)
  const bringToFront       = useEditorStore((s) => s.bringToFront)
  const sendToBack         = useEditorStore((s) => s.sendToBack)
  const bringForward       = useEditorStore((s) => s.bringForward)
  const sendBackward       = useEditorStore((s) => s.sendBackward)
  const undo               = useEditorStore((s) => s.undo)
  const redo               = useEditorStore((s) => s.redo)

  // ---- SVG ref ----
  // A ref to the <svg> DOM element. We pass this to tool hooks so they can
  // convert screen coordinates to SVG coordinates without needing a React event.
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // ---- Tool hooks ----
  // Each tool hook owns its own internal state and returns event handlers.
  // Canvas just calls them and wires up the returned handlers.
  const selectTool = useSelectTool(svgRef)
  const rectTool = useRectTool(svgRef)
  const ellipseTool = useEllipseTool(svgRef)
  const lineTool = useLineTool(svgRef)
  const polylineTool = usePolylineTool(svgRef)
  const penTool = usePenTool(svgRef)
  const resizeTool = useResizeTool(svgRef)

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const selectedElement = selectedElementIds.length === 1
    ? elements.find((element) => element.id === selectedElementIds[0])
    : undefined
  const selectedBounds = selectedElement ? getElementBounds(selectedElement) : null

  useKeyboardShortcuts({
    activeTool,
    contextMenuOpen: contextMenu !== null,
    selectedElementIds,
    polylineTool,
    penTool,
    setActiveTool,
    clearSelection,
    deleteElement,
    setContextMenu,
    undo,
    redo,
  })

  useEffect(() => {
    if (!contextMenu) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) {
        setContextMenu(null)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [contextMenu])

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
    if (activeTool === 'pen') penTool.onMouseDown(e)
  }

  const handleSVGMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const pt = toSVGPoint(e)
    setMousePosition({ x: Math.round(pt.x), y: Math.round(pt.y) })

    if (activeTool === 'rect') rectTool.onMouseMove(e)
    if (activeTool === 'ellipse') ellipseTool.onMouseMove(e)
    if (activeTool === 'line') lineTool.onMouseMove(e)
    if (activeTool === 'polyline') polylineTool.onMouseMove(e)
    if (activeTool === 'pen') penTool.onMouseMove(e)

    if (activeTool === 'select') {
      resizeTool.onMouseMove(e)
      // Delegate to select tool — handles real-time drag movement
      selectTool.onMouseMove(e)
    }
  }

  const handleSVGMouseUp = () => {
    if (activeTool === 'rect') rectTool.onMouseUp()
    if (activeTool === 'ellipse') ellipseTool.onMouseUp()
    if (activeTool === 'line') lineTool.onMouseUp()
    if (activeTool === 'pen') penTool.onMouseUp()

    if (activeTool === 'select') {
      resizeTool.onMouseUp()
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
    if (activeTool === 'pen') penTool.onCanvasClick()
  }

  const handleSVGDoubleClick = () => {
    if (activeTool === 'polyline') polylineTool.onDoubleClick()
    if (activeTool === 'pen') penTool.onDoubleClick()
  }

  const handleShapeContextMenu = (event: React.MouseEvent<SVGElement>, id: string) => {
    event.preventDefault()
    event.stopPropagation()
    selectElement(id)

    const canvas = canvasRef.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    setContextMenu({
      id,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
  }

  // ---- Render ----
  return (
    <main ref={canvasRef} className="relative flex-1 overflow-hidden bg-slate-200 transition-colors dark:bg-slate-950">

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="border border-slate-300 shadow-sm dark:border-slate-700"
        style={{
          cursor: TOOL_CURSORS[activeTool] ?? 'default',
          backgroundColor: 'var(--canvas-background)',
        }}
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
              stroke="var(--canvas-grid)"
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
          {elements.map((element) => (
            <ShapeRenderer
              key={element.id}
              element={element}
              activeTool={activeTool}
              onElementMouseDown={selectTool.onElementMouseDown}
              onContextMenu={handleShapeContextMenu}
            />
          ))}
        </g>

        {/* ── Selection overlay ─────────────────────────────────────────── */}
        {/*
          Rendered AFTER the artwork layer so outlines always sit on top.
          pointerEvents="none" means mouse events pass through to shapes below.
        */}
        <SelectionOverlay elements={elements} selectedElementIds={selectedElementIds} />

        {activeTool === 'select' && (
          <ResizeHandles element={selectedElement} bounds={selectedBounds} resizeTool={resizeTool} />
        )}

        {/* ── Draw previews ─────────────────────────────────────────────── */}
        <DrawPreview
          rectTool={rectTool}
          ellipseTool={ellipseTool}
          lineTool={lineTool}
          polylineTool={polylineTool}
          penTool={penTool}
        />

      </svg>

      {contextMenu && (
        <ShapeContextMenu
          contextMenu={contextMenu}
          contextMenuRef={contextMenuRef}
          onClose={() => setContextMenu(null)}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
          bringForward={bringForward}
          sendBackward={sendBackward}
          deleteElement={deleteElement}
        />
      )}

      {/* ── Status readouts ───────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 rounded border border-slate-200 bg-white px-3 py-1 font-mono text-xs text-slate-600 shadow-sm dark:border-slate-300 dark:bg-slate-100 dark:text-slate-700">
        {mousePosition.x}, {mousePosition.y}
      </div>
      <div className="absolute bottom-3 right-3 rounded border border-slate-200 bg-white px-3 py-1 font-mono text-xs text-slate-600 shadow-sm dark:border-slate-300 dark:bg-slate-100 dark:text-slate-700">
        Tool: {activeTool}
      </div>

    </main>
  )
}

export default Canvas