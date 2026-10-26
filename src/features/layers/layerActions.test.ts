// =============================================================================
// layerActions.test.ts — Tests for layer action creators
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  moveItemUp, moveItemDown, toggleVisibility, toggleLock,
  selectVisibleIds, clearSelection, groupSelected, deleteItems,
} from './layerActions'
import type { CanvasElement } from '../../types/canvas'
import type { LayerItem } from './types'

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

function layerItem(id: string): LayerItem {
  return { id, element: element(id), index: 0 }
}

describe('layerActions', () => {
  describe('moveItemUp', () => {
    it('moves an item up one position', () => {
      const items = [layerItem('a'), layerItem('b'), layerItem('c')]
      const result = moveItemUp(items, 'b')
      expect(result.map((i) => i.id)).toEqual(['b', 'a', 'c'])
    })

    it('does nothing when already at top', () => {
      const items = [layerItem('a'), layerItem('b')]
      const result = moveItemUp(items, 'a')
      expect(result.map((i) => i.id)).toEqual(['a', 'b'])
    })

    it('returns unchanged for missing id', () => {
      const items = [layerItem('a'), layerItem('b')]
      const result = moveItemUp(items, 'missing')
      expect(result.map((i) => i.id)).toEqual(['a', 'b'])
    })
  })

  describe('moveItemDown', () => {
    it('moves an item down one position', () => {
      const items = [layerItem('a'), layerItem('b'), layerItem('c')]
      const result = moveItemDown(items, 'b')
      expect(result.map((i) => i.id)).toEqual(['a', 'c', 'b'])
    })

    it('does nothing when already at bottom', () => {
      const items = [layerItem('a'), layerItem('b')]
      const result = moveItemDown(items, 'b')
      expect(result.map((i) => i.id)).toEqual(['a', 'b'])
    })
  })

  describe('toggleVisibility', () => {
    it('toggles visibility of an element', () => {
      const els = [element('a', { visible: true }), element('b', { visible: false })]
      const result = toggleVisibility(els, 'a')
      expect(result?.visible).toBe(false)
      const result2 = toggleVisibility(els, 'b')
      expect(result2?.visible).toBe(true)
    })

    it('returns undefined for missing id', () => {
      expect(toggleVisibility([], 'missing')).toBeUndefined()
    })
  })

  describe('toggleLock', () => {
    it('toggles lock of an element', () => {
      const els = [element('a', { locked: false }), element('b', { locked: true })]
      const result = toggleLock(els, 'a')
      expect(result?.locked).toBe(true)
      const result2 = toggleLock(els, 'b')
      expect(result2?.locked).toBe(false)
    })

    it('returns undefined for missing id', () => {
      expect(toggleLock([], 'missing')).toBeUndefined()
    })
  })

  describe('selectVisibleIds', () => {
    it('returns all item ids', () => {
      const items = [layerItem('a'), layerItem('b'), layerItem('c')]
      expect(selectVisibleIds(items)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('clearSelection', () => {
    it('returns an empty array', () => {
      expect(clearSelection()).toEqual([])
    })
  })

  describe('groupSelected', () => {
    it('creates a group from selected elements', () => {
      const els = [
        element('a', { transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 } }),
        element('b', { transform: { x: 50, y: 50, width: 100, height: 100, rotation: 0 } }),
      ]
      const group = groupSelected(els, ['a', 'b'])
      expect(group?.type).toBe('group')
      expect(group?.childrenIds).toEqual(['a', 'b'])
      expect(group?.transform.x).toBe(0)
      expect(group?.transform.y).toBe(0)
      expect(group?.transform.width).toBe(150)
      expect(group?.transform.height).toBe(150)
    })

    it('returns undefined for fewer than 2 selections', () => {
      const els = [element('a')]
      expect(groupSelected(els, ['a'])).toBeUndefined()
      expect(groupSelected(els, [])).toBeUndefined()
    })
  })

  describe('deleteItems', () => {
    it('removes elements by id', () => {
      const els = [element('a'), element('b'), element('c')]
      const result = deleteItems(els, ['b'])
      expect(result.map((e) => e.id)).toEqual(['a', 'c'])
    })

    it('returns unchanged for missing ids', () => {
      const els = [element('a'), element('b')]
      const result = deleteItems(els, ['missing'])
      expect(result.map((e) => e.id)).toEqual(['a', 'b'])
    })
  })
})

