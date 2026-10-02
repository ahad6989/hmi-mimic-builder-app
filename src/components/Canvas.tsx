// =============================================================================
// Canvas.tsx — The SVG drawing surface
// =============================================================================

import { useCallback, useRef, useState, useEffect } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { getElementBounds } from '../geometry/bounds'
import { computeFocalZoom } from '../geometry/coordinates'
import { useSelectTool } from '../tools/useSelectTool'
import { useRectTool } from '../tools/useRectTool'
import { useEllipseTool } from '../tools/useEllipseTool'
import { useLineTool } from '../tools/useLineTool'
import { usePolylineTool } from '../tools/usePolylineTool'
import { usePenTool } from '../tools/usePenTool'
import { useResizeTool } from '../tools/useResizeTool'
import { useRotateTool } from '../tools/useRotateTool'
import { useTextTool } from '../tools/useTextTool'
import ShapeRenderer from './ShapeRenderer'
import SelectionOverlay from './SelectionOverlay'
import ResizeHandles from './ResizeHandles'
import DrawPreview from './DrawPreview'
import ShapeContextMenu from './ShapeContextMenu'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import TextEditOverlay from './TextEditOverlay'

const CANVAS_WIDTH  = 800
const CANVAS_HEIGHT = 600
const GRID_SIZE     = 20

const TOOL_CURSORS: Record<string, string> = {
  select:  'default',
  rect:    'crosshair',
  ellipse: 'crosshair',
  line:    'crosshair',
  polyline: 'crosshair',
  pen:     'crosshair',
  text:    'text',
}

