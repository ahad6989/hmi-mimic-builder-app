import type { CanvasElement } from '../types/canvas'
import { jsPDF } from 'jspdf'
import { getElementBounds } from '../geometry/bounds'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const CSS_VAR_PATTERN = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+)\s*)?\)$/

/**
 * Resolves CSS custom property references (e.g. "var(--canvas-default-fill)")
 * to their actual computed color values.
 *
 * Exported SVG/PNG/JPEG/PDF files are standalone — they have no access to the
 * application's CSS variables, so any var(...) reference would render blank.
 * This function resolves them at export time using getComputedStyle, matching
 * whatever the element actually looks like on screen in the current theme.
 */
function resolveColor(value: string): string {
  if (!value.startsWith('var(')) return value

  const match = value.match(CSS_VAR_PATTERN)
  if (!match) return value

  const varName = match[1]
  const fallback = match[2] !== undefined ? resolveColor(match[2]) : ''

  // CSS variables are defined on :root (light mode) and overridden on .dark.
  // The app applies .dark to its root div — not to <html> — so we target it.
  const target = document.querySelector('.dark') ?? document.documentElement
  const resolved = getComputedStyle(target).getPropertyValue(varName).trim()

  if (resolved) return resolved
  return fallback
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
}

function attribute(name: string, value: string | number): string {
  return `${name}="${escapeXml(String(value))}"`
}

function styleAttributes(element: CanvasElement): string {
  const { style } = element
  return [
    attribute('fill', resolveColor(style.fill)),
    attribute('fill-opacity', style.fillOpacity),
    attribute('stroke', resolveColor(style.stroke)),
    attribute('stroke-opacity', style.strokeOpacity),
    attribute('stroke-width', style.strokeWidth),
    attribute('opacity', style.opacity),
    attribute('stroke-dasharray', style.strokeDashArray),
    attribute('stroke-linecap', style.strokeLineCap),
    attribute('stroke-linejoin', style.strokeLineJoin),
  ].join(' ')
}

function elementMarkup(element: CanvasElement): string {
  const style = styleAttributes(element)
  const { transform } = element
  const bounds = getElementBounds(element)
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const rotation = attribute(
    'transform',
    `rotate(${transform.rotation ?? 0} ${centerX} ${centerY})`
  )

  switch (element.type) {
    case 'rect':
      return `<rect ${[
        attribute('x', transform.x),
        attribute('y', transform.y),
        attribute('width', transform.width),
        attribute('height', transform.height),
        element.rx !== undefined ? attribute('rx', element.rx) : '',
        element.ry !== undefined ? attribute('ry', element.ry) : '',
        rotation,
        style,
      ].filter(Boolean).join(' ')} />`

    case 'ellipse':
      return `<ellipse ${[
        attribute('cx', transform.x + transform.width / 2),
        attribute('cy', transform.y + transform.height / 2),
        attribute('rx', transform.width / 2),
        attribute('ry', transform.height / 2),
        rotation,
        style,
      ].join(' ')} />`

    case 'line':
      return `<line ${[
        attribute('x1', element.x1 ?? 0),
        attribute('y1', element.y1 ?? 0),
        attribute('x2', element.x2 ?? 0),
        attribute('y2', element.y2 ?? 0),
        rotation,
        style,
      ].join(' ')} />`

    case 'polyline':
      return `<polyline ${[
        attribute('points', (element.points ?? []).map((point) => `${point.x},${point.y}`).join(' ')),
        rotation,
        style,
      ].join(' ')} />`

    case 'path':
      return `<path ${[
        attribute('d', element.pathData ?? ''),
        rotation,
        style,
      ].join(' ')} />`

    case 'text':
      return `<text ${[
        attribute('x', transform.x),
        attribute('y', transform.y),
        attribute('fill', resolveColor(element.textStyle.color)),
        attribute('font-family', element.textStyle.fontFamily),
        attribute('font-size', element.textStyle.fontSize),
        attribute('font-weight', element.textStyle.fontWeight),
        attribute('font-style', element.textStyle.fontStyle),
        attribute('text-decoration', element.textStyle.textDecoration),
        rotation,
      ].join(' ')}>${escapeXml(element.textStyle.content)}</text>`

    default:
      return ''
  }
}

export function exportToSVG(
  elements: CanvasElement[],
  canvasWidth: number,
  canvasHeight: number
): string {
  const markup = elements
    .map(elementMarkup)
    .filter(Boolean)
    .join('\n  ')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg ${[
      attribute('xmlns', SVG_NAMESPACE),
      attribute('width', canvasWidth),
      attribute('height', canvasHeight),
      attribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`),
    ].join(' ')}>`,
    markup ? `  ${markup}` : '',
    '</svg>',
  ].filter((line) => line !== '').join('\n')
}

export function exportToPNG(
  elements: CanvasElement[],
  canvasWidth: number,
  canvasHeight: number,
  backgroundColor?: string
): Promise<Blob> {
  return renderSVGToCanvas(elements, canvasWidth, canvasHeight, backgroundColor)
    .then((canvas) => canvasToBlob(canvas, 'image/png'))
}

export function exportToJPEG(
  elements: CanvasElement[],
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  quality = 0.92
): Promise<Blob> {
  return renderSVGToCanvas(elements, canvasWidth, canvasHeight, '#ffffff', scale)
    .then((canvas) => canvasToBlob(canvas, 'image/jpeg', quality))
}

export function exportToPDF(
  elements: CanvasElement[],
  canvasWidth: number,
  canvasHeight: number,
  scale: number
): Promise<Blob> {
  const pageWidth = canvasWidth * scale
  const pageHeight = canvasHeight * scale

  return renderSVGToCanvas(elements, canvasWidth, canvasHeight, '#ffffff', scale)
    .then((canvas) => {
      const imageData = canvas.toDataURL('image/png')
      const orientation = pageWidth >= pageHeight ? 'landscape' : 'portrait'
      const document = new jsPDF({
        orientation,
        unit: 'pt',
        format: [pageWidth, pageHeight],
      })
      document.addImage(imageData, 'PNG', 0, 0, pageWidth, pageHeight)
      return document.output('blob')
    })
}

function renderSVGToCanvas(
  elements: CanvasElement[],
  canvasWidth: number,
  canvasHeight: number,
  backgroundColor?: string,
  scale = 1
): Promise<HTMLCanvasElement> {
  const svg = exportToSVG(elements, canvasWidth, canvasHeight)
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' })
  const svgUrl = URL.createObjectURL(svgBlob)
  const outputWidth = canvasWidth * scale
  const outputHeight = canvasHeight * scale

  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(svgUrl)

      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = outputHeight

      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Unable to create a 2D canvas context'))
        return
      }

      if (backgroundColor) {
        context.fillStyle = backgroundColor
        context.fillRect(0, 0, outputWidth, outputHeight)
      }

      context.drawImage(image, 0, 0, outputWidth, outputHeight)
      resolve(canvas)
    }

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl)
      reject(new Error('Unable to load the SVG for PNG export'))
    }

    image.src = svgUrl
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: 'image/png' | 'image/jpeg',
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error(`Unable to encode the canvas as ${type}`))
    }, type, quality)
  })
}
