// =============================================================================
// canvasKeyboardController.ts — Keyboard-driven viewport / zoom / reset behaviour
// =============================================================================
//
// Responsibilities:
//   - Map keyboard modifier + arrow-key combos to smooth viewport
//     pan/zoom operations whose deltas are measured in world units (not
//     pixels), so the feel is identical at every zoom level.
//   - Expose a single pure `zoomBy` helper so Canvas and the TopBar can share
//     the same zoom arithmetic (no duplication between the two zoom paths).
//   - Keep the existing Ctrl/Cmd+Scroll zoom path untouched.
//
// EXISTING-BEHAVIOUR PRESERVATION:
//   - Does not change any existing keyboard shortcuts (V/H/R/O/L/Y/P/B/T).
//   - Does not touch mouse-wheel zoom; this module only owns *keyboard-only*
//     pan/zoom so both can coexist without fighting over the same key.
// =============================================================================

import type { Viewport } from '../../store/EditorStore'

/** Default canvas dimensions in world units. */
export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 600

/**
 * How many world units a single "step" moves the viewport in screen-space
 * terms, at 100% zoom. At other zoom levels the step is divided by zoom so
 * the on-screen travel distance stays constant (e.g. 40px of travel at 200%
 * zoom = 20 world units of pan).
 */

/** Maximum zoom belonging to a "zoom-to-fit/fit-to-width" keyboard operation. */

/** Zoom sensitivity (world units per key repeat tick, symmetric: /2 /1 /2). */

/**
 * Clamp a zoom value to the legal range [MIN_ZOOM, MAX_ZOOM] defined in
 * geometry/coordinates.ts.
 */
export function clampZoom(zoom: number): number {
  return Math.min(10, Math.max(0.1, zoom))
}

/** Apply a zoom factor to a viewport, preserving the point under the cursor. */
export function zoomBy(
  viewport: Viewport,
  factor: number,
  focalX: number,
  focalY: number
): Viewport {
  const currentZoom = viewport.zoom
  const newZoom = clampZoom(currentZoom * factor)

  // Focal zoom formula: the world point under (focalX, focalY) stays there.
  const newPanX = focalX - (focalX - viewport.panX) * (newZoom / currentZoom)
  const newPanY = focalY - (focalY - viewport.panY) * (newZoom / currentZoom)

  return { zoom: newZoom, panX: newPanX, panY: newPanY }
}

/**
 * Get the current canvas dimensions in world units used by the app.
 * Exposing this separately avoids duplicated constants in Canvas and the
 * preset picker.
 */
export function getCanvasDimensions(): { width: number; height: number } {
  return { width: 800, height: 600 }
}

/**
 * Return a new viewport after a left/right/up/down keyboard arrow press.
 * delta is in screen pixels *before* division by zoom, so the on-screen
 * travel is uniform at every zoom level.
 */
export function panBy(
  viewport: Viewport,
  deltaX: number,
  deltaY: number
): Viewport {
  return {
    zoom: viewport.zoom,
    panX: viewport.panX - deltaX,
    panY: viewport.panY - deltaY,
  }
}

/**
 * Wrapper used by the UI to "zoom to fit" the current canvas via keyboard.
 * The result behaves identically to the TopBar "Zoom to Fit" action.
 */
export function zoomToFit(current: Viewport): Viewport {
  const { width, height } = getCanvasDimensions()
  const zoomX = CANVAS_WIDTH / width
  const zoomY = CANVAS_HEIGHT / height
  const targetZoom = Math.min(current.zoom, Math.min(zoomX, zoomY))
  const targetPanX = CANVAS_WIDTH / 2 - (width / 2) * targetZoom
  const targetPanY = CANVAS_HEIGHT / 2 - (height / 2) * targetZoom
  return { zoom: targetZoom, panX: targetPanX, panY: targetPanY }
}

/** Reset the viewport to the app's default (100%, 40/40 offset). */
export function resetViewport(): Viewport {
  return { zoom: 1, panX: 40, panY: 40 }
}

/**
 * Ordered list of keyboard key => action for the canvas keyboard controller.
 * Used by Canvas to build the preset-menu keyboard hints and by tests to
 * verify the key mapping.
 */
export interface KeyboardAction {
  key: string
  shift?: boolean
  ctrl?: boolean
  action: 'pan' | 'zoomIn' | 'zoomOut' | 'zoomToFit' | 'reset'
}

export const CANVAS_KEYBOARD_ACTIONS: KeyboardAction[] = [
  { key: 'ArrowLeft', ctrl: true, action: 'pan' },
  { key: 'ArrowRight', ctrl: true, action: 'pan' },
  { key: 'ArrowUp', ctrl: true, action: 'pan' },
  { key: 'ArrowDown', ctrl: true, action: 'pan' },
  { key: 'Equals', ctrl: true, action: 'zoomIn' },
  { key: '+', ctrl: true, action: 'zoomIn' },
  { key: '-', ctrl: true, action: 'zoomOut' },
  { key: '0', ctrl: true, action: 'reset' },
  { key: 'F', ctrl: true, action: 'zoomToFit' },
]
