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
export const ZOOM_SENSITIVITY = 0.0025

// ---------------------------------------------------------------------------
// Core conversion
// ---------------------------------------------------------------------------

/**
 * Convert a browser mouse event position (clientX, clientY) into SVG-relative coordinates.
 * Uses svg.getScreenCTM() if available to correctly account for viewBox, aspect ratio,
 * CSS sizing, and document positioning. Falls back to getBoundingClientRect() if CTM is unavailable.
 */
export function toSVGPoint(
  clientX: number,
  clientY: number,
  svgEl: SVGSVGElement
): { x: number; y: number } {
  const ctm = svgEl.getScreenCTM?.()
  if (ctm && typeof ctm.inverse === 'function') {
    const pt = svgEl.createSVGPoint?.()
    if (pt && typeof pt.matrixTransform === 'function') {
      pt.x = clientX
      pt.y = clientY
      const transformed = pt.matrixTransform(ctm.inverse())
      return { x: transformed.x, y: transformed.y }
    }
  }
  const rect = svgEl.getBoundingClientRect?.() ?? { left: 0, top: 0 }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
}

/**
 * Convert a browser mouse event position (clientX, clientY) into world space.
 *
 * @param clientX   - event.clientX from the mouse event
 * @param clientY   - event.clientY from the mouse event
 * @param svgEl     - the <svg> DOM element
 * @param zoom      - current viewport zoom (1.0 = 100%)
 * @param panX      - current viewport horizontal offset
 * @param panY      - current viewport vertical offset
 */
export function toWorldPoint(
  clientX: number,
  clientY: number,
  svgEl: SVGSVGElement,
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  const svgPt = toSVGPoint(clientX, clientY, svgEl)
  return {
    x: (svgPt.x - panX) / zoom,
    y: (svgPt.y - panY) / zoom,
  }
}

/**
 * Convert a world-space point into browser client coordinates (clientX, clientY).
 * This is the exact inverse of toWorldPoint.
 */
export function toScreenPoint(
  worldX: number,
  worldY: number,
  svgEl: SVGSVGElement,
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  const svgX = worldX * zoom + panX
  const svgY = worldY * zoom + panY

  const ctm = svgEl.getScreenCTM?.()
  if (ctm) {
    const pt = svgEl.createSVGPoint?.()
    if (pt && typeof pt.matrixTransform === 'function') {
      pt.x = svgX
      pt.y = svgY
      const transformed = pt.matrixTransform(ctm)
      return { x: transformed.x, y: transformed.y }
    }
  }

  const rect = svgEl.getBoundingClientRect?.() ?? { left: 0, top: 0 }
  return {
    x: rect.left + svgX,
    y: rect.top + svgY,
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
