import type { CanvasElement } from '../types/canvas'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export function getElementBounds(
  element: CanvasElement,
  renderedElement?: SVGGraphicsElement | null
): Bounds {
  if (element.type === 'text') {
    if (renderedElement) {
      try {
        const box = renderedElement.getBBox()
        if (box && box.width > 0 && box.height > 0) {
          return { x: box.x, y: box.y, width: box.width, height: box.height }
        }
      } catch {
        // The SVG node may not be measurable until it is attached to the document.
      }
    }

    const fontSize = element.textStyle?.fontSize ?? 16
    const content = element.textStyle?.content ?? ''
    const lines = content.split('\n')
    const maxLineLen = lines.reduce((max, line) => Math.max(max, line.length), 0)
    const width = Math.max(fontSize * 0.6, maxLineLen * fontSize * 0.6)
    const lineHeight = fontSize * 1.4
    const totalHeight = Math.max(fontSize, lines.length * lineHeight)
    return {
      x: element.transform.x - width / 2,
      y: element.transform.y - totalHeight / 2,
      width,
      height: totalHeight,
    }
  }

  if ((element.type === 'polyline' || element.type === 'path') && element.points && element.points.length > 0) {
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

export function normalizeBounds(b: Bounds): { minX: number; maxX: number; minY: number; maxY: number } {
  const minX = Math.min(b.x, b.x + b.width)
  const maxX = Math.max(b.x, b.x + b.width)
  const minY = Math.min(b.y, b.y + b.height)
  const maxY = Math.max(b.y, b.y + b.height)
  return { minX, maxX, minY, maxY }
}

export function boxesIntersect(a: Bounds, b: Bounds): boolean {
  const normA = normalizeBounds(a)
  const normB = normalizeBounds(b)
  return (
    normA.minX <= normB.maxX &&
    normA.maxX >= normB.minX &&
    normA.minY <= normB.maxY &&
    normA.maxY >= normB.minY
  )
}

export function getRotatedAABB(bounds: Bounds, rotationDeg: number = 0): Bounds {
  if (!rotationDeg) return bounds
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2

  const halfW = bounds.width / 2
  const halfH = bounds.height / 2

  const corners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ]

  const rotated = corners.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }))

  const xs = rotated.map((p) => p.x)
  const ys = rotated.map((p) => p.y)

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Union (smallest enclosing) AABB of a list of bounds.
 * Used for multi-selection drag snapping: the moving group behaves as one
 * object whose edges/centres are the union's edges/centres, so a group of
 * shapes aligns exactly like a single shape would.
 *
 * Returns a zero-sized bounds at the origin for an empty list.
 */
export function unionBounds(boundsList: Bounds[]): Bounds {
  if (boundsList.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const bounds of boundsList) {
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
