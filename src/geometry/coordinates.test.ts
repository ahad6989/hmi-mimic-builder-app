/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest'
import {
  toWorldPoint,
  toScreenPoint,
  toSVGPoint,
  computeFocalZoom,
  clampZoom,
  MIN_ZOOM,
  MAX_ZOOM,
} from './coordinates'

function createMockSVG(rect = { left: 100, top: 50, width: 800, height: 600 }): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.getBoundingClientRect = () => ({
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => {},
  })
  return svg
}

describe('coordinates', () => {
  describe('clampZoom', () => {
    it('clamps values below MIN_ZOOM', () => {
      expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    })

    it('clamps values above MAX_ZOOM', () => {
      expect(clampZoom(25)).toBe(MAX_ZOOM)
    })

    it('preserves valid zoom levels', () => {
      expect(clampZoom(1.5)).toBe(1.5)
    })
  })

  describe('toSVGPoint', () => {
    it('converts client coordinates to SVG-relative coordinates', () => {
      const svg = createMockSVG({ left: 50, top: 25, width: 800, height: 600 })
      const pt = toSVGPoint(150, 125, svg)
      expect(pt.x).toBe(100)
      expect(pt.y).toBe(100)
    })
  })

  describe('toWorldPoint and toScreenPoint without CTM (fallback mode)', () => {
    const svg = createMockSVG({ left: 100, top: 50, width: 800, height: 600 })

    it('Test A — Default zoom (zoom=1, pan=0)', () => {
      const clientX = 250
      const clientY = 150
      const world = toWorldPoint(clientX, clientY, svg, 1, 0, 0)
      // svgX = 250 - 100 = 150, svgY = 150 - 50 = 100
      expect(world.x).toBe(150)
      expect(world.y).toBe(100)

      const screen = toScreenPoint(world.x, world.y, svg, 1, 0, 0)
      expect(screen.x).toBe(clientX)
      expect(screen.y).toBe(clientY)
    })

    it('Test B — Zoom in at 200% (zoom=2, pan=0)', () => {
      const clientX = 300
      const clientY = 250
      const world = toWorldPoint(clientX, clientY, svg, 2, 0, 0)
      // svgX = 300 - 100 = 200, svgY = 250 - 50 = 200
      // worldX = 200 / 2 = 100, worldY = 200 / 2 = 100
      expect(world.x).toBe(100)
      expect(world.y).toBe(100)

      const screen = toScreenPoint(world.x, world.y, svg, 2, 0, 0)
      expect(screen.x).toBe(clientX)
      expect(screen.y).toBe(clientY)
    })

    it('Test C — Zoom out at 50% (zoom=0.5, pan=0)', () => {
      const clientX = 200
      const clientY = 150
      const world = toWorldPoint(clientX, clientY, svg, 0.5, 0, 0)
      // svgX = 100, svgY = 100
      // worldX = 100 / 0.5 = 200, worldY = 100 / 0.5 = 200
      expect(world.x).toBe(200)
      expect(world.y).toBe(200)

      const screen = toScreenPoint(world.x, world.y, svg, 0.5, 0, 0)
      expect(screen.x).toBe(clientX)
      expect(screen.y).toBe(clientY)
    })

    it('Test D — Pan (zoom=1, panX=150, panY=-80)', () => {
      const clientX = 350
      const clientY = 120
      const world = toWorldPoint(clientX, clientY, svg, 1, 150, -80)
      // svgX = 250, svgY = 70
      // worldX = (250 - 150) / 1 = 100, worldY = (70 - (-80)) / 1 = 150
      expect(world.x).toBe(100)
      expect(world.y).toBe(150)

      const screen = toScreenPoint(world.x, world.y, svg, 1, 150, -80)
      expect(screen.x).toBe(clientX)
      expect(screen.y).toBe(clientY)
    })

    it('Test E — Combined transformations (zoom=1.5, panX=80, panY=40)', () => {
      const clientX = 400
      const clientY = 250
      const world = toWorldPoint(clientX, clientY, svg, 1.5, 80, 40)
      // svgX = 300, svgY = 200
      // worldX = (300 - 80) / 1.5 = 220 / 1.5 ≈ 146.6667
      // worldY = (200 - 40) / 1.5 = 160 / 1.5 ≈ 106.6667
      expect(world.x).toBeCloseTo(146.6667, 3)
      expect(world.y).toBeCloseTo(106.6667, 3)

      const screen = toScreenPoint(world.x, world.y, svg, 1.5, 80, 40)
      expect(screen.x).toBeCloseTo(clientX, 4)
      expect(screen.y).toBeCloseTo(clientY, 4)
    })

    it('Test H — Round-trip conversion preserves arbitrary points', () => {
      const testCases = [
        { clientX: 100, clientY: 50, zoom: 1, panX: 0, panY: 0 },
        { clientX: 523.4, clientY: 341.8, zoom: 2.35, panX: -140.2, panY: 88.6 },
        { clientX: 899.9, clientY: 649.1, zoom: 0.333, panX: 420.5, panY: -210.3 },
      ]

      for (const tc of testCases) {
        const world = toWorldPoint(tc.clientX, tc.clientY, svg, tc.zoom, tc.panX, tc.panY)
        const roundTrip = toScreenPoint(world.x, world.y, svg, tc.zoom, tc.panX, tc.panY)
        expect(roundTrip.x).toBeCloseTo(tc.clientX, 4)
        expect(roundTrip.y).toBeCloseTo(tc.clientY, 4)
      }
    })
  })

  describe('with getScreenCTM matrix support', () => {
    function createCTMMockSVG(scale = 1.25, translateX = 100, translateY = 50): SVGSVGElement {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const matrix = {
        a: scale,
        b: 0,
        c: 0,
        d: scale,
        e: translateX,
        f: translateY,
        inverse: () => ({
          a: 1 / scale,
          b: 0,
          c: 0,
          d: 1 / scale,
          e: -translateX / scale,
          f: -translateY / scale,
        }),
      }

      svg.getScreenCTM = () => matrix as unknown as DOMMatrix
      svg.createSVGPoint = () => {
        const pt = {
          x: 0,
          y: 0,
          matrixTransform: (m: typeof matrix) => ({
            x: pt.x * m.a + pt.y * m.c + m.e,
            y: pt.x * m.b + pt.y * m.d + m.f,
          }),
        }
        return pt as unknown as DOMPoint
      }
      return svg
    }

    it('converts correctly and performs exact round-trip with CTM', () => {
      const svg = createCTMMockSVG(1.5, 60, 30)
      const clientX = 360
      const clientY = 210
      const zoom = 2
      const panX = 50
      const panY = 20

      const world = toWorldPoint(clientX, clientY, svg, zoom, panX, panY)
      // svgX = (360 - 60) / 1.5 = 200, svgY = (210 - 30) / 1.5 = 120
      // worldX = (200 - 50) / 2 = 75, worldY = (120 - 20) / 2 = 50
      expect(world.x).toBeCloseTo(75, 4)
      expect(world.y).toBeCloseTo(50, 4)

      const screen = toScreenPoint(world.x, world.y, svg, zoom, panX, panY)
      expect(screen.x).toBeCloseTo(clientX, 4)
      expect(screen.y).toBeCloseTo(clientY, 4)
    })
  })

  describe('computeFocalZoom', () => {
    it('keeps the world point under the cursor unchanged after zooming', () => {
      const currentZoom = 1
      const currentPanX = 100
      const currentPanY = 80
      const mouseX = 300
      const mouseY = 250

      // World point before zoom
      const worldXBefore = (mouseX - currentPanX) / currentZoom
      const worldYBefore = (mouseY - currentPanY) / currentZoom

      // Zoom in
      const nextViewport = computeFocalZoom(currentZoom, currentPanX, currentPanY, mouseX, mouseY, -100)
      expect(nextViewport.zoom).toBeGreaterThan(currentZoom)

      // World point after zoom
      const worldXAfter = (mouseX - nextViewport.panX) / nextViewport.zoom
      const worldYAfter = (mouseY - nextViewport.panY) / nextViewport.zoom

      expect(worldXAfter).toBeCloseTo(worldXBefore, 4)
      expect(worldYAfter).toBeCloseTo(worldYBefore, 4)
    })
  })
})
