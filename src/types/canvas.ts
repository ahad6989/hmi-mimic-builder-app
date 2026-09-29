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
  | 'polyline'
  | 'pen'
  | 'text'

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
  opacity: number               // 0.0 – 1.0
  strokeDashArray: string       // e.g. '' (solid), '6 4' (dashed), '2 4' (dotted)
  strokeLineCap: 'butt' | 'round' | 'square'
  strokeLineJoin: 'miter' | 'round' | 'bevel'
}

export interface TextStyleAttributes {
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline'
  color: string
  backgroundColor?: string
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

export interface PathPoint {
  x: number
  y: number
  handleOut?: {
    x: number
    y: number
  }
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
  textStyle: TextStyleAttributes

  // --- Type-specific optional fields ---
  rx?: number             // Horizontal corner radius (rect only)
  ry?: number             // Vertical corner radius   (rect only)
  x1?: number             // First endpoint x-coordinate (line only)
  y1?: number             // First endpoint y-coordinate (line only)
  x2?: number             // Second endpoint x-coordinate (line only)
  y2?: number             // Second endpoint y-coordinate (line only)
  points?: PathPoint[]  // Polyline / path anchor points
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
  fill: 'var(--canvas-default-fill)',
  fillOpacity: 1,
  stroke: 'var(--canvas-default-stroke)',
  strokeWidth: 2,
  strokeOpacity: 1,
  opacity: 1,
  strokeDashArray: '',
  strokeLineCap: 'butt',
  strokeLineJoin: 'miter',
}

export const DEFAULT_TEXT_STYLE: TextStyleAttributes = {
  content: '',
  fontFamily: 'sans-serif',
  fontSize: 16,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#000000',
  backgroundColor: 'transparent',
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
    textStyle: { ...DEFAULT_TEXT_STYLE },
  }
}

/** Create a ready-to-store ellipse element from its center and radii. */
export function createEllipseElement(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  overrides: Partial<StyleAttributes> = {}
): CanvasElement {
  return {
    id: crypto.randomUUID(),
    name: 'Ellipse',
    type: 'ellipse',
    visible: true,
    locked: false,
    transform: {
      x: cx - rx,
      y: cy - ry,
      width: rx * 2,
      height: ry * 2,
      rotation: 0,
    },
    style: { ...DEFAULT_STYLE, ...overrides },
    textStyle: { ...DEFAULT_TEXT_STYLE },
  }
}

/** Create a ready-to-store line element from two endpoints. */
export function createLineElement(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): CanvasElement {
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)

  return {
    id: crypto.randomUUID(),
    name: 'Line',
    type: 'line',
    visible: true,
    locked: false,
    transform: {
      x,
      y,
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      rotation: 0,
    },
    style: {
      ...DEFAULT_STYLE,
      fill: 'none',
    },
    x1,
    y1,
    x2,
    y2,
    textStyle: { ...DEFAULT_TEXT_STYLE },
  }
}

/** Create a ready-to-store polyline element from an ordered point list. */
export function createPolylineElement(
  points: Array<{ x: number; y: number }>
): CanvasElement {
  const copiedPoints = points.map((point) => ({ x: point.x, y: point.y }))
  const xValues = copiedPoints.map((point) => point.x)
  const yValues = copiedPoints.map((point) => point.y)
  const x = xValues.length > 0 ? Math.min(...xValues) : 0
  const y = yValues.length > 0 ? Math.min(...yValues) : 0
  const maxX = xValues.length > 0 ? Math.max(...xValues) : 0
  const maxY = yValues.length > 0 ? Math.max(...yValues) : 0

  return {
    id: crypto.randomUUID(),
    name: 'Polyline',
    type: 'polyline',
    visible: true,
    locked: false,
    transform: {
      x,
      y,
      width: maxX - x,
      height: maxY - y,
      rotation: 0,
    },
    style: {
      ...DEFAULT_STYLE,
      fill: 'none',
    },
    points: copiedPoints,
    textStyle: { ...DEFAULT_TEXT_STYLE },
  }
}

/** Create a ready-to-store open path from an ordered anchor point list. */
export function buildPathData(points: PathPoint[]): string {
  return points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`

      const previousPoint = points[index - 1]
      if (!previousPoint.handleOut) return `L ${point.x} ${point.y}`

      return `C ${previousPoint.handleOut.x} ${previousPoint.handleOut.y} ${point.x} ${point.y} ${point.x} ${point.y}`
    })
    .join(' ')
}

export function createPathElement(
  points: PathPoint[]
): CanvasElement {
  const copiedPoints = points.map((point) => ({
    x: point.x,
    y: point.y,
    ...(point.handleOut ? { handleOut: { ...point.handleOut } } : {}),
  }))
  const xValues = copiedPoints.map((point) => point.x)
  const yValues = copiedPoints.map((point) => point.y)
  const x = xValues.length > 0 ? Math.min(...xValues) : 0
  const y = yValues.length > 0 ? Math.min(...yValues) : 0
  const maxX = xValues.length > 0 ? Math.max(...xValues) : 0
  const maxY = yValues.length > 0 ? Math.max(...yValues) : 0
  const pathData = buildPathData(copiedPoints)

  return {
    id: crypto.randomUUID(),
    name: 'Path',
    type: 'path',
    visible: true,
    locked: false,
    transform: {
      x,
      y,
      width: maxX - x,
      height: maxY - y,
      rotation: 0,
    },
    style: {
      ...DEFAULT_STYLE,
      fill: 'none',
    },
    points: copiedPoints,
    pathData,
    textStyle: { ...DEFAULT_TEXT_STYLE },
  }
}

export function createTextElement(x: number, y: number): CanvasElement {
  return {
    id: crypto.randomUUID(),
    name: 'Text',
    type: 'text',
    visible: true,
    locked: false,
    transform: { x, y, width: 0, height: DEFAULT_TEXT_STYLE.fontSize, rotation: 0 },
    style: { ...DEFAULT_STYLE, fill: DEFAULT_TEXT_STYLE.color },
    textStyle: { ...DEFAULT_TEXT_STYLE },
  }
}
