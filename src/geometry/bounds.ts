import type { CanvasElement } from '../types/canvas'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export function getElementBounds(element: CanvasElement): Bounds {
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
