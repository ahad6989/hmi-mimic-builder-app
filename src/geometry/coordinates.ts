// =============================================================================
// geometry/coordinates.ts — Coordinate space conversions
//
// This is the ONLY place in the app where screen ↔ world math lives.
// Everything else calls these functions.
//
// Coordinate spaces in VectorCraft Studio:
//
//   SCREEN SPACE     — browser pixels, origin at top-left of the browser tab.
//                      This is what mouse events give you (clientX, clientY).
//
//   SVG-RELATIVE     — pixels relative to the top-left corner of the <svg>
//                      element. Obtained by subtracting svg.getBoundingClientRect().
//
//   WORLD SPACE      — the logical coordinate system of the artboard.
//                      All CanvasElement positions are stored in world space.
//                      Obtained by applying the inverse viewport transform.
//
// The viewport transform from world → screen:
//   screenX = worldX * zoom + panX
//   screenY = worldY * zoom + panY
//
// The inverse (screen → world):
//   worldX = (screenX_relative_to_svg - panX) / zoom
//   worldY = (screenY_relative_to_svg - panY) / zoom
// =============================================================================

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_ZOOM = 0.1   // 10%
export const MAX_ZOOM = 10    // 1000%

/**
 * How fast the mouse wheel zooms.
 * We use Math.exp(-deltaY * ZOOM_SENSITIVITY) so that:
 *   - A mouse scroll wheel (deltaY ≈ 100) gives noticeable zoom per tick
 *   - A trackpad (deltaY ≈ 1–3) gives tiny smooth increments
 */
const ZOOM_SENSITIVITY = 0.005

// ---------------------------------------------------------------------------
// Core conversion
// ---------------------------------------------------------------------------

/**
 * Convert a browser mouse event position (clientX, clientY) into world space.
 *
 * @param clientX   - event.clientX from the mouse event
 * @param clientY   - event.clientY from the mouse event
 * @param svgEl     - the <svg> DOM element (needed for its page position)
 * @param zoom      - current viewport zoom (1.0 = 100%)
 * @param panX      - current viewport horizontal offset (screen pixels)
 * @param panY      - current viewport vertical offset (screen pixels)
 */
export function toWorldPoint(
  clientX: number,
  clientY: number,
  svgEl: SVGSVGElement,
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  // Step 1: get the SVG element's position on the page
  const rect = svgEl.getBoundingClientRect()

  // Step 2: convert from browser-absolute to SVG-relative pixels
  const svgX = clientX - rect.left
  const svgY = clientY - rect.top

  // Step 3: apply the inverse viewport transform to get world coordinates
  return {
    x: (svgX - panX) / zoom,
    y: (svgY - panY) / zoom,
  }
}

/**
 * Convert a world-space point into browser client coordinates.
 * This is the exact inverse of toWorldPoint's manual viewport transform.
 */
export function toScreenPoint(
  worldX: number,
  worldY: number,
  svgEl: SVGSVGElement,
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  const rect = svgEl.getBoundingClientRect()
  return {
    x: rect.left + worldX * zoom + panX,
    y: rect.top + worldY * zoom + panY,
  }
}

// ---------------------------------------------------------------------------
// Zoom utilities
// ---------------------------------------------------------------------------

/** Clamp a zoom value to the legal range [MIN_ZOOM, MAX_ZOOM]. */
export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/**
 * Compute the new viewport (zoom + pan) after a focal zoom gesture.
 *
 * The key requirement: the world point currently under the mouse cursor
 * must remain under the cursor after zooming. This is called "focal zoom"
 * or "zoom to point."
 *
 * Derivation:
 *   Let W = world point under cursor.
 *   Before: W = (mouseX - panX) / zoom
 *   After:  W = (mouseX - newPanX) / newZoom
 *   Setting equal and solving for newPanX:
 *     newPanX = mouseX - (mouseX - panX) × (newZoom / zoom)
 *
 * @param currentZoom    current zoom level
 * @param currentPanX    current pan offset (horizontal)
 * @param currentPanY    current pan offset (vertical)
 * @param mouseX         cursor position relative to the SVG element (not clientX!)
 * @param mouseY         cursor position relative to the SVG element
 * @param wheelDeltaY    WheelEvent.deltaY — positive = scroll down = zoom out
 */
export function computeFocalZoom(
  currentZoom: number,
  currentPanX: number,
  currentPanY: number,
  mouseX: number,
  mouseY: number,
  wheelDeltaY: number
): { zoom: number; panX: number; panY: number } {
  // Math.exp gives smooth, symmetric zoom:
  // scrolling up by the same amount you scrolled down returns to exact original zoom.
  // A simple multiply (zoom * 0.9 then / 0.9) does NOT have this property.
  const scaleFactor = Math.exp(-wheelDeltaY * ZOOM_SENSITIVITY)
  const newZoom = clampZoom(currentZoom * scaleFactor)

  // Focal point formula — derived above
  const newPanX = mouseX - (mouseX - currentPanX) * (newZoom / currentZoom)
  const newPanY = mouseY - (mouseY - currentPanY) * (newZoom / currentZoom)

  return { zoom: newZoom, panX: newPanX, panY: newPanY }
}
