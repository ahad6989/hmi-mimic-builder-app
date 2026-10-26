// =============================================================================
// canvasFeatureModules.ts — Public canvas-feature API surface
// =============================================================================
//
// A single importable facade for the canvas features implemented across the
// `src/features/canvas/` directory. This keeps the consumers (Canvas.tsx,
// TopBar.tsx, and any future canvas-preset dialog) to one stable surface.
//
// FEATURES PROVIDED:
//   - Canvas preset management (zoom levels + canvas size)
//   - Canvas design/prototype construction from a preset
//   - Keyboard-driven viewport/zoom/reset controller
//
// EXISTING-BEHAVIOUR PRESERVATION:
//   - This module re-exports/trivially wraps the existing, tested
//     geometry/coordinates math and the existing Zustand store actions.
//   - It does not add new SVG render paths, export logic, or UI chrome.
// =============================================================================

// ---------------------------------------------------------------------------
// Canvas preset management
// ---------------------------------------------------------------------------

export {
  ZOOM_PRESETS,
  CANVAS_SIZE_PRESETS,
  findZoomPreset,
  findCanvasSizePreset,
  computeFitToCanvasViewport,
  getVisibleWorldRect,
  applyCanvasPreset,
  viewportToCanvasPreset,
} from './canvasPresetManager'

export type {
  ZoomPreset,
  CanvasSizePreset,
  CanvasPreset,
} from './canvasPresetManager'

// ---------------------------------------------------------------------------
// Canvas design/prototype construction
// ---------------------------------------------------------------------------

export {
  getCanvasPresetOptions,
  applyCanvasSizePreset,
  resetCanvas,
  resetCanvasState,
} from './canvasDesignPrototype'

export type { CanvasPresetOption, CurrentCanvasPreset } from './canvasDesignPrototype'

// ---------------------------------------------------------------------------
// Canvas keyboard controller
// ---------------------------------------------------------------------------

export {
  clampZoom,
  zoomBy,
  getCanvasDimensions,
  panBy,
  zoomToFit,
  resetViewport,
  CANVAS_KEYBOARD_ACTIONS,
} from './canvasKeyboardController'

export type { KeyboardAction } from './canvasKeyboardController'

// ---------------------------------------------------------------------------
// Canvas tool registry
// ---------------------------------------------------------------------------

export interface CanvasTool {
  name: string
  key: string
  category: 'Selection' | 'Shapes' | 'Drawing' | 'Text' | 'Navigation'
  cursor?: string
}

export const REGISTERED_TOOLS: CanvasTool[] = [
  { name: 'Select', key: 'V', category: 'Selection', cursor: 'default' },
  { name: 'Rectangle', key: 'R', category: 'Shapes', cursor: 'crosshair' },
  { name: 'Ellipse', key: 'E', category: 'Shapes', cursor: 'crosshair' },
  { name: 'Line', key: 'L', category: 'Drawing', cursor: 'crosshair' },
  { name: 'Polyline', key: 'P', category: 'Drawing', cursor: 'crosshair' },
  { name: 'Pen', key: 'B', category: 'Drawing', cursor: 'crosshair' },
  { name: 'Pencil', key: 'Y', category: 'Drawing', cursor: 'crosshair' },
  { name: 'Text', key: 'T', category: 'Text', cursor: 'text' },
  { name: 'Pan', key: 'H', category: 'Navigation', cursor: 'grab' },
]

export const TOOL_CATEGORIES = [
  { label: 'Selection', tools: REGISTERED_TOOLS.filter((t) => t.category === 'Selection') },
  { label: 'Shapes', tools: REGISTERED_TOOLS.filter((t) => t.category === 'Shapes') },
  { label: 'Drawing', tools: REGISTERED_TOOLS.filter((t) => t.category === 'Drawing') },
  { label: 'Text', tools: REGISTERED_TOOLS.filter((t) => t.category === 'Text') },
  { label: 'Navigation', tools: REGISTERED_TOOLS.filter((t) => t.category === 'Navigation') },
]

export function getAvailableTools(): CanvasTool[] {
  return REGISTERED_TOOLS
}

export function isToolEnabled(name: string): boolean {
  return REGISTERED_TOOLS.some((t) => t.name.toLowerCase() === name.toLowerCase())
}

export function getToolByName(name: string): CanvasTool | undefined {
  return REGISTERED_TOOLS.find((t) => t.name === name)
}
