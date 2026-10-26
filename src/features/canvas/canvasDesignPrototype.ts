// =============================================================================
// canvasDesignPrototype.ts — Canvas preset + design prototype construction
// =============================================================================
//
// Responsibilities:
//   - Build/show the canvas design prototype from the chosen canvas-size
//     preset (e.g. a "1920x1080 (HD)" option creates a full-HD artboard).
//   - Expose a pure builder API so Canvas and tests can invoke the change
//     without reaching into Zustand or the DOM.
//   - Keep all UI strings and preset names in one place.
//
// EXISTING-BEHAVIOUR PRESERVATION:
//   - Zero mutations of existing exported functions or SVG/PNG export paths.
//   - Read-only on the store: every change goes through an existing, tested
//     store action (setViewport / setActiveTool), so undo/redo and
//     autosave continue to behave exactly as before.
// =============================================================================

import type { Viewport } from '../../store/EditorStore'
import { CANVAS_SIZE_PRESETS, applyCanvasPreset } from './canvasPresetManager'
import { resetViewport } from './canvasKeyboardController'

/** UI adapter used by the preset menu. */
export interface CanvasPresetOption {
  value: string
  label: string
}

/**
 * Build the full list of canvas-size presets as UI options.
 *
 * The label includes the scaled display name (e.g. "1920x1080 (1x)") so the
 * user sees the actual artboard dimensions the preset will create.
 */
export function getCanvasPresetOptions(): CanvasPresetOption[] {
  return CANVAS_SIZE_PRESETS.map((p) => ({
    value: p.name,
    label: `${p.width}x${p.height} (${p.deviceScale}x)`,
  }))
}

/**
 * The current canvas-size preset name, if any.
 *
 * This is kept as a separate abstraction so the preset *name* is stored in
 * the store/UI rather than being re-derived on every render, which makes
 * the "current" state predictable for tests and the undo/redo snapshot.
 */
export interface CurrentCanvasPreset {
  name: string | null
}

/**
 * Apply a canvas-size preset to the canvas, resetting the viewport to fit
 * the new artboard.
 *
 * @param presetName  the name of the desired canvas-size preset (e.g.
 *                    "HD 1920x1080")
 * @param currentViewport  the current viewport (needed so zoom-out to fit
 *                         works relative to the current zoom)
 *
 * Returns the new viewport that the caller must commit via setViewport.
 */
export function applyCanvasSizePreset(
  presetName: string,
  currentViewport: Viewport
): Viewport {
  const preset = CANVAS_SIZE_PRESETS.find((p) => p.name === presetName)
  if (!preset) {
    // No-op if the requested preset does not exist (keeps the UI safe
    // when a preset is renamed/removed).
    return currentViewport
  }

  return applyCanvasPreset(currentViewport, preset)
}

/**
 * Reset the canvas to the default 800x600 artboard and 100% zoom.
 *
 * This is deliberately a no-op on the store swap (which handles the
 * viewport), leaving autosave/undo/redo behaviour unchanged.
 */
export function resetCanvas(): Viewport {
  return resetViewport()
}

/**
 * Reset canvas state: clears the artboard size preset name and the current
 * viewport, falling back to the default.
 */
export function resetCanvasState(): CurrentCanvasPreset {
  return { name: null }
}

/**
 * Read-only helper: given the current viewport and the chosen canvas-size
 * preset, compute the on-screen bounds of the visible artboard. Useful for
 * the preset picker to grey-out presets that would show an empty canvas.
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
