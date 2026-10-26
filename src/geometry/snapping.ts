// =============================================================================
// geometry/snapping.ts — Reusable snapping calculations & smart guides
//
// Pure functions only: no React, no Zustand, no DOM. Everything takes the
// numbers it needs (elements, settings, zoom) as arguments, which makes the
// math trivially testable.
//
// COORDINATE SPACES
//   All snap targets, guide lines and points are WORLD coordinates (the same
//   space CanvasElement geometry is stored in). Screen ↔ world conversion is
//   done by geometry/coordinates.ts — never here.
//
// TOLERANCE
//   The user experiences snapping in SCREEN pixels, but the values we compare
//   are world units, so the tolerance is divided by the current zoom:
//       worldTolerance = SCREEN_SNAP_TOLERANCE_PX / zoom
//   At 200% zoom the world tolerance shrinks (grid cells are bigger on
//   screen); at 50% it grows. The on-screen "stickiness" stays constant, so
//   snapping and smart guides feel identical after zooming or panning.
//
// PRIORITY / TIE-BREAKING (documented, deterministic)
//   For a given coordinate, candidates within tolerance compete by:
//     1. Smallest absolute adjustment wins.
//     2. On a (near-)tie: object lines beat grid lines (aligning to a real
//        shape edge/centre is the more informative snap).
//     3. On a further tie: centre lines beat edge lines, then the smaller
//        target value wins.
//
// ANTI-JITTER (drag hysteresis)
//   Once the drag has snapped to an object target, that target is RETAINED
//   while it stays within tolerance, even when another candidate becomes
//   slightly closer. A competing target only takes over once it beats the
//   held one by SCREEN_TARGET_SWITCH_MARGIN_PX. This prevents rapid
//   flip-flopping between nearby alignment lines. When the pointer leaves
//   the tolerance band the snap releases (the position jump is bounded by
//   the tolerance itself, so the release is smooth).
//
// SMART GUIDES
//   Whenever an object snap is ACTUALLY applied, snapMoveWithGuides returns
//   the matching guide lines: one line per distinct aligned value, spanning
//   every object (moving group included) that shares that alignment.
//   Moving shapes never snap to themselves — callers exclude the moving
//   element IDs via `excludeIds`.
// =============================================================================

import type { CanvasElement } from '../types/canvas'
import { getElementBounds, getRotatedAABB, type Bounds } from './bounds'

// ---------------------------------------------------------------------------
// Settings & constants
// ---------------------------------------------------------------------------

/** Structurally compatible with the store's SnapConfig (kept store-free on purpose). */
export interface SnapSettings {
  snapToGrid: boolean
  gridSize: number
  snapToObjects: boolean
}

/**
 * Automatic snapping / smart-guide tolerance, in SCREEN pixels.
 * Converted to world units per call via worldSnapTolerance(zoom).
 */
export const SCREEN_SNAP_TOLERANCE_PX = 6

/**
 * Hysteresis margin for switching between competing object targets, in
 * SCREEN pixels: a new target must beat the held one by this much before
 * the snap jumps. Prevents jitter between nearby alignment lines.
 */
export const SCREEN_TARGET_SWITCH_MARGIN_PX = 2

/**
 * World-space tolerance when grouping snap lines that share a value into one
 * guide (float noise from rotated AABBs must not split a single guide).
 */
export const GUIDE_GROUP_EPSILON = 0.01

// ---------------------------------------------------------------------------
// Snap lines (candidate alignment guides)
// ---------------------------------------------------------------------------

export interface SnapLine {
  /** 'x' lines are vertical (match horizontal position); 'y' are horizontal. */
  axis: 'x' | 'y'
  /** World coordinate of the line on its axis. */
  value: number
  kind: 'edge' | 'center'
  elementId: string
  /**
   * Extent of the owning object ALONG the line (perpendicular to `axis`):
   * for an 'x' (vertical) line this is the object's [top, bottom] range;
   * for a 'y' (horizontal) line its [left, right] range. Used to size smart
   * guides so they span every object that shares the alignment.
   */
  spanStart?: number
  spanEnd?: number
}

