// =============================================================================
// alignment/alignment.ts — Alignment and distribution of selected elements
// =============================================================================
//
// Responsibilities:
//   - Compute the target positions for aligning a set of selected elements
//     (left / centre / right / top / middle / bottom).
//   - Compute the target positions for distributing elements evenly along
//     the horizontal / vertical axes.
//   - Pure, DOM-free, deterministic: the caller owns the store and is
//     responsible for committing the resulting deltas via `updateElement`
//     / `moveElements`.
//   - Used by the alignment toolbar and the context menu.
//
// EXISTING-BEHAVIOUR PRESERVATION:
//   - Read-only. No store mutation, no DOM access.
//   - The unit of alignment is the element's *bounds*, which is exactly what
//     the existing `geometry/bounds` module uses.
// =============================================================================

import type { CanvasElement } from '../../types/canvas'
import { getElementBounds } from '../../geometry/bounds'

/** Axis used for alignment / distribution calculations. */
export type Axis = 'x' | 'y'

/**
 * How the elements are ordered along an axis.
 * - `spatial` → sort by the element's position on the axis (ascending).
 * - `selection` → preserve the passed order (the store's multi-selection
 *   order) and apply to that order.
 */
export type SortOrder = 'spatial' | 'selection'

export interface AlignmentTarget {
  axis: Axis
  /** 0 = left/top edge, 0.5 = centre, 1 = right/bottom edge. */
  position: number
  /** Whether the target is a geometric centre or an edge. */
  kind: 'edge' | 'center'
}

/**
 * Compute the target value shared by all elements after an alignment.
 * Returns the actual reference coordinate so callers know what value to
 * move towards.
 */
export function computeAlignmentTarget(
  elements: CanvasElement[],
  axis: Axis,
  position: number
): AlignmentTarget {
  if (elements.length === 0) {
    throw new Error('alignment: no elements to align')
  }
  if (position < 0 || position > 1) {
    throw new Error('alignment: position must be between 0 and 1')
  }

  if (position === 0) {
    return { axis, position: 0, kind: 'edge' }
  }
  if (position === 1) {
    return { axis, position: 1, kind: 'edge' }
  }

  return { axis, position: 0.5, kind: 'center' }
}

/**
 * Compute per-element deltas to reach the given alignment target.
 */
export function computeAlignmentDeltas(
  elements: CanvasElement[],
  target: AlignmentTarget,
  sortOrder: SortOrder = 'spatial'
): Map<string, { deltaX: number; deltaY: number }> {
  const result = new Map<string, { deltaX: number; deltaY: number }>()
  if (elements.length === 0) return result

  const sorted = sortOrder === 'spatial'
    ? [...elements].sort((a, b) => a.id.localeCompare(b.id))
    : elements

  const values = sorted.map((el) => {
    const b = getElementBounds(el)
    if (target.axis === 'x') {
      return target.kind === 'edge'
        ? target.position === 0
          ? b.x
          : b.x + b.width
        : b.x + b.width / 2
    }
    return target.kind === 'edge'
      ? target.position === 0
        ? b.y
        : b.y + b.height
      : b.y + b.height / 2
  })

  for (let i = 0; i < sorted.length; i++) {
    const el = sorted[i]
    const current = values[i]
    const reference = values[0]
    const delta = target.axis === 'x' ? reference - current : 0
    const odd = target.axis === 'y' ? reference - current : 0
    result.set(el.id, {
      deltaX: target.axis === 'x' ? delta : 0,
      deltaY: target.axis === 'y' ? odd : 0,
    })
  }

  return result
}

/**
 * Compute per-element deltas to distribute the given elements evenly along
 * the given axis.
 *
 * @param spaceBefore space before the first item (px)
 */
export function computeDistributionDeltas(
  elements: CanvasElement[],
  axis: Axis,
  spaceBefore: number,
  sortOrder: SortOrder = 'spatial'
): Map<string, { deltaX: number; deltaY: number }> {
  const count = elements.length
  const result = new Map<string, { deltaX: number; deltaY: number }>()
  if (count === 0) return result

  const bounds = elements.map((el) => getElementBounds(el))
  const sorted = sortOrder === 'spatial'
    ? [...elements].sort((a, b) => a.id.localeCompare(b.id))
    : elements

  const positions = sorted.map((_, i) => {
    const b = bounds[i]
    return axis === 'x' ? b.x : b.y
  })

  let cursor = spaceBefore

  for (let i = 0; i < count; i++) {
    const el = sorted[i]
    const current = positions[i]
    const target = axis === 'x' ? cursor : cursor
    const delta = target - current
    result.set(el.id, {
      deltaX: axis === 'x' ? delta : 0,
      deltaY: axis === 'y' ? delta : 0,
    })
    cursor += delta + (axis === 'x' ? bounds[i].width : bounds[i].height)
  }

  return result
}
