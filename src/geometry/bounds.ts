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
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      } catch {
        // The SVG node may not be measurable until it is attached to the document.
      }
    }

    const fontSize = element.textStyle?.fontSize ?? 16
    const content = element.textStyle?.content ?? ''
    return {
      x: element.transform.x,
      y: element.transform.y - fontSize,
      width: Math.max(fontSize * 0.6, content.length * fontSize * 0.6),
      height: fontSize * 1.2,
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