/**
 * Collect every alignment line (left/centre/right, top/middle/bottom) of the
 * given elements, using the rotated axis-aligned bounding box so rotated
 * shapes expose their visual extremes. Each line carries the perpendicular
 * extent of its object for smart-guide rendering.
 *
 * @param elements   candidate shapes
 * @param excludeIds shapes to skip (the ones currently being moved/drawn)
 */
export function collectSnapLines(
  elements: CanvasElement[],
  excludeIds: Iterable<string> = []
): SnapLine[] {
  const excluded = new Set(excludeIds)
  const lines: SnapLine[] = []

  for (const element of elements) {
    if (excluded.has(element.id)) continue

    const bounds = getRotatedAABB(
      getElementBounds(element),
      element.transform.rotation ?? 0
    )

    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2

    lines.push(
      { axis: 'x', value: bounds.x, kind: 'edge', elementId: element.id,
        spanStart: bounds.y, spanEnd: bounds.y + bounds.height },
      { axis: 'x', value: centerX, kind: 'center', elementId: element.id,
        spanStart: bounds.y, spanEnd: bounds.y + bounds.height },
      { axis: 'x', value: bounds.x + bounds.width, kind: 'edge', elementId: element.id,
        spanStart: bounds.y, spanEnd: bounds.y + bounds.height },
      { axis: 'y', value: bounds.y, kind: 'edge', elementId: element.id,
        spanStart: bounds.x, spanEnd: bounds.x + bounds.width },
      { axis: 'y', value: centerY, kind: 'center', elementId: element.id,
        spanStart: bounds.x, spanEnd: bounds.x + bounds.width },
      { axis: 'y', value: bounds.y + bounds.height, kind: 'edge', elementId: element.id,
        spanStart: bounds.x, spanEnd: bounds.x + bounds.width }
    )
  }

  return lines
}

/** World-space snapping tolerance for the current zoom level. */
export function worldSnapTolerance(zoom: number): number {
  return SCREEN_SNAP_TOLERANCE_PX / (zoom > 0 ? zoom : 1)
}

// ---------------------------------------------------------------------------
// Core axis snapping
// ---------------------------------------------------------------------------

export type SnapKind = 'edge' | 'center' | 'grid'

export interface AxisSnap {
  /** The snapped coordinate. */
  value: number
  /** The snap line / grid line that produced the snap. */
  target: number
  kind: SnapKind
  /** Absolute adjustment applied (|value − original|). */
  distance: number
}

/** Lower rank = preferred when distances tie. */
function kindRank(kind: SnapKind): number {
  if (kind === 'center') return 0
  if (kind === 'edge') return 1
  return 2 // grid
}

/** Minimal shape of a competing snap, shared by point and move snapping. */
interface CandidateLike {
  kind: SnapKind
  target: number
  distance: number
}

/**
 * THE single tie-breaking rule of this module. True when `candidate` should
 * replace `best`:
 *   1. smaller absolute distance wins;
 *   2. on a (near-)tie: object beats grid, centre beats edge;
 *   3. otherwise the smaller target value wins (deterministic).
 */
function isBetterCandidate(candidate: CandidateLike, best: CandidateLike): boolean {
  if (candidate.distance < best.distance - 1e-9) return true
  if (Math.abs(candidate.distance - best.distance) > 1e-9) return false

  const candidateRank = kindRank(candidate.kind)
  const bestRank = kindRank(best.kind)
  if (candidateRank !== bestRank) return candidateRank < bestRank
  return candidate.target < best.target
}

/**
 * Snap a single coordinate to the best available target.
 *
 * @param value       the coordinate to snap (world units)
 * @param objectLines candidate object lines for the SAME axis
 * @param settings    grid/object snapping configuration
 * @param tolerance   world-space tolerance (use worldSnapTolerance(zoom))
 */
