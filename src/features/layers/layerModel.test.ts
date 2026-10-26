// =============================================================================
// layerModel.test.ts — Tests for layer model helpers
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  toLayerModel, applyFilter, visibleIds, indexOfId, findItemById,
} from './layerModel'
import type { CanvasElement } from '../../types/canvas'

function element(id: string, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id, name: 'Test', type: 'rect', visible: true, locked: false,
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
    style: { fill: '#000', fillOpacity: 1, stroke: '#000', strokeWidth: 1,
      strokeOpacity: 1, opacity: 1, strokeDashArray: '', strokeLineCap: 'butt',
      strokeLineJoin: 'miter' },
    textStyle: { content: '', fontFamily: 'sans-serif', fontSize: 16,
      fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none',
      color: '#000', backgroundColor: 'transparent' },
    ...overrides,
  }
}

describe('layerModel', () => {
  describe('toLayerModel', () => {
    it('builds a flat layer list from elements', () => {
      const els = [element('a'), element('b'), element('c')]
      const items = toLayerModel(els)
      expect(items.length).toBe(3)
      expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
      expect(items.map((i) => i.index)).toEqual([0, 1, 2])
    })

    it('handles empty element list', () => {
      expect(toLayerModel([])).toEqual([])
    })
  })

  describe('applyFilter', () => {
    it('shows all when filter is empty', () => {
      const items = toLayerModel([element('a'), element('b', { visible: false, locked: true })])
      expect(applyFilter(items, '').length).toBe(2)
    })

    it('filters visible only', () => {
      const items = toLayerModel([element('a', { visible: true, locked: false }),
        element('b', { visible: false, locked: true })])
      const filtered = applyFilter(items, 'visible')
      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('a')
    })

    it('filters locked only', () => {
      const items = toLayerModel([element('a', { visible: true, locked: false }),
        element('b', { visible: true, locked: true })])
      const filtered = applyFilter(items, 'locked')
      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('b')
    })

    it('filters text type only', () => {
      const items = toLayerModel([element('a', { type: 'rect' }),
        element('b', { type: 'text' })])
      const filtered = applyFilter(items, 'text')
      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('b')
    })
  })

  describe('visibleIds', () => {
    it('returns visible element ids under filter', () => {
      const items = toLayerModel([element('a', { visible: true, locked: false }),
        element('b', { visible: false, locked: true })])
      const ids = visibleIds(items, 'visible')
      expect(ids.has('a')).toBe(true)
      expect(ids.has('b')).toBe(false)
    })
  })

  describe('indexOfId', () => {
    it('returns the index of an element id', () => {
      const items = toLayerModel([element('a'), element('b'), element('c')])
      expect(indexOfId(items, 'b')).toBe(1)
      expect(indexOfId(items, 'missing')).toBe(-1)
    })
  })

  describe('findItemById', () => {
    it('finds a layer item by id', () => {
      const items = toLayerModel([element('a'), element('b')])
      const item = findItemById(items, 'b')
      expect(item?.id).toBe('b')
      expect(item?.element.name).toBe('Test')
    })

    it('returns undefined for missing id', () => {
      expect(findItemById([], 'missing')).toBeUndefined()
    })
  })
})

