// =============================================================================
// canvasPresetManager.test.ts — Tests for canvas preset management
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  ZOOM_PRESETS,
  CANVAS_SIZE_PRESETS,
  findZoomPreset,
  findCanvasSizePreset,
  computeFitToCanvasViewport,
  viewportToCanvasPreset,
} from './canvasPresetManager'
import type { Viewport } from '../../store/EditorStore'

describe('canvasPresetManager', () => {
  describe('ZOOM_PRESETS', () => {
    it('contains the expected presets', () => {
      expect(ZOOM_PRESETS).toEqual([
        { name: 'Fit', zoom: 1 },
        { name: '100%', zoom: 1 },
        { name: '200%', zoom: 2 },
        { name: '400%', zoom: 4 },
      ])
    })
  })

  describe('CANVAS_SIZE_PRESETS', () => {
    it('contains the expected presets', () => {
      expect(CANVAS_SIZE_PRESETS).toEqual([
        { name: 'Default 800x600', width: 800, height: 600, deviceScale: 1 },
        { name: 'HD 1920x1080', width: 1920, height: 1080, deviceScale: 1 },
        { name: 'iPhone 14 (375x812)', width: 375, height: 812, deviceScale: 1 },
        { name: 'Large Canvas 1200x900', width: 1200, height: 900, deviceScale: 1 },
      ])
    })
  })

  describe('findZoomPreset', () => {
    it('finds an existing preset by name', () => {
      expect(findZoomPreset('200%')).toEqual({ name: '200%', zoom: 2 })
    })

    it('falls back to 100% for an unknown name', () => {
      expect(findZoomPreset('Bogus')).toEqual({ name: '100%', zoom: 1 })
    })

    it('falls back to the first preset when given null', () => {
      expect(findZoomPreset(null)).toEqual({ name: '100%', zoom: 1 })
    })
  })

  describe('findCanvasSizePreset', () => {
    it('finds an existing preset', () => {
      expect(findCanvasSizePreset('HD 1920x1080')).toEqual(
        expect.objectContaining({ width: 1920, height: 1080 })
      )
    })

    it('falls back to the default preset for an unknown name', () => {
      expect(findCanvasSizePreset('Unknown')).toEqual(
        expect.objectContaining({ name: 'Default 800x600' })
      )
    })

    it('returns the default preset when given null', () => {
      expect(findCanvasSizePreset(null)).toEqual(
        expect.objectContaining({ name: 'Default 800x600' })
      )
    })
  })

  describe('computeFitToCanvasViewport', () => {
    it('computes a fit-to-canvas viewport', () => {
      const current: Viewport = { zoom: 1, panX: 0, panY: 0 }
      const preset = { name: 'HD 1920x1080', width: 1920, height: 1080, deviceScale: 1 }
      const result = computeFitToCanvasViewport(current, preset)
      expect(result.zoom).toBe(800 / 1920)
      expect(result.panX).toBeCloseTo(400 - (1920 / 2) * result.zoom)
      expect(result.panY).toBeCloseTo(300 - (1080 / 2) * result.zoom)
    })
  })

  describe('viewportToCanvasPreset', () => {
    it('converts a viewport back to a CanvasPreset', () => {
      const viewport: Viewport = { zoom: 2, panX: 10, panY: 20 }
      const preset = viewportToCanvasPreset(viewport)
      expect(preset).toEqual({
        name: 'Zoom 200%',
        zoom: 2,
        canvasWidth: 800,
        canvasHeight: 600,
      })
    })
  })
})