function Canvas() {
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
  const editingTextId      = useEditorStore((s) => s.editingTextId)
  const setEditingTextId   = useEditorStore((s) => s.setEditingTextId)
  const viewport           = useEditorStore((s) => s.viewport)
  const setViewport        = useEditorStore((s) => s.setViewport)

  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 })

  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [renderedElements, setRenderedElements] = useState<Record<string, SVGGraphicsElement | null>>({})

  const selectTool = useSelectTool(svgRef)
  const rectTool = useRectTool(svgRef)
  const ellipseTool = useEllipseTool(svgRef)
  const lineTool = useLineTool(svgRef)
  const polylineTool = usePolylineTool(svgRef)
  const penTool = usePenTool(svgRef)
  const resizeTool = useResizeTool(svgRef)
  const rotateTool = useRotateTool(svgRef)
  const textTool = useTextTool(svgRef)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const setRenderedTextRef = useCallback((id: string, node: SVGTextElement | null) => {
    setRenderedElements((current) => {
      if (current[id] === node) return current
      return { ...current, [id]: node }
    })
  }, [])
  const selectedElement = selectedElementIds.length === 1
    ? elements.find((element) => element.id === selectedElementIds[0])
    : undefined
  const selectedBounds = selectedElement
    ? getElementBounds(selectedElement, renderedElements[selectedElement.id])
    : null
  const editingText = editingTextId
    ? elements.find((element) => element.id === editingTextId && element.type === 'text')
    : undefined

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !editingTextId) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        setIsSpacePressed(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false)
        setIsPanning(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [editingTextId])

  useEffect(() => {
    const handlePointerUp = () => {
      if (isPanning) setIsPanning(false)
    }
    window.addEventListener('pointerup', handlePointerUp)
    return () => window.removeEventListener('pointerup', handlePointerUp)
  }, [isPanning])

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

  const handleSVGMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || isSpacePressed) {
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY })
      return
    }

    if (activeTool === 'rect') rectTool.onMouseDown(e)
    if (activeTool === 'ellipse') ellipseTool.onMouseDown(e)
    if (activeTool === 'line') lineTool.onMouseDown(e)
    if (activeTool === 'pen') penTool.onMouseDown(e)
  }

  const handleSVGMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      setViewport({ ...viewport, panX: panStart.panX + dx, panY: panStart.panY + dy })
      return
    }

    const pt = toSVGPoint(e)
    setMousePosition({ x: Math.round(pt.x), y: Math.round(pt.y) })

    if (activeTool === 'rect') rectTool.onMouseMove(e)
    if (activeTool === 'ellipse') ellipseTool.onMouseMove(e)
    if (activeTool === 'line') lineTool.onMouseMove(e)
    if (activeTool === 'polyline') polylineTool.onMouseMove(e)
    if (activeTool === 'pen') penTool.onMouseMove(e)

    if (activeTool === 'select') {
      resizeTool.onMouseMove(e)
      rotateTool.onMouseMove(e)
      selectTool.onMouseMove(e)
    }
  }

  const handleSVGMouseUp = () => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (activeTool === 'rect') rectTool.onMouseUp()
    if (activeTool === 'ellipse') ellipseTool.onMouseUp()
    if (activeTool === 'line') lineTool.onMouseUp()
    if (activeTool === 'pen') penTool.onMouseUp()

    if (activeTool === 'select') {
      resizeTool.onMouseUp()
      rotateTool.onMouseUp()
      selectTool.onMouseUp()
    }
  }

  const handleSVGClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'select') {
      selectTool.onCanvasClick()
    }
    if (activeTool === 'polyline') polylineTool.onCanvasClick(e)
    if (activeTool === 'pen') penTool.onCanvasClick()
    if (activeTool === 'text') textTool.onCanvasClick(e)
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

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const handleNativeWheel = (e: WheelEvent) => {
      // Prevent browser's native page zoom (Ctrl+Wheel / Pinch) and scrolling
      e.preventDefault()

      const rect = svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const newViewport = computeFocalZoom(
        viewport.zoom,
        viewport.panX,
        viewport.panY,
        mouseX,
        mouseY,
        e.deltaY
      )
      setViewport(newViewport)
    }

    svg.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleNativeWheel)
  }, [viewport, setViewport])

  const getCursor = () => {
    if (isPanning) return 'grabbing'
    if (isSpacePressed) return 'grab'
    return TOOL_CURSORS[activeTool] ?? 'default'
  }

  return (
    <main ref={canvasRef} className="relative flex-1 overflow-hidden bg-slate-200 transition-colors dark:bg-slate-950">

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="border border-slate-300 shadow-sm dark:border-slate-700"
        style={{
          cursor: getCursor(),
          backgroundColor: 'var(--canvas-background)',
        }}
        onMouseDown={handleSVGMouseDown}
        onMouseMove={handleSVGMouseMove}
        onMouseUp={handleSVGMouseUp}
        onClick={handleSVGClick}
        onDoubleClick={handleSVGDoubleClick}
      >

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
        
        <g transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}>
          <rect x="-50000" y="-50000" width="100000" height="100000" fill="url(#grid)" />

          <g id="artwork-layer">
            {elements.map((element) => (
              <ShapeRenderer
                key={element.id}
                element={element}
                activeTool={activeTool}
                renderedElement={renderedElements[element.id] as SVGTextElement | null | undefined}
                onTextRef={setRenderedTextRef}
                onElementMouseDown={selectTool.onElementMouseDown}
                onContextMenu={handleShapeContextMenu}
                onTextClick={(id) => {
                  selectElement(id)
                  setEditingTextId(id)
                }}
                isBeingEdited={element.id === editingTextId}
              />
            ))}
          </g>

          <SelectionOverlay
            elements={elements}
            selectedElementIds={
              editingTextId
                ? selectedElementIds.filter((id) => id !== editingTextId)
                : selectedElementIds
            }
            renderedElements={renderedElements}
          />

          {activeTool === 'select' && !editingTextId && (
            <ResizeHandles
              element={selectedElement}
              bounds={selectedBounds}
              resizeTool={resizeTool}
              rotateTool={rotateTool}
            />
          )}

          <DrawPreview
            rectTool={rectTool}
            ellipseTool={ellipseTool}
            lineTool={lineTool}
            polylineTool={polylineTool}
            penTool={penTool}
          />
        </g>

      </svg>

      {editingText && (
        <TextEditOverlay
          element={editingText}
          svgRef={svgRef}
        />
      )}

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