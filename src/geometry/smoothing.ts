// =============================================================================
// geometry/smoothing.ts — Path smoothing & point decimation
//
// Pure functions used by the Pencil tool (and anything else that collects a
// stream of raw points and needs a smooth, compact SVG path).
//
// ALGORITHM — Uniform Catmull-Rom → cubic Bézier
//   A Catmull-Rom spline passes THROUGH its control points and is C1
//   continuous, which is exactly what freehand drawing wants. SVG only
//   understands cubic Béziers, so each segment (p1 → p2) is converted:
//
//     p0──────p1──────p2──────p3        (neighbouring anchors; endpoints
//                                        clamp to the first/last anchor)
//     c1 = p1 + (p2 − p0) · tension / 6
//     c2 = p2 − (p3 − p1) · tension / 6
//
//     segment = C c1 c2 p2
//
//   The result is stored as PathPoint.handleOut (on p1) and PathPoint.handleIn
//   (on p2) — the same data structure the Pen tool and the store already use —
//   so buildPathData() serialises it with no special cases.
//
//   At interior anchors the two handles are symmetric around the anchor and
//   colinear with (p_next − p_prev), giving a smooth curve through every point.
// =============================================================================

import type { PathPoint } from '../types/canvas'

export interface Point {
  x: number
  y: number
}

/** Catmull-Rom tension. 1 = standard centripetal-ish look; 0 = straight lines. */
export const DEFAULT_TENSION = 1

// ---------------------------------------------------------------------------
// Decimation
// ---------------------------------------------------------------------------

/**
 * Remove points that sit closer than `minDistance` to the previously KEPT
 * point. The first and last points are always kept (stroke ends must not move).
 *
 * This is what keeps a long pencil stroke from producing thousands of anchors:
 * drawing fast spreads samples out; drawing slow still records detail.
 */
export function thinPoints(points: Point[], minDistance: number): Point[] {
  if (points.length <= 2 || minDistance <= 0) return [...points]

  const result: Point[] = [points[0]]
  let lastKept = points[0]

  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i]
    const dx = point.x - lastKept.x
    const dy = point.y - lastKept.y
    if (Math.sqrt(dx * dx + dy * dy) >= minDistance) {
      result.push(point)
      lastKept = point
    }
  }

  const lastPoint = points[points.length - 1]
  if (result[result.length - 1] !== lastPoint) {
    result.push(lastPoint)
  }
  return result
}

// ---------------------------------------------------------------------------
// Catmull-Rom → cubic handles
// ---------------------------------------------------------------------------

/**
 * Convert an ordered anchor list into PathPoints carrying cubic handles.
 *
 * @param anchors raw anchor positions (≥ 2 required; 0/1 returned as-is)
 * @param tension Catmull-Rom tension (default 1)
 * @returns anchors with handleOut/handleIn populated (absolute world coords)
 */
export function catmullRomToHandles(
  anchors: Point[],
  tension: number = DEFAULT_TENSION
): PathPoint[] {
  const points: PathPoint[] = anchors.map((anchor) => ({
    x: anchor.x,
    y: anchor.y,
  }))

  const count = points.length
  if (count < 3) return points // 0–2 anchors → straight segments, no handles

  for (let i = 0; i < count - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, count - 1)]

    const controlOut = {
      x: p1.x + ((p2.x - p0.x) * tension) / 6,
      y: p1.y + ((p2.y - p0.y) * tension) / 6,
    }
    const controlIn = {
      x: p2.x - ((p3.x - p1.x) * tension) / 6,
      y: p2.y - ((p3.y - p1.y) * tension) / 6,
    }

    p1.handleOut = controlOut
    p2.handleIn = controlIn
  }

  return points
}

// ---------------------------------------------------------------------------
// One-call pipeline for freehand input
// ---------------------------------------------------------------------------

export interface SmoothOptions {
  /** Minimum spacing between kept anchors (world units). Default 3. */
  minDistance?: number
  /** Hard cap on anchors; decimation tightens until under it. Default 500. */
  maxPoints?: number
  /** Catmull-Rom tension. Default 1. */
  tension?: number
}

/**
 * Thin a raw point stream, then smooth it into PathPoints ready for
 * buildPathData() / createPathElement().
 */
export function smoothPointStream(
  raw: Point[],
  options: SmoothOptions = {}
): PathPoint[] {
  const minDistance = options.minDistance ?? 3
  const maxPoints = options.maxPoints ?? 500
  const tension = options.tension ?? DEFAULT_TENSION

  let thinned = thinPoints(raw, minDistance)

  // Tighten the decimation distance until the stream fits the cap.
  let distance = minDistance
  let guard = 0
  while (thinned.length > maxPoints && guard < 32) {
    distance *= 1.5
    thinned = thinPoints(raw, distance)
    guard++
  }

  return catmullRomToHandles(thinned, tension)
}