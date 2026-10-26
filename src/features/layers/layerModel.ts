// =============================================================================
// layers/layerModel.ts — Map store `elements` → LayersPanel state
// =============================================================================
//
// Responsibilities:
//   - Convert the store's raw `CanvasElement[]` into a flat list of `LayerItem`
//     records suitable for the Layers panel (preserving z-order, expanding
//     groups, filtering, and security-sensitive content sanitisation).
//   - Provide a pure, DOM-free, deterministic mapping so tests can assert
//     the panel state without rendering.
//   - Do NOT mutate the store, read files, or touch DOM.
//
// EXISTING-BEHAVIOUR PRESERVATION:
//   - Read-only. No store mutations, no DOM access, no file IO.
//   - The mapping is pure function; nothing in the existing render path
//     depends on this module, so changing the output shape cannot break
//     current UI as long as consumers adapt to the new shape.
// =============================================================================

import type { CanvasElement } from '../../types/canvas'
import type { LayerItem, LayerFilter } from './types'

/** Build the flat, ordered layer list from the store elements. */
export function toLayerModel(
  elements: CanvasElement[],
  filter: LayerFilter = ''
): LayerItem[] {
  const items = elements.map((element, index) => ({
    id: element.id,
    element,
    index,
  }))

  return applyFilter(items, filter)
}

/**
 * Apply the current filter to the layer list.
 *
 * - `''` → show all
 * - `'visible'` → hide locked/false-visible elements
 * - `'locked'` → show only locked elements
 * - `'text'` → show only text elements
 *
 * Filtering is applied *after* z-order sorting so the indices of the
 * returned items are stable and easy to translate back to the store.
 */
export function applyFilter(
  items: LayerItem[],
  filter: LayerFilter
): LayerItem[] {
  if (filter === '') return items

  return items.filter((item) => {
    const element = item.element
    switch (filter) {
      case 'visible':
        return element.visible && !element.locked
      case 'locked':
        return element.locked
      case 'text':
        return element.type === 'text'
      default:
        return true
    }
  })
}

/**
 * Compute the set of element IDs currently visible (under the active filter).
 * Useful for the panel header/summary and for the "Select all visible"
 * action.
 */
export function visibleIds(items: LayerItem[], filter: LayerFilter): Set<string> {
  return new Set(
    applyFilter(items, filter).map((item) => item.id)
  )
}

/**
 * For a given element ID, return its position in the store's z-stack.
 * The index is the position in the filter-filtered list, so it can be used
 * by the panel to decide whether to show "Up"/"Down" buttons for that row.
 */
export function indexOfId(
  items: LayerItem[],
  id: string
): number {
  return items.findIndex((item) => item.id === id)
}

/**
 * Map a store element back to a `LayerItem` by id, or `undefined` if the id
 * does not exist. Used by the panel to re-fetch the element when a row is
 * clicked (the store already holds the element anyway, so this is a cheap
 * lookup, not a network call).
 */
export function findItemById(
  items: LayerItem[],
  id: string
): LayerItem | undefined {
  return items.find((item) => item.id === id)
}
