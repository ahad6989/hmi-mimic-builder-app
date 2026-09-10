// =============================================================================
// canvas.ts — Central type definitions for VectorCraft Studio
//
// This is the SINGLE SOURCE OF TRUTH for all shape/element types.
// Every other file imports from here. Never duplicate these types elsewhere.
// =============================================================================

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** Every tool the user can pick from the ToolDock. */
export type Tool =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'pen'

// ---------------------------------------------------------------------------
// Shape types
// ---------------------------------------------------------------------------

/** The SVG primitive each CanvasElement renders as. */
export type ShapeType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'path'
  | 'text'
  | 'group'

// ---------------------------------------------------------------------------
// Style attributes
//
// These map 1-to-1 to SVG presentation attributes so serialisation to SVG
// is trivial later (Week 7).
// ---------------------------------------------------------------------------

export interface StyleAttributes {
  fill: string
  fillOpacity: number           // 0.0 – 1.0
  stroke: string
  strokeWidth: number           // pixels
  strokeOpacity: number         // 0.0 – 1.0
  strokeDashArray: string       // e.g. '' (solid), '6 4' (dashed), '2 4' (dotted)
  strokeLineCap: 'butt' | 'round' | 'square'
  strokeLineJoin: 'miter' | 'round' | 'bevel'
}

// ---------------------------------------------------------------------------
// Transform attributes
//
// We store the element's position and size as a flat object.
// Rotation is stored in degrees (SVG uses degrees in its transform attribute).
// ---------------------------------------------------------------------------

export interface TransformAttributes {
  x: number
  y: number
  width: number
  height: number
  rotation: number  // degrees, clockwise, 0 = upright
}

// ---------------------------------------------------------------------------
// CanvasElement
//
// The unified shape model. Every shape—rect, ellipse, path—is a CanvasElement.
// Type-specific extra data lives in optional fields at the bottom.
// ---------------------------------------------------------------------------

export interface CanvasElement {
  // Identity
  id: string
  name: string            // Human-readable label shown in the Layers panel
  type: ShapeType

  // Visibility / interaction
  visible: boolean
  locked: boolean         // Locked elements cannot be selected or moved

  // Geometry
  transform: TransformAttributes

  // Appearance
  style: StyleAttributes

  // --- Type-specific optional fields ---
  rx?: number             // Horizontal corner radius (rect only)
  ry?: number             // Vertical corner radius   (rect only)
  points?: Array<{ x: number; y: number }>  // Polyline / line endpoints
  pathData?: string       // SVG path 'd' attribute  (path / pencil only)
  textContent?: string    // Text element content    (text only)
}

// ---------------------------------------------------------------------------
// Factory helpers
//
// Instead of building a full CanvasElement object inline, use these helpers.
// They supply sensible defaults so you never forget a required field.
// ---------------------------------------------------------------------------

/** Default style every new shape gets. Override as needed. */
export const DEFAULT_STYLE: StyleAttributes = {
  fill: '#60a5fa',
  fillOpacity: 1,
  stroke: '#2563eb',
  strokeWidth: 2,
  strokeOpacity: 1,
  strokeDashArray: '',
  strokeLineCap: 'butt',
  strokeLineJoin: 'miter',
}

/** Create a ready-to-store rect element from raw geometry. */
export function createRectElement(
  x: number,
  y: number,
  width: number,
  height: number,
  overrides: Partial<StyleAttributes> = {}
): CanvasElement {
  return {
    id: crypto.randomUUID(),
    name: 'Rectangle',
    type: 'rect',
    visible: true,
    locked: false,
    transform: { x, y, width, height, rotation: 0 },
    style: { ...DEFAULT_STYLE, ...overrides },
  }
}