export function snapAxisValue(
  value: number,
  objectLines: SnapLine[],
  settings: SnapSettings,
  tolerance: number
): AxisSnap | null {
  let best: AxisSnap | null = null

  const consider = (candidate: AxisSnap) => {
    if (!best || isBetterCandidate(candidate, best)) {
      best = candidate
    }
  }

  if (settings.snapToObjects) {
    for (const line of objectLines) {
      const distance = Math.abs(line.value - value)
      if (distance <= tolerance) {
        consider({ value: line.value, target: line.value, kind: line.kind, distance })
      }
    }
  }

  if (settings.snapToGrid && settings.gridSize > 0) {
    const grid = settings.gridSize
    const nearest = Math.round(value / grid) * grid
    const distance = Math.abs(nearest - value)
    if (distance <= tolerance) {
      consider({ value: nearest, target: nearest, kind: 'grid', distance })
    }
  }

  return best
}

// ---------------------------------------------------------------------------
// Point snapping (drawing)
// ---------------------------------------------------------------------------

/**
 * Snap a world point to nearby object lines and/or the grid.
 * Returns the point unchanged when nothing is within tolerance.
 *
 * @param elements   all document shapes (a shape being drawn is not in here yet)
 * @param excludeIds shapes that must not act as targets (e.g. the moving shape)
 */
export function snapPoint(
  point: { x: number; y: number },
  elements: CanvasElement[],
  settings: SnapSettings,
  zoom: number,
  excludeIds: Iterable<string> = []
): { x: number; y: number } {
  if (!settings.snapToGrid && !settings.snapToObjects) return point

  const tolerance = worldSnapTolerance(zoom)
  const lines = settings.snapToObjects
    ? collectSnapLines(elements, excludeIds)
    : []

  const xLines = lines.filter((line) => line.axis === 'x')
  const yLines = lines.filter((line) => line.axis === 'y')

  const snapX = snapAxisValue(point.x, xLines, settings, tolerance)
  const snapY = snapAxisValue(point.y, yLines, settings, tolerance)

  return {
    x: snapX ? snapX.value : point.x,
    y: snapY ? snapY.value : point.y,
  }
}

// ---------------------------------------------------------------------------
// Move snapping (drag) with smart guides
// ---------------------------------------------------------------------------

/** A single competing snap for the moving bounds on one axis. */
interface MoveCandidate {
  /** Adjustment added to the raw delta so the position lands on the target. */
  adjust: number
  /** The snap line / grid line this candidate locks onto. */
  target: number
  kind: SnapKind
  distance: number
}

/**
 * A Figma-style smart guide: a thin line marking an alignment shared by the
 * moving group and ≥1 stationary object. World coordinates; the renderer
 * divides its stroke width by zoom to keep it ~1px on screen.
 */
export interface SmartGuide {
  /** 'x' → vertical line at `value`; 'y' → horizontal line at `value`. */
  axis: 'x' | 'y'
  /** World coordinate of the line on its axis. */
  value: number
  /** Extent of the line ALONG it — union of every aligned object's extent. */
  start: number
  end: number
  /** Moving group ids first, then the stationary ids sharing the alignment. */
  elementIds: string[]
}

/** Held (hysteresis) targets carried between drag samples, per axis. */
export interface MoveSnapHeld {
  x: number | null
  y: number | null
}

export interface MoveSnapResult {
  /** Final total delta from drag start (same value applied to every moving shape). */
  deltaX: number
  deltaY: number
  /** Aligned object guides for this sample; empty when nothing aligns. */
  guides: SmartGuide[]
  /** Targets to retain on the next sample (anti-jitter). */
  held: MoveSnapHeld
}

export interface MoveSnapOptions {
  /** Held targets from the previous drag sample (null on drag start). */
  held?: MoveSnapHeld
  /** IDs of the moving shapes — attributed to every guide they participate in. */
  movingIds?: Iterable<string>
}

const NO_HELD: MoveSnapHeld = { x: null, y: null }

