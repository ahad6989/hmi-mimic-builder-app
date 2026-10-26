// =============================================================================
// persistenceRecovery.test.ts — Tests for persistence & recovery helpers
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  recoverRecordFromStorage, elementsEqual, clearPersistence,
  PERSISTENCE_KEY, PERSISTENCE_VERSION,
} from './persistenceRecovery'
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

describe('persistenceRecovery', () => {
  beforeEach(() => {
    clearPersistence()
  })

  afterEach(() => {
    clearPersistence()
  })

  describe('PERSISTENCE_KEY / PERSISTENCE_VERSION', () => {
    it('defines the storage key and version', () => {
      expect(PERSISTENCE_KEY).toBe('vectorcraft-elements')
      expect(PERSISTENCE_VERSION).toBe(1)
    })
  })

  describe('clearPersistence', () => {
    it('removes the persisted document', () => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify({
          version: PERSISTENCE_VERSION,
          savedAt: Date.now(),
          elements: [element('e1')],
        }))
        expect(window.localStorage.getItem(PERSISTENCE_KEY)).not.toBeNull()
        clearPersistence()
        expect(window.localStorage.getItem(PERSISTENCE_KEY)).toBeNull()
      }
    })
  })

  describe('recoverRecordFromStorage', () => {
    it('returns null when no storage exists', () => {
      expect(recoverRecordFromStorage()).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PERSISTENCE_KEY, 'not json')
        expect(recoverRecordFromStorage()).toBeNull()
      }
    })

    it('returns null for wrong version', () => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify({
          version: 999,
          savedAt: Date.now(),
          elements: [],
        }))
        expect(recoverRecordFromStorage()).toBeNull()
      }
    })

    it('returns null when elements is not an array', () => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify({
          version: PERSISTENCE_VERSION,
          savedAt: Date.now(),
          elements: 'not an array',
        }))
        expect(recoverRecordFromStorage()).toBeNull()
      }
    })

    it('recovers a valid record', () => {
      if (typeof window !== 'undefined') {
        const els = [element('e1'), element('e2', { type: 'ellipse' })]
        window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify({
          version: PERSISTENCE_VERSION,
          savedAt: Date.now(),
          elements: els,
        }))
        const record = recoverRecordFromStorage()
        expect(record).not.toBeNull()
        expect(record!.elements.length).toBe(2)
        expect(record!.elements[0].id).toBe('e1')
        expect(record!.version).toBe(PERSISTENCE_VERSION)
      }
    })
  })

  describe('elementsEqual', () => {
    it('returns true for identical element lists', () => {
      const a = [element('e1'), element('e2')]
      const b = [element('e1'), element('e2')]
      expect(elementsEqual(a, b)).toBe(true)
    })

    it('returns false for different lengths', () => {
      expect(elementsEqual([element('e1')], [])).toBe(false)
    })

    it('returns false for different ids', () => {
      expect(elementsEqual([element('e1')], [element('e2')])).toBe(false)
    })

    it('returns true regardless of order', () => {
      const a = [element('e1'), element('e2')]
      const b = [element('e2'), element('e1')]
      expect(elementsEqual(a, b)).toBe(true)
    })

    it('returns false for different transforms', () => {
      const a = [element('e1', { transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 } })]
      const b = [element('e1', { transform: { x: 50, y: 0, width: 100, height: 100, rotation: 0 } })]
      expect(elementsEqual(a, b)).toBe(false)
    })
  })
})

