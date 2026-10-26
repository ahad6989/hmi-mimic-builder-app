import { describe, it, expect } from 'vitest'
import {
  catmullRomToHandles,
  smoothPointStream,
  thinPoints,
} from './smoothing'
import { buildPathData } from '../types/canvas'

describe('smoothing', () => {
  describe('thinPoints', () => {
    it('keeps the first and last points always', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 0.1, y: 0 },
        { x: 0.2, y: 0 },
        { x: 10, y: 0 },
      ]
      const result = thinPoints(points, 3)
      expect(result[0]).toEqual({ x: 0, y: 0 })
      expect(result[result.length - 1]).toEqual({ x: 10, y: 0 })
      expect(result.length).toBe(2)
    })

    it('drops interior points closer than minDistance to the last kept point', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 6, y: 0 },
        { x: 7, y: 0 },
      ]
      const result = thinPoints(points, 3)
      // 0 kept; 1 and 2 dropped (within 3 of 0); 6 kept (distance 6);
      // 7 dropped as interior, but it IS the last point so it is kept.
      expect(result).toEqual([
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 7, y: 0 },
      ])
    })

    it('returns a copy of tiny inputs untouched', () => {
      const points = [{ x: 0, y: 0 }, { x: 1, y: 1 }]
      const result = thinPoints(points, 5)
      expect(result).toEqual(points)
      expect(result).not.toBe(points)
    })
  })

  describe('catmullRomToHandles', () => {
    it('leaves 2-point paths handle-free (straight segment)', () => {
      const result = catmullRomToHandles([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ])
      expect(result).toHaveLength(2)
      expect(result[0].handleOut).toBeUndefined()
      expect(result[1].handleIn).toBeUndefined()
    })

    it('produces exact cubic controls for a known configuration', () => {
      // Segment A→B: c1 = B + (C − A)/6 = (6,0) + (12,6)/6 = (8,1)
      const result = catmullRomToHandles([
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 12, y: 6 },
      ])
      expect(result[1].handleOut).toEqual({ x: 8, y: 1 })
      // Segment B→C: c2 = C − (C − B)/6 = (12,6) − (6,6)/6 = (11,5)
      expect(result[2].handleIn).toEqual({ x: 11, y: 5 })
    })

    it('mirrors in/out handles around interior anchors (smooth tangents)', () => {
      const result = catmullRomToHandles([
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 20, y: 0 },
        { x: 30, y: 8 },
      ])
      for (const index of [1, 2]) {
        const anchor = result[index]
        expect(anchor.handleOut).toBeDefined()
        expect(anchor.handleIn).toBeDefined()
        // handleIn = 2·anchor − handleOut for a uniform Catmull-Rom spline
        expect(anchor.handleIn!.x).toBeCloseTo(2 * anchor.x - anchor.handleOut!.x, 10)
        expect(anchor.handleIn!.y).toBeCloseTo(2 * anchor.y - anchor.handleOut!.y, 10)
      }
    })

    it('never sets a handleOut on the last anchor or handleIn on the first', () => {
      const result = catmullRomToHandles([
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 0 },
        { x: 15, y: 5 },
      ])
      expect(result[0].handleIn).toBeUndefined()
      expect(result[result.length - 1].handleOut).toBeUndefined()
    })
  })

  describe('smoothPointStream', () => {
    it('enforces the point cap on very long streams', () => {
      const raw = Array.from({ length: 2000 }, (_, i) => ({
        x: i * 0.5,
        y: Math.sin(i / 10) * 5,
      }))
      const result = smoothPointStream(raw, { minDistance: 0.1, maxPoints: 100 })
      expect(result.length).toBeLessThanOrEqual(100)
      expect(result.length).toBeGreaterThanOrEqual(2)
      // Endpoints of the stroke survive decimation.
      expect(result[0].x).toBe(0)
      expect(result[result.length - 1].x).toBeCloseTo(1999 * 0.5, 10)
    })

    it('emits valid path data with one cubic per segment', () => {
      const raw = [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 20, y: 2 },
        { x: 30, y: 12 },
        { x: 40, y: 6 },
      ]
      const smoothed = smoothPointStream(raw, { minDistance: 1, maxPoints: 500 })
      const data = buildPathData(smoothed)

      expect(data.startsWith('M 0 0')).toBe(true)
      const cubicCount = (data.match(/C /g) ?? []).length
      expect(cubicCount).toBe(smoothed.length - 1)
      expect(data).not.toContain('L ')
    })
  })
})