// =============================================================================
// canvasPresetManager.ts — Canvas preset manager (zoom levels + canvas size)
// =============================================================================
//
// Responsibilities:
//   - Define a small library of standardised zoom presets (e.g. Fit, 100%,
//     200%) and canvas-size presets (e.g. device frames 1920x1080 / 375x812).
//   - Return the world-space viewport rectangle that a given preset should
//     show, so Canvas can apply it via setViewport (focal zoom + pan) without
//     duplicating the focal-zoom math.
//   - Provide a pure, DOM-free helper to read the current canvas dimensions
//     (used by the preset picker UI) so tests never depend on the DOM.
//
// EXISTING-BEHAVIOUR PRESERVATION:
//   - Does not touch render paths, SVG export, PNG export, or any store
//     action. It only *advises* Canvas on what viewport to set.
// =============================================================================

import type { Viewport } from '../../store/EditorStore'

// ---------------------------------------------------------------------------
// Built-in preset definitions
// ---------------------------------------------------------------------------

/** Default canvas dimensions in world units. */
export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 600

/** Named zoom presets: name + target zoom ratio. */
export interface ZoomPreset {
  name: string
  zoom: number
}

/** Named canvas-size presets: name + artboard size in world units. */
export interface CanvasSizePreset {
  name: string
  width: number
  height: number
  deviceScale: number
}

/** A fully-specified preset: zoom ratio + canvas size. */
export interface CanvasPreset {
  name: string
  zoom: number
  canvasWidth: number
  canvasHeight: number
}

/**
 * Built-in Zoom presets.
 *
 * Kept deliberately small so the store/UI stays predictable. New presets can
 * be added here or on the fly by callers.
 */
export const ZOOM_PRESETS: ZoomPreset[] = [
  { name: 'Fit', zoom: 1 },
  { name: '100%', zoom: 1 },
  { name: '200%', zoom: 2 },
  { name: '400%', zoom: 4 },
]

/**
 * Built-in Canvas-size presets.
 *
 * `deviceScale` is the UI-display scale of the preset name (for example a
 * "1920x1080" preset renders as "1920x1080 (1x)" with scale 1.0 so the
 * units are still world units, not device-independent pixels). This matches
 * how local canvas sizing works: the canvas is always measured in world
 * units (px of the artboard), so a 1920x1080 "HD" preset is literally
 * 1920 x 1080 world units.
 */
export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  { name: 'Default 800x600', width: 800, height: 600, deviceScale: 1 },
  { name: 'HD 1920x1080', width: 1920, height: 1080, deviceScale: 1 },
  { name: 'iPhone 14 (375x812)', width: 375, height: 812, deviceScale: 1 },
  { name: 'Large Canvas 1200x900', width: 1200, height: 900, deviceScale: 1 },
]

/**
 * Convenience: pick a zoom preset by name, or fall back to the 100% preset.
 */
export function findZoomPreset(name?: string | null): ZoomPreset {
  if (name) {
    const found = ZOOM_PRESETS.find((p) => p.name === name)
    if (found) return found
  }
  return ZOOM_PRESETS.find((p) => p.name === '100%') ?? ZOOM_PRESETS[0]
}

/**
 * Convenience: pick a canvas-size preset by name, or fall back to the
 * Default preset.
 */
export function findCanvasSizePreset(name?: string | null): CanvasSizePreset {
  if (name) {
    const found = CANVAS_SIZE_PRESETS.find((p) => p.name === name)
    if (found) return found
  }
  return CANVAS_SIZE_PRESETS[0]
}

/**
 * Given the current viewport (zoom + pan) and a canvas-size preset, return a
 * Viewport that centres the artboard and sets the zoom so the entire
 * artboard fits the canvas.
 *
 * Focal zoom: the centre of the artboard stays under the centre of the
 * viewport, so the result is a "fit-to-canvas" zoom that behaves like the
 * existing zoom-in/out buttons in TopBar.
 */
export function computeFitToCanvasViewport(
  current: Viewport,
  size: CanvasSizePreset
): Viewport {
  const { width, height } = size
  // To fit the artboard in the viewport, zoom = canvasSize / artboardSize
  // (zoom out when artboard is larger than default canvas).
  const zoomX = CANVAS_WIDTH / width
  const zoomY = CANVAS_HEIGHT / height
  const newZoom = Math.min(current.zoom, Math.min(zoomX, zoomY))

  // Centre the artboard in the viewport: panX/panY are screen offsets, so the
  // artboard's on-screen centre is (CANVAS_WIDTH/2, CANVAS_HEIGHT/2).
  const targetPanX = CANVAS_WIDTH / 2 - (width / 2) * newZoom
  const targetPanY = CANVAS_HEIGHT / 2 - (height / 2) * newZoom

  return { zoom: newZoom, panX: targetPanX, panY: targetPanY }
}

/**
 * Compute the world-space bounding rectangle that a canvas-size preset would
 * show at the given zoom and pan. Used by the preset picker to know what
 * part of the artboard the user is currently viewing before they switch.
 *
 * This is a read-only helper and does NOT mutate state.
 */
export function getVisibleWorldRect(
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  const left = (0 - viewport.panX) / viewport.zoom
  const right = (canvasWidth - viewport.panX) / viewport.zoom
  const top = (0 - viewport.panY) / viewport.zoom
  const bottom = (canvasHeight - viewport.panY) / viewport.zoom
  return { minX: left, maxX: right, minY: top, maxY: bottom }
}

/**
 * Apply a full canvas preset in one atomic viewport update.
 * Convenience wrapper around computeFitToCanvasViewport + canvas-size preset.
 */
export function applyCanvasPreset(
  current: Viewport,
  preset: CanvasSizePreset
): Viewport {
  return computeFitToCanvasViewport(current, preset)
}

/** Convert a `Viewport` into the `CanvasPreset` shape for persistence/UI. */
export function viewportToCanvasPreset(viewport: Viewport): CanvasPreset {
  return {
    name: `Zoom ${Math.round(viewport.zoom * 100)}%`,
    zoom: viewport.zoom,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
  }
}
