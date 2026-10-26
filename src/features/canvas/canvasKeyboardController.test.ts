// =============================================================================
// canvasKeyboardController.test.ts — Tests for the canvas keyboard controller
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  clampZoom,
  zoomBy,
  panBy,
  zoomToFit,
  resetViewport,
  CANVAS_KEYBOARD_ACTIONS,
} from './canvasKeyboardController'
import type { Viewport } from '../../store/EditorStore'

describe('canvasKeyboardController', () => {
  describe('clampZoom', () => {
    it('clamps below MIN_ZOOM', () => {
      expect(clampZoom(0.01)).toBe(0.1)
    })

    it('clamps above MAX_ZOOM', () => {
      expect(clampZoom(25)).toBe(10)
    })

    it('preserves valid zoom levels', () => {
      expect(clampZoom(1.5)).toBe(1.5)
    })
  })

  describe('zoomBy', () => {
    it('applies a zoom factor centred on a focal point', () => {
      const viewport: Viewport = { zoom: 1, panX: 0, panY: 0 }
      const result = zoomBy(viewport, 2, 100, 50)
      expect(result.zoom).toBe(2)
      // Focal zoom keeps the world point under the cursor unchanged.
      const worldX = (100 - result.panX) / result.zoom
      const worldY = (50 - result.panY) / result.zoom
      expect(worldX).toBeCloseTo(100)
      expect(worldY).toBeCloseTo(50)
    })
  })

  describe('panBy', () => {
    it('pans by a delta in screen pixels', () => {
      const viewport: Viewport = { zoom: 2, panX: 100, panY: 50 }
      const result = panBy(viewport, 40, 20)
      expect(result.panX).toBe(60)
      expect(result.panY).toBe(30)
      expect(result.zoom).toBe(2)
    })
  })

  describe('zoomToFit', () => {
    it('fits the viewport to the canvas width/height', () => {
      const viewport: Viewport = { zoom: 1, panX: 0, panY: 0 }
      const result = zoomToFit(viewport)
      expect(result.zoom).toBe(1)
      expect(result.panX).toBeCloseTo(400 - 400 * 1)
      expect(result.panY).toBeCloseTo(300 - 300 * 1)
    })
  })

  describe('resetViewport', () => {
    it('returns the default viewport', () => {
      expect(resetViewport()).toEqual({ zoom: 1, panX: 40, panY: 40 })
    })
  })

  describe('CANVAS_KEYBOARD_ACTIONS', () => {
    it('contains the expected keyboard actions', () => {
      const keys = CANVAS_KEYBOARD_ACTIONS.map((a) => a.key)
      expect(keys).toContain('ArrowLeft')
      expect(keys).toContain('ArrowRight')
      expect(keys).toContain('ArrowUp')
      expect(keys).toContain('ArrowDown')
      expect(keys).toContain('Equals')
      expect(keys).toContain('+')
      expect(keys).toContain('-')
      expect(keys).toContain('0')
      expect(keys).toContain('F')
      expect(CANVAS_KEYBOARD_ACTIONS.every((a) => a.ctrl === true)).toBe(true)
    })
  })
})
