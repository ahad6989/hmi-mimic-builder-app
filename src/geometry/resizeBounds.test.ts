/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest'
import { toLocalPoint } from '../tools/useResizeTool'
import { getElementBounds } from './bounds'
import { createTextElement, createRectElement } from '../types/canvas'
import { exportToSVG } from '../utils/exportSvg'

describe('toLocalPoint (inverse rotation transformation)', () => {
  const bounds = { x: 100, y: 100, width: 200, height: 100 }
  const cx = bounds.x + bounds.width / 2 // 200
  const cy = bounds.y + bounds.height / 2 // 150

  it('preserves point when rotation is 0', () => {
    const pt = { x: 250, y: 120 }
    const local = toLocalPoint(pt, bounds, 0)
    expect(local.x).toBe(pt.x)
    expect(local.y).toBe(pt.y)
  })

  it('correctly counter-rotates point at 90 degrees', () => {
    // A point at (cx, cy - 50) rotated +90deg lands at (cx + 50, cy)
    const rotatedPoint = { x: cx + 50, y: cy }
    const local = toLocalPoint(rotatedPoint, bounds, 90)
    expect(local.x).toBeCloseTo(cx, 4)
    expect(local.y).toBeCloseTo(cy - 50, 4)
  })

  it('correctly counter-rotates point at 45 degrees', () => {
    const angle = (45 * Math.PI) / 180
    const originalLocal = { x: cx + 40, y: cy + 30 }
    const dx = originalLocal.x - cx
    const dy = originalLocal.y - cy
    // Forward rotated:
    const rotated = {
      x: dx * Math.cos(angle) - dy * Math.sin(angle) + cx,
      y: dx * Math.sin(angle) + dy * Math.cos(angle) + cy,
    }
    const local = toLocalPoint(rotated, bounds, 45)
    expect(local.x).toBeCloseTo(originalLocal.x, 4)
    expect(local.y).toBeCloseTo(originalLocal.y, 4)
  })

  it('correctly counter-rotates point at 180 degrees', () => {
    const originalLocal = { x: cx + 30, y: cy - 20 }
    // 180deg flips relative to center
    const rotated = { x: cx - 30, y: cy + 20 }
    const local = toLocalPoint(rotated, bounds, 180)
    expect(local.x).toBeCloseTo(originalLocal.x, 4)
    expect(local.y).toBeCloseTo(originalLocal.y, 4)
  })
})

describe('getElementBounds for text', () => {
  it('centers fallback bounding box around transform.x and transform.y', () => {
    const textEl = createTextElement(200, 150)
    textEl.textStyle.content = 'Hello'
    textEl.textStyle.fontSize = 20

    const bounds = getElementBounds(textEl)
    // Horizontal midpoint of bounds should equal transform.x (200)
    expect(bounds.x + bounds.width / 2).toBeCloseTo(200, 4)
    // Vertical midpoint of bounds should equal transform.y (150)
    expect(bounds.y + bounds.height / 2).toBeCloseTo(150, 4)
  })
})

describe('SVG stroke attributes on rect and ellipse', () => {
  it('exports and renders stroke dash, cap, join, and opacity', () => {
    const rect = createRectElement(10, 10, 100, 50, {
      strokeDashArray: '6 4',
      strokeLineCap: 'round',
      strokeLineJoin: 'bevel',
      strokeOpacity: 0.5,
    })

    const svg = exportToSVG([rect], 800, 600)
    expect(svg).toContain('stroke-dasharray="6 4"')
    expect(svg).toContain('stroke-linecap="round"')
    expect(svg).toContain('stroke-linejoin="bevel"')
    expect(svg).toContain('stroke-opacity="0.5"')
  })
})