/**
 * All competing snaps for the moving bounds on one axis: each of the three
 * candidate positions (min edge, centre, max edge) against every object line
 * and the nearest grid line within tolerance.
 */
function collectMoveCandidates(
  positions: number[],
  lines: SnapLine[],
  settings: SnapSettings,
  tolerance: number
): MoveCandidate[] {
  const candidates: MoveCandidate[] = []

  for (const position of positions) {
    if (settings.snapToObjects) {
      for (const line of lines) {
        const distance = Math.abs(line.value - position)
        if (distance <= tolerance) {
          candidates.push({
            adjust: line.value - position,
            target: line.value,
            kind: line.kind,
            distance,
          })
        }
      }
    }

    if (settings.snapToGrid && settings.gridSize > 0) {
      const grid = settings.gridSize
      const nearest = Math.round(position / grid) * grid
      const distance = Math.abs(nearest - position)
      if (distance <= tolerance) {
        candidates.push({ adjust: nearest - position, target: nearest, kind: 'grid', distance })
      }
    }
  }

  return candidates
}

/**
 * Pick the candidate to snap to, honouring the held target (hysteresis):
 * the held object target wins while it remains within tolerance unless a
 * competitor beats it by more than `switchMargin`.
 */
function chooseCandidate(
  candidates: MoveCandidate[],
  heldTarget: number | null,
  switchMargin: number
): MoveCandidate | null {
  if (candidates.length === 0) return null

  let best = candidates[0]
  for (let i = 1; i < candidates.length; i++) {
    if (isBetterCandidate(candidates[i], best)) best = candidates[i]
  }

  if (heldTarget === null) return best

  // Best OBJECT candidate locking onto the held target (grid candidates never
  // count as held — grid lines move continuously with the pointer).
  let heldCandidate: MoveCandidate | null = null
  for (const candidate of candidates) {
    if (candidate.kind === 'grid') continue
    if (Math.abs(candidate.target - heldTarget) > GUIDE_GROUP_EPSILON) continue
    if (!heldCandidate || isBetterCandidate(candidate, heldCandidate)) {
      heldCandidate = candidate
    }
  }

  if (!heldCandidate) return best // held target left the tolerance band → release

  // Switch only when a competitor clearly beats the held target — this is
  // what prevents rapid flip-flopping between nearby alignment lines.
  if (isBetterCandidate(best, heldCandidate) && best.distance < heldCandidate.distance - switchMargin) {
    return best
  }
  return heldCandidate
}

/**
 * Build the smart guide for one axis, or null when the chosen snap does not
 * correspond to any object alignment (e.g. a grid-only snap).
 *
 * The guide's extent is the union of the FINAL moving-group bounds and every
 * stationary object whose line shares the snapped value — so several objects
 * sharing one alignment produce a single line through all of them.
 */
function buildAxisGuide(
  axis: 'x' | 'y',
  chosen: MoveCandidate | null,
  lines: SnapLine[],
  finalMovingBounds: Bounds,
  movingIds: string[],
  settings: SnapSettings
): SmartGuide | null {
  if (!chosen || !settings.snapToObjects) return null

  const matched = lines.filter(
    (line) => line.axis === axis && Math.abs(line.value - chosen.target) <= GUIDE_GROUP_EPSILON
  )
  if (matched.length === 0) return null

  let start = axis === 'x' ? finalMovingBounds.y : finalMovingBounds.x
  let end = axis === 'x'
    ? finalMovingBounds.y + finalMovingBounds.height
    : finalMovingBounds.x + finalMovingBounds.width

  const ids = new Set(movingIds)
  for (const line of matched) {
    ids.add(line.elementId)
    if (line.spanStart !== undefined) start = Math.min(start, line.spanStart)
    if (line.spanEnd !== undefined) end = Math.max(end, line.spanEnd)
  }

  return { axis, value: chosen.target, start, end, elementIds: [...ids] }
}

