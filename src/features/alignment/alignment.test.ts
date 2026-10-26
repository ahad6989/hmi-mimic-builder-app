// =============================================================================
// alignment.test.ts — Tests for alignment & distribution helpers
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  computeAlignmentTarget, computeAlignmentDeltas, computeDistributionDeltas,
  type AlignmentTarget,
} from './alignment'
import type { CanvasElement } from '../../types/canvas'

function rect(id: string, x: number, y: number, w = 100, h = 100): CanvasElement {
  return {
    id, name: 'Rect', type: 'rect', visible: true, locked: false,
    transform: { x, y, width: w, height: h, rotation: 0 },
    style: { fill: 'none', fillOpacity: 1, stroke: '#000', strokeWidth: 1,
      strokeOpacity: 1, opacity: 1, strokeDashArray: '', strokeLineCap: 'butt',
      strokeLineJoin: 'miter' },
    textStyle: { content: '', fontFamily: 'sans-serif', fontSize: 16,
      fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none',
      color: '#000', backgroundColor: 'transparent' },
  }
}

function makeTarget(axis: 'x' | 'y', position: number, kind: 'edge' | 'center'): AlignmentTarget {
  return { axis, position, kind }
}

describe('alignment helpers', () => {
  describe('computeAlignmentTarget', () => {
    it('computes left alignment target', () => {
      const els = [rect('a', 10, 10), rect('b', 30, 20)]
      const t = computeAlignmentTarget(els, 'x', 0)
      expect(t.kind).toBe('edge')
      expect(t.position).toBe(0)
      expect(t.axis).toBe('x')
    })

    it('computes right alignment target', () => {
      const els = [rect('a', 10, 10), rect('b', 30, 20)]
      const t = computeAlignmentTarget(els, 'x', 1)
      expect(t.kind).toBe('edge')
      expect(t.position).toBe(1)
    })

    it('computes center alignment target', () => {
      const els = [rect('a', 0, 10), rect('b', 40, 20)]
      const t = computeAlignmentTarget(els, 'x', 0.5)
      expect(t.kind).toBe('center')
      expect(t.position).toBe(0.5)
    })

    it('computes top alignment target', () => {
      const els = [rect('a', 10, 10), rect('b', 20, 30)]
      const t = computeAlignmentTarget(els, 'y', 0)
      expect(t.kind).toBe('edge')
      expect(t.position).toBe(0)
      expect(t.axis).toBe('y')
    })

    it('computes bottom alignment target', () => {
      const els = [rect('a', 10, 10), rect('b', 20, 30)]
      const t = computeAlignmentTarget(els, 'y', 1)
      expect(t.kind).toBe('edge')
      expect(t.position).toBe(1)
    })

    it('throws on empty elements', () => {
      expect(() => computeAlignmentTarget([], 'x', 0)).toThrow('no elements to align')
    })

    it('throws on invalid position', () => {
      expect(() => computeAlignmentTarget([rect('a', 0, 0)], 'x', -0.1)).toThrow()
      expect(() => computeAlignmentTarget([rect('a', 0, 0)], 'x', 1.1)).toThrow()
    })
  })

  describe('computeAlignmentDeltas', () => {
    it('computes left-align deltas', () => {
      const els = [rect('a', 10, 10), rect('b', 30, 20)]
      const target = computeAlignmentTarget(els, 'x', 0)
      const deltas = computeAlignmentDeltas(els, target)
      expect(deltas.get('a')?.deltaX).toBe(0)
      expect(deltas.get('b')?.deltaX).toBe(-20)
    })

    it('computes right-align deltas', () => {
      const els = [rect('a', 10, 10), rect('b', 30, 20)]
      const target = computeAlignmentTarget(els, 'x', 1)
      const deltas = computeAlignmentDeltas(els, target)
      expect(deltas.get('a')?.deltaX).toBe(0)
      expect(deltas.get('b')?.deltaX).toBe(-20)
    })

    it('computes top-align deltas', () => {
      const els = [rect('a', 10, 10), rect('b', 20, 30)]
      const target = computeAlignmentTarget(els, 'y', 0)
      const deltas = computeAlignmentDeltas(els, target)
      expect(deltas.get('a')?.deltaY).toBe(0)
      expect(deltas.get('b')?.deltaY).toBe(-20)
    })

    it('computes bottom-align deltas', () => {
      const els = [rect('a', 10, 10), rect('b', 20, 30)]
      const target = computeAlignmentTarget(els, 'y', 1)
      const deltas = computeAlignmentDeltas(els, target)
      expect(deltas.get('a')?.deltaY).toBe(0)
      expect(deltas.get('b')?.deltaY).toBe(-20)
    })

    it('returns empty map for no elements', () => {
      const target = makeTarget('x', 0, 'edge')
      expect(computeAlignmentDeltas([], target).size).toBe(0)
    })
  })

  describe('computeDistributionDeltas', () => {
    it('computes horizontal distribution deltas', () => {
      const els = [rect('a', 0, 0), rect('b', 100, 0), rect('c', 300, 0)]
      const deltas = computeDistributionDeltas(els, 'x', 0)
      // cursor starts at 0: a at 0 (delta 0), b at 100->100 (delta 0), c at 300->200 (delta -100)
      expect(deltas.get('a')?.deltaX).toBe(0)
      expect(deltas.get('b')?.deltaX).toBe(0)
      expect(deltas.get('c')?.deltaX).toBe(-100)
    })

    it('returns empty map for no elements', () => {
      expect(computeDistributionDeltas([], 'x', 0).size).toBe(0)
    })
  })
})

