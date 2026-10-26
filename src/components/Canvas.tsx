// =============================================================================
// Canvas.tsx — The SVG drawing surface
// =============================================================================

import { useCallback, useRef, useState, useEffect } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { getElementBounds } from '../geometry/bounds'
import { computeFocalZoom, toSVGPoint, toWorldPoint } from '../geometry/coordinates'
import { useSelectTool } from '../tools/useSelectTool'
import { useRectTool } from '../tools/useRectTool'
import { useEllipseTool } from '../tools/useEllipseTool'
import { useLineTool } from '../tools/useLineTool'
import { usePolylineTool } from '../tools/usePolylineTool'
import { usePenTool } from '../tools/usePenTool'
import { usePencilTool } from '../tools/usePencilTool'
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

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const GRID_SIZE = 20

const TOOL_CURSORS: Record<string, string> = {
  select: 'default',
  pan: 'grab',
  rect: 'crosshair',
  ellipse: 'crosshair',
  line: 'crosshair',
  polyline: 'crosshair',
  pen: 'crosshair',
  pencil: 'crosshair',
  text: 'text',
}

function Canvas() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const elements = useEditorStore((s) => s.elements)
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const selectElement = useEditorStore((s) => s.selectElement)
  const deleteElement = useEditorStore((s) => s.deleteElement)
  const bringToFront = useEditorStore((s) => s.bringToFront)
  const sendToBack = useEditorStore((s) => s.sendToBack)
  const bringForward = useEditorStore((s) => s.bringForward)
  const sendBackward = useEditorStore((s) => s.sendBackward)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const editingTextId = useEditorStore((s) => s.editingTextId)
  const setEditingTextId = useEditorStore((s) => s.setEditingTextId)
  const viewport = useEditorStore((s) => s.viewport)
  const setViewport = useEditorStore((s) => s.setViewport)

  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  const isSpacePressedRef = useRef(false)
  const panStateRef = useRef({
    isPanning: false,
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  })

  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [renderedElements, setRenderedElements] = useState<Record<string, SVGGraphicsElement | null>>({})

  const selectTool = useSelectTool(svgRef, renderedElements)
  const rectTool = useRectTool(svgRef)
  const ellipseTool = useEllipseTool(svgRef)
  const lineTool = useLineTool(svgRef)
  const polylineTool = usePolylineTool(svgRef)
  const penTool = usePenTool(svgRef)
  const pencilTool = usePencilTool(svgRef)
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
    pencilTool,
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
      if ((e.code === 'Space' || e.key === ' ') && !editingTextId) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        if (!isSpacePressedRef.current) {
          isSpacePressedRef.current = true
          setIsSpacePressed(true)
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        isSpacePressedRef.current = false
        setIsSpacePressed(false)
        if (panStateRef.current.isPanning) {
          panStateRef.current.isPanning = false
          setIsPanning(false)
        }
      }
    }
    const handleBlur = () => {
      isSpacePressedRef.current = false
      setIsSpacePressed(false)
      if (panStateRef.current.isPanning) {
        panStateRef.current.isPanning = false
        setIsPanning(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [editingTextId])

  useEffect(() => {
    const handlePointerUp = () => {
      if (panStateRef.current.isPanning) {
        panStateRef.current.isPanning = false
        setIsPanning(false)
      }
    }
    window.addEventListener('pointerup', handlePointerUp)
    return () => window.removeEventListener('pointerup', handlePointerUp)
  }, [])

  // Finalise pointer gestures when the mouse is released OUTSIDE the SVG
  // (e.g. a marquee, shape drag or pencil stroke that ends over the Inspector).
  // The window listener runs AFTER the SVG's own handler (the React root is
  // deeper in the tree), so any already-handled gesture sees a null ref/state
  // and the second call is a harmless no-op.
  const handleWindowMouseUp = () => {
    selectTool.onMouseUp()
    penTool.onMouseUp()
    pencilTool.onMouseUp()
  }
  useEffect(() => {
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => window.removeEventListener('mouseup', handleWindowMouseUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callback identity kept stable on purpose
  }, [selectTool.onMouseUp, penTool.onMouseUp, pencilTool.onMouseUp])


  const handleSVGMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || isSpacePressedRef.current || (activeTool === 'pan' && e.button === 0)) {
      const currentViewport = useEditorStore.getState().viewport
      panStateRef.current = {
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: currentViewport.panX,
        initialPanY: currentViewport.panY,
      }
      setIsPanning(true)
      return
    }

    if (activeTool === 'rect') rectTool.onMouseDown(e)
    if (activeTool === 'ellipse') ellipseTool.onMouseDown(e)
    if (activeTool === 'line') lineTool.onMouseDown(e)
    if (activeTool === 'pen') penTool.onMouseDown(e)
    if (activeTool === 'pencil') pencilTool.onMouseDown(e)
    // Select tool: pressing on EMPTY canvas starts a marquee selection.
    // (Shape presses never reach here — shapes stopPropagation on mousedown.)
    if (activeTool === 'select') selectTool.onCanvasMouseDown(e)
  }

  const handleSVGMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (panStateRef.current.isPanning) {
      const ctm = svgRef.current?.getScreenCTM()
      const scaleFactor = ctm ? ctm.a : 1
      const dx = (e.clientX - panStateRef.current.startX) / scaleFactor
      const dy = (e.clientY - panStateRef.current.startY) / scaleFactor
      const currentViewport = useEditorStore.getState().viewport
      setViewport({ ...currentViewport, panX: panStateRef.current.initialPanX + dx, panY: panStateRef.current.initialPanY + dy })
      return
    }

    const svg = svgRef.current
    if (svg) {
      const currentViewport = useEditorStore.getState().viewport
      const pt = toWorldPoint(e.clientX, e.clientY, svg, currentViewport.zoom, currentViewport.panX, currentViewport.panY)
      setMousePosition({ x: Math.round(pt.x), y: Math.round(pt.y) })
    }

    if (activeTool === 'rect') rectTool.onMouseMove(e)
    if (activeTool === 'ellipse') ellipseTool.onMouseMove(e)
    if (activeTool === 'line') lineTool.onMouseMove(e)
    if (activeTool === 'polyline') polylineTool.onMouseMove(e)
    if (activeTool === 'pen') penTool.onMouseMove(e)
    if (activeTool === 'pencil') pencilTool.onMouseMove(e)

    if (activeTool === 'select') {
      resizeTool.onMouseMove(e)
      rotateTool.onMouseMove(e)
      selectTool.onMouseMove(e)
    }
  }

  const handleSVGMouseUp = () => {
    if (panStateRef.current.isPanning) {
      panStateRef.current.isPanning = false
      setIsPanning(false)
      return
    }

    if (activeTool === 'rect') rectTool.onMouseUp()
    if (activeTool === 'ellipse') ellipseTool.onMouseUp()
    if (activeTool === 'line') lineTool.onMouseUp()
    if (activeTool === 'pen') penTool.onMouseUp()
    if (activeTool === 'pencil') pencilTool.onMouseUp()

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
    // Preserve an existing multi-selection when right-clicking one of its
    // members (needed for group actions like delete / arrange).
    const currentSelection = useEditorStore.getState().selectedElementIds
    if (!currentSelection.includes(id)) {
      selectElement(id)
    }

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

      const currentViewport = useEditorStore.getState().viewport

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+Scroll = ZOOM
        const svgPt = toSVGPoint(e.clientX, e.clientY, svg)

        const newViewport = computeFocalZoom(
          currentViewport.zoom,
          currentViewport.panX,
          currentViewport.panY,
          svgPt.x,
          svgPt.y,
          e.deltaY
        )
        setViewport(newViewport)
      } else {
        // Two-finger trackpad scroll or standard mouse wheel = PAN
        const ctm = svg.getScreenCTM()
        const scaleFactor = ctm ? ctm.a : 1
        const dx = (e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX) / scaleFactor
        const dy = (e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY) / scaleFactor

        setViewport({
          ...currentViewport,
          panX: currentViewport.panX - dx,
          panY: currentViewport.panY - dy
        })
      }
    }

    svg.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleNativeWheel)
  }, [setViewport])

  const getCursor = () => {
    if (isPanning) return 'grabbing'
    if (isSpacePressed || activeTool === 'pan') return 'grab'
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

          {/* Marquee (rubber-band) selection rectangle — world space, so it
              tracks zoom/pan; stroke width divided by zoom keeps it a constant
              thickness on screen. */}
          {selectTool.marquee && (
            <rect
              x={selectTool.marquee.x}
              y={selectTool.marquee.y}
              width={selectTool.marquee.width}
              height={selectTool.marquee.height}
              fill="rgba(37, 99, 235, 0.08)"
              stroke="#2563eb"
              strokeWidth={1.5 / viewport.zoom}
              pointerEvents="none"
            />
          )}

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
            pencilTool={pencilTool}
          />

          {/* ── Figma-style Smart Guides ──────────────────────────────────────
              Rendered ABOVE artwork so they are always visible.
              • World-space coordinates → correct at every zoom / pan level.
              • strokeWidth divided by zoom keeps them ~1 CSS px on screen.
              • pointerEvents="none" → guides never intercept mouse events.
              • data-smart-guide attribute → exportSvg skips this entire group.
          ─────────────────────────────────────────────────────────────────── */}
          {selectTool.smartGuides && selectTool.smartGuides.length > 0 && (
            <g
              id="smart-guides-overlay"
              pointerEvents="none"
              data-smart-guide="true"
            >
              {selectTool.smartGuides.map((guide, i) => {
                const GUIDE_PAD = 8 / viewport.zoom   // small overrun past object edges
                const sw = 1 / viewport.zoom           // constant 1px screen width
                if (guide.axis === 'x') {
                  // Vertical guide line (constant X, spans Y from start to end)
                  return (
                    <line
                      key={i}
                      x1={guide.value}
                      y1={guide.start - GUIDE_PAD}
                      x2={guide.value}
                      y2={guide.end + GUIDE_PAD}
                      stroke="#e040fb"
                      strokeWidth={sw}
                      pointerEvents="none"
                      data-smart-guide="true"
                    />
                  )
                } else {
                  // Horizontal guide line (constant Y, spans X from start to end)
                  return (
                    <line
                      key={i}
                      x1={guide.start - GUIDE_PAD}
                      y1={guide.value}
                      x2={guide.end + GUIDE_PAD}
                      y2={guide.value}
                      stroke="#e040fb"
                      strokeWidth={sw}
                      pointerEvents="none"
                      data-smart-guide="true"
                    />
                  )
                }
              })}
            </g>
          )}
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