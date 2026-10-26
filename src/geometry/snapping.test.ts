import { describe, it, expect } from 'vitest'
import {
  SCREEN_SNAP_TOLERANCE_PX,
  collectSnapLines,
  snapAxisValue,
  snapMoveDelta,
  snapPoint,
  worldSnapTolerance,
  type SnapSettings,
} from './snapping'
import { createRectElement, type CanvasElement } from '../types/canvas'

const grid8: SnapSettings = { snapToGrid: true, gridSize: 8, snapToObjects: false }
const grid16: SnapSettings = { snapToGrid: true, gridSize: 16, snapToObjects: false }
const objectsOnly: SnapSettings = { snapToGrid: false, gridSize: 8, snapToObjects: true }
const both: SnapSettings = { snapToGrid: true, gridSize: 8, snapToObjects: true }
const off: SnapSettings = { snapToGrid: false, gridSize: 8, snapToObjects: false }

function makeRect(id: string, x: number, y: number, width: number, height: number): CanvasElement {
  return { ...createRectElement(x, y, width, height), id }
}

describe('snapping', () => {
  describe('worldSnapTolerance', () => {
    it('converts the screen tolerance to world units using zoom', () => {
      expect(SCREEN_SNAP_TOLERANCE_PX).toBe(6)
      expect(worldSnapTolerance(1)).toBe(6)
      expect(worldSnapTolerance(2)).toBe(3)
      expect(worldSnapTolerance(0.5)).toBe(12)
    })

    it('falls back to zoom=1 for invalid zoom values', () => {
      expect(worldSnapTolerance(0)).toBe(6)
      expect(worldSnapTolerance(-3)).toBe(6)
    })
  })

  describe('grid snapping', () => {
    it('snaps to the nearest 8px grid line', () => {
      const result = snapPoint({ x: 11, y: 27 }, [], grid8, 1)
      expect(result).toEqual({ x: 8, y: 24 })
    })

    it('snaps to the nearest 16px grid line', () => {
      const result = snapPoint({ x: 14, y: 29 }, [], grid16, 1)
      expect(result).toEqual({ x: 16, y: 32 })
    })

    it('leaves exact grid points untouched', () => {
      const result = snapPoint({ x: 16, y: 32 }, [], grid8, 1)
      expect(result).toEqual({ x: 16, y: 32 })
    })

    it('does nothing when all snapping is disabled', () => {
      const result = snapPoint({ x: 11, y: 27 }, [], off, 1)
      expect(result).toEqual({ x: 11, y: 27 })
    })

    it('respects the tolerance instead of always snapping', () => {
      // Distance to nearest 8-grid line is 3.9 — inside tol 4, outside tol 3.
      const inside = snapAxisValue(11.9, [], grid8, 4)
      expect(inside?.value).toBe(8)
      expect(inside?.kind).toBe('grid')

      const outside = snapAxisValue(11.9, [], grid8, 3)
      expect(outside).toBeNull()
    })

    it('accounts for zoom: the world tolerance shrinks as we zoom in', () => {
      // zoom 1 → tolerance 8 world units: every point is within 4 of an 8-grid line.
      expect(snapPoint({ x: 11, y: 0 }, [], grid8, 1).x).toBe(8)
      // zoom 4 → tolerance 2: distance 3 to the nearest line is now too far.
      expect(snapPoint({ x: 11, y: 0 }, [], grid8, 4).x).toBe(11)
      // ...but a point 1 unit away still snaps at zoom 4.
      expect(snapPoint({ x: 9, y: 0 }, [], grid8, 4).x).toBe(8)
    })
  })

  describe('object snapping', () => {
    const rect = makeRect('a', 100, 50, 40, 30) // x: 100/120/140, y: 50/65/80

    it('collects edge and centre lines per axis', () => {
      const lines = collectSnapLines([rect])
      const xValues = lines.filter((l) => l.axis === 'x').map((l) => l.value)
      const yValues = lines.filter((l) => l.axis === 'y').map((l) => l.value)
      expect(xValues).toEqual([100, 120, 140])
      expect(yValues).toEqual([50, 65, 80])
      expect(lines.filter((l) => l.kind === 'center')).toHaveLength(2)
    })

    it('snaps a point to nearby edges and centres', () => {
      const result = snapPoint({ x: 138, y: 52 }, [rect], objectsOnly, 1)
      expect(result).toEqual({ x: 140, y: 50 }) // right edge, top edge
    })

    it('snaps to a centre line when it is closest', () => {
      const result = snapPoint({ x: 118, y: 63 }, [rect], objectsOnly, 1)
      expect(result).toEqual({ x: 120, y: 65 })
    })

    it('never snaps to excluded (moving) objects', () => {
      const result = snapPoint({ x: 138, y: 52 }, [rect], objectsOnly, 1, ['a'])
      expect(result).toEqual({ x: 138, y: 52 })
    })

    it('does not consider object lines when object snapping is off', () => {
      const result = snapPoint({ x: 138, y: 52 }, [rect], grid8, 1)
      // Grid still applies (138 → 136, 52 → 56) but no object edges appear.
      expect(result).toEqual({ x: 136, y: 56 })
    })
  })

  describe('multiple nearby targets (deterministic priority)', () => {
    const xLine = (value: number, kind: 'edge' | 'center' = 'edge') => ({
      axis: 'x' as const,
      value,
      kind,
      elementId: 'a',
    })

    it('picks the closest target', () => {
      const snap = snapAxisValue(137, [xLine(130), xLine(136)], objectsOnly, 8)
      expect(snap?.value).toBe(136)
    })

    it('breaks exact distance ties in favour of object lines over grid', () => {
      // Value 10: grid line at 8 (distance 2) and object edge at 12 (distance 2).
      const snap = snapAxisValue(10, [xLine(12)], both, 8)
      expect(snap?.value).toBe(12)
      expect(snap?.kind).toBe('edge')
    })

    it('breaks exact distance ties in favour of centres over edges', () => {
      const snap = snapAxisValue(12, [xLine(11, 'edge'), xLine(13, 'center')], objectsOnly, 8)
      expect(snap?.value).toBe(13)
      expect(snap?.kind).toBe('center')
    })

    it('breaks remaining ties deterministically with the smaller value', () => {
      const snap = snapAxisValue(140, [xLine(141), xLine(139)], objectsOnly, 8)
      expect(snap?.value).toBe(139)
    })
  })

  describe('snapMoveDelta', () => {
    const bounds = { x: 100, y: 50, width: 40, height: 30 }

    it('returns the raw delta untouched when snapping is off', () => {
      const result = snapMoveDelta(bounds, 6.5, -2, [], off, 1)
      expect(result).toEqual({ deltaX: 6.5, deltaY: -2 })
    })

    it('snaps the best of left / centre / right to the grid', () => {
      // left 106.5→104 (-2.5), centre 126.5→128 (+1.5), right 146.5→144 (-2.5)
      // top 48→48 (0) wins outright on Y.
      const result = snapMoveDelta(bounds, 6.5, -2, [], grid8, 1)
      expect(result).toEqual({ deltaX: 8, deltaY: -2 })
    })

    it('aligns a moving shape to a static object edge', () => {
      const staticRect = makeRect('static', 142, 0, 50, 10)
      const lines = collectSnapLines([staticRect])
      // Right edge lands at 140 → static left edge at 142 pulls it +2.
      const result = snapMoveDelta(bounds, 0, 0, lines, objectsOnly, 1)
      expect(result.deltaX).toBe(2)
      expect(result.deltaY).toBe(0)
    })

    it('pulls BOTH axes onto the grid when the raw delta lands near a line', () => {
      // x: centre lands on 121 → nearest line 120 (adjust −1) → deltaX 0
      // y: bottom lands on 81 → nearest line 80 (adjust −1) → deltaY 0
      const result = snapMoveDelta(bounds, 1, 1, [], grid8, 1)
      expect(result).toEqual({ deltaX: 0, deltaY: 0 })
    })
  })
})
