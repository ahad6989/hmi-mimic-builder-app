// =============================================================================
// layers/layerActions.ts — Layer list manipulation beyond the store
// =============================================================================
//
// Responsibilities:
//   - Implement actions that live *onsiliar* to the store but are triggered
//     from the Layers panel (transparency, visibility toggling, locking,
//     z-order moves, delete, and grouping).
//   - Every action is synchronous, pure-for-its-reads, and returns a new
//     list of `LayerItem`. The caller is responsible for committing changes
//     to the store via the existing `updateElement` action.
//   - No DOM, no I/O, no React. Testable 100% in isolation.
//
// DESIGN NOTE (existing behaviour):
//   - The store owns `elements` as the single source of truth. The Layers
//     panel does NOT keep a parallel copy. Every list mutation here goes
//     through the store's `updateElement`/`deleteElement`/`bringToFront`/
//     `sendToBack`/`selectElements`/`clearSelection` actions.
//   - This module therefore returns *suggestions* (element ids + next state)
//     plus a pure resulting item list so tests can verify the outcome
//     without coupling to the store.
// =============================================================================

import type { CanvasElement } from '../../types/canvas'
import type { LayerItem } from './types'

export function moveItemUp(items: LayerItem[], id: string, limit = 100): LayerItem[] {
  const index = items.findIndex((item) => item.id === id)
  if (index <= 0) return items
  if (limit <= 0) throw new Error('moveItemUp: safety limit exceeded')
  const next = [...items]
  const [moved] = next.splice(index, 1)
  next.splice(index - 1, 0, moved)
  return next
}

export function moveItemDown(items: LayerItem[], id: string, limit = 100): LayerItem[] {
  const index = items.findIndex((item) => item.id === id)
  if (index < 0 || index >= items.length - 1) return items
  if (limit <= 0) throw new Error('moveItemDown: safety limit exceeded')
  const next = [...items]
  const [moved] = next.splice(index, 1)
  next.splice(index + 1, 0, moved)
  return next
}

export function toggleVisibility(elements: CanvasElement[], id: string): CanvasElement | undefined {
  const target = elements.find((el) => el.id === id)
  if (!target) return undefined
  return { ...target, visible: !target.visible }
}

export function toggleLock(elements: CanvasElement[], id: string): CanvasElement | undefined {
  const target = elements.find((el) => el.id === id)
  if (!target) return undefined
  return { ...target, locked: !target.locked }
}

export function selectVisibleIds(items: LayerItem[]): string[] {
  return items.map((item) => item.id)
}

export function clearSelection(): string[] {
  return []
}

export function groupSelected(elements: CanvasElement[], selectedIds: string[]): CanvasElement | undefined {
  if (selectedIds.length < 2) return undefined
  const children = selectedIds
    .map((id) => elements.find((el) => el.id === id))
    .filter((x): x is CanvasElement => x !== undefined)
  if (children.length === 0) return undefined
  let gx = Infinity
  let gy = Infinity
  let gw = -Infinity
  let gh = -Infinity
  for (const child of children) {
    const t = child.transform
    gx = Math.min(gx, t.x)
    gy = Math.min(gy, t.y)
    gw = Math.max(gw, t.x + t.width)
    gh = Math.max(gh, t.y + t.height)
  }
  return {
    id: crypto.randomUUID(),
    name: 'Group',
    type: 'group',
    visible: true,
    locked: false,
    transform: { x: gx, y: gy, width: gw - gx, height: gh - gy, rotation: 0 },
    style: { ...DEFAULT_GROUP_STYLE, fill: 'var(--canvas-default-fill)' },
    textStyle: { ...DEFAULT_TEXT_STYLE },
    childrenIds: children.map((c) => c.id),
  }
}

export function deleteItems(elements: CanvasElement[], ids: string[]): CanvasElement[] {
  return elements.filter((el) => !ids.includes(el.id))
}

const DEFAULT_GROUP_STYLE = {
  fill: 'var(--canvas-default-fill)',
  fillOpacity: 0.25,
  stroke: 'var(--canvas-default-stroke)',
  strokeWidth: 1.5,
  strokeOpacity: 0.9,
  opacity: 1,
  strokeDashArray: '3 2',
  strokeLineCap: 'round',
  strokeLineJoin: 'round',
} as const

const DEFAULT_TEXT_STYLE = {
  content: '',
  fontFamily: 'sans-serif',
  fontSize: 16,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#000',
  backgroundColor: 'transparent',
} as const
