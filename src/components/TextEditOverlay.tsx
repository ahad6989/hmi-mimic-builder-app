import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useEditorStore } from '../store/EditorStore'
import type { CanvasElement } from '../types/canvas'

const MIN_WIDTH = 20
const MIN_HEIGHT = 24
const MAX_WIDTH = 800

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

interface TextEditOverlayProps {
  element: CanvasElement
  svgRef: RefObject<SVGSVGElement | null>
}

function TextEditOverlay({ element, svgRef }: TextEditOverlayProps) {
  const updateElement = useEditorStore((state) => state.updateElement)
  const setEditingTextId = useEditorStore((state) => state.setEditingTextId)
  const editableRef = useRef<HTMLDivElement>(null)
  const hasCommittedRef = useRef(false)
  const hasFocusedRef = useRef(false)
  // Ensures we measure the actual rendered div only once after it first appears.
  const hasMeasuredRef = useRef(false)
  const textStyle = element.textStyle

  // ── SVG → screen scale factor ─────────────────────────────────────────────
  // The SVG viewBox may be larger/smaller than the element's CSS pixel size.
  // ctm.a is the uniform scale factor (x === y for non-skewed SVGs).
  // We multiply every SVG user-unit length by this to get CSS px.
  const [scale, setScale] = useState(1)

  // ── Overlay dimensions (CSS px, already scaled) ───────────────────────────
  const [size, setSize] = useState({ width: MIN_WIDTH, height: MIN_HEIGHT })

  // ── Screen-space anchor position ──────────────────────────────────────────
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  // Derive scale from the SVG's current transform matrix.
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    setScale(ctm.a)
  }, [svgRef])

  // Measure the rendered size of the contentEditable div.
  const measure = () => {
    const el = editableRef.current
    if (!el) return
    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, el.scrollWidth))
    const height = Math.max(MIN_HEIGHT, el.scrollHeight)
    setSize({ width, height })
  }

  // Step C – once the div is in the DOM (position flips from null → value),
  // measure it once to get the real content size and feed it into Step B.
  useLayoutEffect(() => {
    if (!position || hasMeasuredRef.current || !editableRef.current) return
    hasMeasuredRef.current = true
    measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position])

  // Focus once, caret at the end of existing text.
  useEffect(() => {
    if (!position || hasFocusedRef.current || !editableRef.current) return
    hasFocusedRef.current = true
    editableRef.current.focus()
    placeCaretAtEnd(editableRef.current)
  }, [position])

  // Keep the overlay CENTERED on element.transform.x/y in screen space.
  // This mirrors how ShapeRenderer centers the committed SVG text on the same
  // anchor point, so there is no jump on commit.
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) { setPosition(null); return }

    const pt = svg.createSVGPoint()
    pt.x = element.transform.x
    pt.y = element.transform.y
    const ctm = svg.getScreenCTM()
    if (!ctm) { setPosition(null); return }

    const screenPoint = pt.matrixTransform(ctm)
    setPosition({
      left: screenPoint.x - size.width / 2,
      top: screenPoint.y - size.height / 2,
    })
  }, [size, scale, element.transform.x, element.transform.y, svgRef])

  const commit = () => {
    if (hasCommittedRef.current) return
    hasCommittedRef.current = true
    const content = editableRef.current?.innerText ?? ''
    updateElement(element.id, {
      textStyle: { ...textStyle, content },
    })
    setEditingTextId(null)
  }

  if (!position) return null

  // Scale SVG user-unit font size → CSS px so the overlay text matches the
  // size of the committed SVG text at whatever zoom the canvas is at.
  const scaledFontSize = textStyle.fontSize * scale

  return createPortal(
    <div
      ref={editableRef}
      contentEditable
      suppressContentEditableWarning
      onInput={measure}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        // Enter inserts a real newline — normal multi-line text box.
      }}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label="Edit text"
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
        padding: 0,
        border: '1px dashed #94a3b8',
        outline: 'none',
        background: 'transparent',
        boxShadow: 'none',
        color: textStyle.color,
        fontFamily: textStyle.fontFamily,
        // Use the screen-scaled font size so overlay matches SVG text size.
        fontSize: scaledFontSize,
        fontWeight: textStyle.fontWeight,
        fontStyle: textStyle.fontStyle,
        textDecoration: textStyle.textDecoration,
        lineHeight: 1.4,
        textAlign: 'center',
        whiteSpace: 'pre-wrap',
        wordBreak: 'normal',
        overflowWrap: 'normal',
        boxSizing: 'border-box',
        zIndex: 40,
      }}
    >
      {element.textStyle.content}
    </div>,
    document.body
  )
}

export default TextEditOverlay