/**
 * Compute the final delta AND the smart guides for one drag sample.
 *
 * - The SAME delta is applied uniformly to every moving shape, so a
 *   multi-selection keeps its relative positions exactly.
 * - `held` carries the object target locked on the previous sample; it is
 *   retained while within tolerance (switching requires a clear margin) —
 *   this is the anti-jitter hysteresis. When the pointer leaves the band the
 *   snap releases; the position jump is bounded by the tolerance.
 * - Guides are produced only when the chosen snap lands the moving bounds on
 *   an OBJECT line; grid-only snaps never draw guides (the grid is visible).
 * - `lines` must be collected with ALL moving shapes excluded so objects
 *   never snap to themselves or their drag partners.
 *
 * @param bounds    moving-group bounds at drag start (union AABB)
 * @param rawDeltaX unsnapped total X delta from drag start
 * @param rawDeltaY unsnapped total Y delta from drag start
 */
export function snapMoveWithGuides(
  bounds: Bounds,
  rawDeltaX: number,
  rawDeltaY: number,
  lines: SnapLine[],
  settings: SnapSettings,
  zoom: number,
  options: MoveSnapOptions = {}
): MoveSnapResult {
  if (!settings.snapToGrid && !settings.snapToObjects) {
    return { deltaX: rawDeltaX, deltaY: rawDeltaY, guides: [], held: { ...NO_HELD } }
  }

  const safeZoom = zoom > 0 ? zoom : 1
  const tolerance = worldSnapTolerance(zoom)
  const switchMargin = SCREEN_TARGET_SWITCH_MARGIN_PX / safeZoom
  const held = options.held ?? NO_HELD
  const movingIds = [...(options.movingIds ?? [])]

  const xLines = lines.filter((line) => line.axis === 'x')
  const yLines = lines.filter((line) => line.axis === 'y')

  const xPositions = [
    bounds.x + rawDeltaX,
    bounds.x + bounds.width / 2 + rawDeltaX,
    bounds.x + bounds.width + rawDeltaX,
  ]
  const yPositions = [
    bounds.y + rawDeltaY,
    bounds.y + bounds.height / 2 + rawDeltaY,
    bounds.y + bounds.height + rawDeltaY,
  ]

  const chosenX = chooseCandidate(
    collectMoveCandidates(xPositions, xLines, settings, tolerance),
    held.x,
    switchMargin
  )
  const chosenY = chooseCandidate(
    collectMoveCandidates(yPositions, yLines, settings, tolerance),
    held.y,
    switchMargin
  )

  const deltaX = rawDeltaX + (chosenX?.adjust ?? 0)
  const deltaY = rawDeltaY + (chosenY?.adjust ?? 0)

  // Guides span the FINAL (snapped) position of the moving group.
  const finalBounds: Bounds = {
    x: bounds.x + deltaX,
    y: bounds.y + deltaY,
    width: bounds.width,
    height: bounds.height,
  }

  const guideX = buildAxisGuide('x', chosenX, xLines, finalBounds, movingIds, settings)
  const guideY = buildAxisGuide('y', chosenY, yLines, finalBounds, movingIds, settings)

  const guides: SmartGuide[] = []
  if (guideX) guides.push(guideX)
  if (guideY) guides.push(guideY)

  return {
    deltaX,
    deltaY,
    guides,
    held: {
      x: guideX && chosenX ? chosenX.target : null,
      y: guideY && chosenY ? chosenY.target : null,
    },
  }
}

/**
 * Back-compat wrapper: snap a drag delta without guides or hysteresis.
 * Delegates to snapMoveWithGuides so there is exactly ONE snapping algorithm.
 */
export function snapMoveDelta(
  bounds: Bounds,
  rawDeltaX: number,
  rawDeltaY: number,
  lines: SnapLine[],
  settings: SnapSettings,
  zoom: number
): { deltaX: number; deltaY: number } {
  const result = snapMoveWithGuides(bounds, rawDeltaX, rawDeltaY, lines, settings, zoom)
  return { deltaX: result.deltaX, deltaY: result.deltaY }
}