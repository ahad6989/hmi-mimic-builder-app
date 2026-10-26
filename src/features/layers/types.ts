// =============================================================================
// layers/types.ts — Layers panel shared types
// =============================================================================
//
// Responsibilities:
//   - Define the data shape of a single list item shown in the Layers panel.
//   - Keep the panel render logic free of canvas-shape internals.
//
// EXISTING-BEHAVIOUR PRESERVATION:
//   - Read-only: the panel renders from the store's `elements` array via
//     `toLayerModel` in layerModel.ts. This module only defines shapes.
// =============================================================================

import type { CanvasElement } from '../../types/canvas'

/** A single entry in the Layers panel list. */
export interface LayerItem {
  /** Stable id used for state updates (store does not store layers). */
  id: string
  /** The underlying canvas element. */
  element: CanvasElement
  /** Depth in the z-stack (index 0 = bottom of the list). */
  index: number
  /** Whether this item represents a collapsed group (if supported). */
  isGroupHeader?: boolean
  /** Optional child items when `isGroupHeader` is true. */
  children?: LayerItem[]
}

/** Collapsed state for the whole panel. */
export interface LayersPanelState {
  expanded: boolean
  filter: string
}

/**
 * The panel can be narrowed with a simple text filter.
 * Empty string = show everything.
 */
export type LayerFilter = '' | 'visible' | 'locked' | 'text'

/** Filter options exposed by the Layers panel filter dropdown. */
export const LAYER_FILTERS: { value: LayerFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'visible', label: 'Visible' },
  { value: 'locked', label: 'Locked' },
  { value: 'text', label: 'Text' },
]
