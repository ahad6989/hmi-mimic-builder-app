// =============================================================================
// canvasDesignPrototype.test.ts — Tests for canvas design/prototype construction
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  getCanvasPresetOptions,
  applyCanvasSizePreset,
  resetCanvas,
  resetCanvasState,
} from './canvasDesignPrototype'
import type { Viewport } from '../../store/EditorStore'

describe('canvasDesignPrototype', () => {
  describe('getCanvasPresetOptions', () => {
    it('returns UI options for each canvas-size preset', () => {
      const options = getCanvasPresetOptions()
      expect(options).toHaveLength(4)
      expect(options[0]).toMatchObject({ value: 'Default 800x600', label: '800x600 (1x)' })
      expect(options[1]).toMatchObject({ value: 'HD 1920x1080', label: '1920x1080 (1x)' })
    })
  })

  describe('applyCanvasSizePreset', () => {
    it('returns a fit-to-canvas viewport for a valid preset', () => {
      const current: Viewport = { zoom: 1, panX: 0, panY: 0 }
      const result = applyCanvasSizePreset('HD 1920x1080', current)
      expect(result.zoom).toBe(800 / 1920)
    })

    it('falls back to the current viewport for an unknown preset', () => {
      const current: Viewport = { zoom: 2, panX: 10, panY: 20 }
      const result = applyCanvasSizePreset('Unknown', current)
      expect(result).toEqual(current)
    })
  })

  describe('resetCanvas', () => {
    it('returns the default 100% viewport', () => {
      expect(resetCanvas()).toEqual({ zoom: 1, panX: 40, panY: 40 })
    })
  })

  describe('resetCanvasState', () => {
    it('clears the preset name', () => {
      expect(resetCanvasState()).toEqual({ name: null })
    })
  })
})
