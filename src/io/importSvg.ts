// =============================================================================
// src/io/importSvg.ts — Pure SVG Importer for VectorCraft Studio
// =============================================================================

import type {
  CanvasElement,
  PathPoint,
  StyleAttributes,
  TextStyleAttributes,
} from '../types/canvas'

export interface SvgParseResult {
  elements: CanvasElement[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// 2D Affine Matrix Math [a, b, c, d, e, f]
//
// [ a  c  e ]
// [ b  d  f ]
// [ 0  0  1 ]
// ---------------------------------------------------------------------------

type Matrix2D = readonly [number, number, number, number, number, number]

const IDENTITY_MATRIX: Matrix2D = [1, 0, 0, 1, 0, 0]

function multiplyMatrices(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

function transformPoint(m: Matrix2D, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  }
}

function isIdentity(m: Matrix2D): boolean {
  return (
    Math.abs(m[0] - 1) < 1e-9 &&
    Math.abs(m[1]) < 1e-9 &&
    Math.abs(m[2]) < 1e-9 &&
    Math.abs(m[3] - 1) < 1e-9 &&
    Math.abs(m[4]) < 1e-9 &&
    Math.abs(m[5]) < 1e-9
  )
}

function parseTransform(transformStr: string | null): Matrix2D {
  if (!transformStr || !transformStr.trim()) {
    return IDENTITY_MATRIX
  }

  let current: Matrix2D = IDENTITY_MATRIX
  const commandRegex = /([a-zA-Z]+)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null

  while ((match = commandRegex.exec(transformStr)) !== null) {
    const cmd = match[1].toLowerCase()
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .map((val) => parseFloat(val))
      .filter((val) => Number.isFinite(val))

    let m: Matrix2D = IDENTITY_MATRIX

    if (cmd === 'translate') {
      const tx = args[0] ?? 0
      const ty = args[1] ?? 0
      m = [1, 0, 0, 1, tx, ty]
    } else if (cmd === 'scale') {
      const sx = args[0] ?? 1
      const sy = args[1] ?? sx
      m = [sx, 0, 0, sy, 0, 0]
    } else if (cmd === 'rotate') {
      const deg = args[0] ?? 0
      const rad = (deg * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      if (args.length >= 3) {
        const cx = args[1]
        const cy = args[2]
        const toOrigin: Matrix2D = [1, 0, 0, 1, -cx, -cy]
        const rot: Matrix2D = [cos, sin, -sin, cos, 0, 0]
        const fromOrigin: Matrix2D = [1, 0, 0, 1, cx, cy]
        m = multiplyMatrices(fromOrigin, multiplyMatrices(rot, toOrigin))
      } else {
        m = [cos, sin, -sin, cos, 0, 0]
      }
    } else if (cmd === 'matrix' && args.length >= 6) {
      m = [args[0], args[1], args[2], args[3], args[4], args[5]]
    } else if (cmd === 'skewx') {
      const deg = args[0] ?? 0
      const rad = (deg * Math.PI) / 180
      m = [1, 0, Math.tan(rad), 1, 0, 0]
    } else if (cmd === 'skewy') {
      const deg = args[0] ?? 0
      const rad = (deg * Math.PI) / 180
      m = [1, Math.tan(rad), 0, 1, 0, 0]
    }

    current = multiplyMatrices(current, m)
  }

  return current
}

// ---------------------------------------------------------------------------
// Style Context & Inherited Presentation Attributes
// ---------------------------------------------------------------------------

interface StyleContext {
  fill: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
  strokeOpacity: number
  opacity: number
  strokeDashArray: string
  strokeLineCap: 'butt' | 'round' | 'square'
  strokeLineJoin: 'miter' | 'round' | 'bevel'
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline'
}

const DEFAULT_STYLE_CONTEXT: StyleContext = {
  fill: '#000000',
  fillOpacity: 1,
  stroke: 'none',
  strokeWidth: 1,
  strokeOpacity: 1,
  opacity: 1,
  strokeDashArray: '',
  strokeLineCap: 'butt',
  strokeLineJoin: 'miter',
  fontFamily: 'sans-serif',
  fontSize: 16,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
}

function parseInlineStyle(styleStr: string | null): Record<string, string> {
  const result: Record<string, string> = {}
  if (!styleStr) return result
  const declarations = styleStr.split(';')
  for (const decl of declarations) {
    const colonIndex = decl.indexOf(':')
    if (colonIndex > 0) {
      const key = decl.slice(0, colonIndex).trim().toLowerCase()
      const val = decl.slice(colonIndex + 1).trim()
      if (key && val) {
        result[key] = val
      }
    }
  }
  return result
}

function resolveStyle(element: Element, parent: StyleContext): StyleContext {
  const inline = parseInlineStyle(element.getAttribute('style'))

  const getAttr = (key: string): string | undefined => {
    return inline[key] ?? element.getAttribute(key) ?? undefined
  }

  const parseNum = (val: string | undefined, fallback: number): number => {
    if (val === undefined) return fallback
    const num = parseFloat(val.replace(/px$/, ''))
    return Number.isFinite(num) ? num : fallback
  }

  const rawCap = getAttr('stroke-linecap')
  const strokeLineCap: 'butt' | 'round' | 'square' =
    rawCap === 'round' || rawCap === 'square' || rawCap === 'butt'
      ? rawCap
      : parent.strokeLineCap

  const rawJoin = getAttr('stroke-linejoin')
  const strokeLineJoin: 'miter' | 'round' | 'bevel' =
    rawJoin === 'round' || rawJoin === 'bevel' || rawJoin === 'miter'
      ? rawJoin
      : parent.strokeLineJoin

  const rawWeight = getAttr('font-weight')
  const fontWeight: 'normal' | 'bold' =
    rawWeight === 'bold' || rawWeight === 'bolder' || (rawWeight && parseInt(rawWeight, 10) >= 700)
      ? 'bold'
      : rawWeight === 'normal'
      ? 'normal'
      : parent.fontWeight

  const rawStyle = getAttr('font-style')
  const fontStyle: 'normal' | 'italic' =
    rawStyle === 'italic' || rawStyle === 'oblique'
      ? 'italic'
      : rawStyle === 'normal'
      ? 'normal'
      : parent.fontStyle

  const rawDec = getAttr('text-decoration')
  const textDecoration: 'none' | 'underline' =
    rawDec && rawDec.includes('underline')
      ? 'underline'
      : rawDec === 'none'
      ? 'none'
      : parent.textDecoration

  return {
    fill: getAttr('fill') ?? parent.fill,
    fillOpacity: parseNum(getAttr('fill-opacity'), parent.fillOpacity),
    stroke: getAttr('stroke') ?? parent.stroke,
    strokeWidth: parseNum(getAttr('stroke-width'), parent.strokeWidth),
    strokeOpacity: parseNum(getAttr('stroke-opacity'), parent.strokeOpacity),
    opacity: parseNum(getAttr('opacity'), parent.opacity),
    strokeDashArray: getAttr('stroke-dasharray') ?? parent.strokeDashArray,
    strokeLineCap,
    strokeLineJoin,
    fontFamily: getAttr('font-family') ?? parent.fontFamily,
    fontSize: parseNum(getAttr('font-size'), parent.fontSize),
    fontWeight,
    fontStyle,
    textDecoration,
  }
}

function extractStyleAttributes(context: StyleContext): StyleAttributes {
  return {
    fill: context.fill,
    fillOpacity: context.fillOpacity,
    stroke: context.stroke,
    strokeWidth: context.strokeWidth,
    strokeOpacity: context.strokeOpacity,
    opacity: context.opacity,
    strokeDashArray: context.strokeDashArray,
    strokeLineCap: context.strokeLineCap,
    strokeLineJoin: context.strokeLineJoin,
  }
}

function extractTextStyleAttributes(context: StyleContext, content: string): TextStyleAttributes {
  return {
    content,
    fontFamily: context.fontFamily,
    fontSize: context.fontSize,
    fontWeight: context.fontWeight,
    fontStyle: context.fontStyle,
    textDecoration: context.textDecoration,
    color: context.fill === 'none' ? '#000000' : context.fill,
    backgroundColor: 'transparent',
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'el-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
}

// ---------------------------------------------------------------------------
// Path Transformation Helpers
// ---------------------------------------------------------------------------

function roundCoord(val: number): number {
  return Math.round(val * 1000) / 1000
}

function transformPathData(d: string, m: Matrix2D): string {
  if (isIdentity(m) || !d.trim()) {
    return d
  }

  const tokens: (string | number)[] = []
  const regex = /([a-df-z])|(-?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(d)) !== null) {
    if (match[1]) {
      tokens.push(match[1])
    } else if (match[2]) {
      tokens.push(parseFloat(match[2]))
    }
  }

  const result: string[] = []
  let idx = 0

  while (idx < tokens.length) {
    const token = tokens[idx]
    if (typeof token !== 'string') {
      idx++
      continue
    }

    const cmd = token
    idx++

    const params: number[] = []
    while (idx < tokens.length && typeof tokens[idx] === 'number') {
      params.push(tokens[idx] as number)
      idx++
    }

    const isRelative = cmd === cmd.toLowerCase()
    const upperCmd = cmd.toUpperCase()

    if (upperCmd === 'Z') {
      result.push(cmd)
    } else if (upperCmd === 'M' || upperCmd === 'L' || upperCmd === 'T') {
      const transformedPairs: string[] = []
      for (let i = 0; i < params.length - 1; i += 2) {
        const x = params[i]
        const y = params[i + 1]
        if (isRelative) {
          const dx = m[0] * x + m[2] * y
          const dy = m[1] * x + m[3] * y
          transformedPairs.push(`${roundCoord(dx)} ${roundCoord(dy)}`)
        } else {
          const pt = transformPoint(m, x, y)
          transformedPairs.push(`${roundCoord(pt.x)} ${roundCoord(pt.y)}`)
        }
      }
      result.push(`${cmd} ${transformedPairs.join(' ')}`)
    } else if (upperCmd === 'C') {
      const transformedSextets: string[] = []
      for (let i = 0; i < params.length - 5; i += 6) {
        if (isRelative) {
          const dx1 = m[0] * params[i] + m[2] * params[i + 1]
          const dy1 = m[1] * params[i] + m[3] * params[i + 1]
          const dx2 = m[0] * params[i + 2] + m[2] * params[i + 3]
          const dy2 = m[1] * params[i + 2] + m[3] * params[i + 3]
          const dx = m[0] * params[i + 4] + m[2] * params[i + 5]
          const dy = m[1] * params[i + 4] + m[3] * params[i + 5]
          transformedSextets.push(`${roundCoord(dx1)} ${roundCoord(dy1)} ${roundCoord(dx2)} ${roundCoord(dy2)} ${roundCoord(dx)} ${roundCoord(dy)}`)
        } else {
          const p1 = transformPoint(m, params[i], params[i + 1])
          const p2 = transformPoint(m, params[i + 2], params[i + 3])
          const p = transformPoint(m, params[i + 4], params[i + 5])
          transformedSextets.push(`${roundCoord(p1.x)} ${roundCoord(p1.y)} ${roundCoord(p2.x)} ${roundCoord(p2.y)} ${roundCoord(p.x)} ${roundCoord(p.y)}`)
        }
      }
      result.push(`${cmd} ${transformedSextets.join(' ')}`)
    } else if (upperCmd === 'S' || upperCmd === 'Q') {
      const transformedQuads: string[] = []
      for (let i = 0; i < params.length - 3; i += 4) {
        if (isRelative) {
          const dx1 = m[0] * params[i] + m[2] * params[i + 1]
          const dy1 = m[1] * params[i] + m[3] * params[i + 1]
          const dx = m[0] * params[i + 2] + m[2] * params[i + 3]
          const dy = m[1] * params[i + 2] + m[3] * params[i + 3]
          transformedQuads.push(`${roundCoord(dx1)} ${roundCoord(dy1)} ${roundCoord(dx)} ${roundCoord(dy)}`)
        } else {
          const p1 = transformPoint(m, params[i], params[i + 1])
          const p = transformPoint(m, params[i + 2], params[i + 3])
          transformedQuads.push(`${roundCoord(p1.x)} ${roundCoord(p1.y)} ${roundCoord(p.x)} ${roundCoord(p.y)}`)
        }
      }
      result.push(`${cmd} ${transformedQuads.join(' ')}`)
    } else if (upperCmd === 'H') {
      const transformed = params.map((x) => (isRelative ? roundCoord(m[0] * x) : roundCoord(m[0] * x + m[4])))
      result.push(`${cmd} ${transformed.join(' ')}`)
    } else if (upperCmd === 'V') {
      const transformed = params.map((y) => (isRelative ? roundCoord(m[3] * y) : roundCoord(m[3] * y + m[5])))
      result.push(`${cmd} ${transformed.join(' ')}`)
    } else if (upperCmd === 'A') {
      const transformedArcs: string[] = []
      const scaleX = Math.hypot(m[0], m[1])
      const scaleY = Math.hypot(m[2], m[3])
      for (let i = 0; i < params.length - 6; i += 7) {
        const rx = params[i] * scaleX
        const ry = params[i + 1] * scaleY
        const rot = params[i + 2]
        const large = params[i + 3]
        const sweep = params[i + 4]
        if (isRelative) {
          const dx = m[0] * params[i + 5] + m[2] * params[i + 6]
          const dy = m[1] * params[i + 5] + m[3] * params[i + 6]
          transformedArcs.push(`${roundCoord(rx)} ${roundCoord(ry)} ${rot} ${large} ${sweep} ${roundCoord(dx)} ${roundCoord(dy)}`)
        } else {
          const pt = transformPoint(m, params[i + 5], params[i + 6])
          transformedArcs.push(`${roundCoord(rx)} ${roundCoord(ry)} ${rot} ${large} ${sweep} ${roundCoord(pt.x)} ${roundCoord(pt.y)}`)
        }
      }
      result.push(`${cmd} ${transformedArcs.join(' ')}`)
    } else {
      result.push(`${cmd} ${params.join(' ')}`)
    }
  }

  return result.join(' ')
}

function extractPointsFromPathData(d: string): PathPoint[] {
  const points: PathPoint[] = []
  const regex = /(-?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)\s*[, ]\s*(-?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(d)) !== null) {
    const x = parseFloat(match[1])
    const y = parseFloat(match[2])
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y })
    }
  }
  return points
}

function computePointsBounds(points: { x: number; y: number }[]): {
  x: number
  y: number
  width: number
  height: number
} {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  }
}

function parsePointsAttribute(pointsStr: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  const tokens = pointsStr.trim().split(/[\s,]+/).map(parseFloat).filter(Number.isFinite)
  for (let i = 0; i < tokens.length - 1; i += 2) {
    points.push({ x: tokens[i], y: tokens[i + 1] })
  }
  return points
}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

function sanitizeSvgString(text: string): string {
  let cleaned = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  cleaned = cleaned.replace(/<script\b[^>]*\/>/gi, '')
  cleaned = cleaned.replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '')
  cleaned = cleaned.replace(/<foreignObject\b[^>]*\/>/gi, '')
  return cleaned
}

function sanitizeDom(root: Element): void {
  const badElements = root.querySelectorAll('script, foreignObject')
  badElements.forEach((el) => el.remove())

  const allElements = [root, ...Array.from(root.querySelectorAll('*'))]
  for (const el of allElements) {
    const attrNames = el.getAttributeNames()
    for (const name of attrNames) {
      if (name.toLowerCase().startsWith('on')) {
        el.removeAttribute(name)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Shape Handlers
// ---------------------------------------------------------------------------

function parseRect(node: Element, context: StyleContext, m: Matrix2D): CanvasElement {
  const x = parseFloat(node.getAttribute('x') ?? '0') || 0
  const y = parseFloat(node.getAttribute('y') ?? '0') || 0
  const width = parseFloat(node.getAttribute('width') ?? '0') || 0
  const height = parseFloat(node.getAttribute('height') ?? '0') || 0

  const rawRx = node.getAttribute('rx')
  const rawRy = node.getAttribute('ry')
  const parsedRx = rawRx !== null ? parseFloat(rawRx) : undefined
  const parsedRy = rawRy !== null ? parseFloat(rawRy) : undefined
  const effectiveRx = parsedRx !== undefined ? parsedRx : parsedRy
  const effectiveRy = parsedRy !== undefined ? parsedRy : parsedRx

  const scaleX = Math.hypot(m[0], m[1])
  const scaleY = Math.hypot(m[2], m[3])
  const rotDeg = (Math.atan2(m[1], m[0]) * 180) / Math.PI

  const cx = x + width / 2
  const cy = y + height / 2
  const transformedCenter = transformPoint(m, cx, cy)

  const wPrime = width * scaleX
  const hPrime = height * scaleY
  const xPrime = transformedCenter.x - wPrime / 2
  const yPrime = transformedCenter.y - hPrime / 2

  const rxPrime = effectiveRx !== undefined ? effectiveRx * scaleX : undefined
  const ryPrime = effectiveRy !== undefined ? effectiveRy * scaleY : undefined

  return {
    id: generateId(),
    name: node.getAttribute('id') || 'Rectangle',
    type: 'rect',
    visible: true,
    locked: false,
    transform: {
      x: roundCoord(xPrime),
      y: roundCoord(yPrime),
      width: roundCoord(wPrime),
      height: roundCoord(hPrime),
      rotation: roundCoord(rotDeg),
    },
    style: extractStyleAttributes(context),
    textStyle: extractTextStyleAttributes(context, ''),
    rx: rxPrime !== undefined ? roundCoord(rxPrime) : undefined,
    ry: ryPrime !== undefined ? roundCoord(ryPrime) : undefined,
  }
}

function parseCircleOrEllipse(node: Element, context: StyleContext, m: Matrix2D, isCircle: boolean): CanvasElement {
  const cx = parseFloat(node.getAttribute('cx') ?? '0') || 0
  const cy = parseFloat(node.getAttribute('cy') ?? '0') || 0

  let rx = 0
  let ry = 0

  if (isCircle) {
    const r = parseFloat(node.getAttribute('r') ?? '0') || 0
    rx = r
    ry = r
  } else {
    rx = parseFloat(node.getAttribute('rx') ?? '0') || 0
    ry = parseFloat(node.getAttribute('ry') ?? '0') || 0
  }

  const scaleX = Math.hypot(m[0], m[1])
  const scaleY = Math.hypot(m[2], m[3])
  const rotDeg = (Math.atan2(m[1], m[0]) * 180) / Math.PI

  const transformedCenter = transformPoint(m, cx, cy)
  const rxPrime = rx * scaleX
  const ryPrime = ry * scaleY
  const width = rxPrime * 2
  const height = ryPrime * 2

  return {
    id: generateId(),
    name: node.getAttribute('id') || (isCircle ? 'Circle' : 'Ellipse'),
    type: 'ellipse',
    visible: true,
    locked: false,
    transform: {
      x: roundCoord(transformedCenter.x - rxPrime),
      y: roundCoord(transformedCenter.y - ryPrime),
      width: roundCoord(width),
      height: roundCoord(height),
      rotation: roundCoord(rotDeg),
    },
    style: extractStyleAttributes(context),
    textStyle: extractTextStyleAttributes(context, ''),
  }
}

function parseLine(node: Element, context: StyleContext, m: Matrix2D): CanvasElement {
  const x1 = parseFloat(node.getAttribute('x1') ?? '0') || 0
  const y1 = parseFloat(node.getAttribute('y1') ?? '0') || 0
  const x2 = parseFloat(node.getAttribute('x2') ?? '0') || 0
  const y2 = parseFloat(node.getAttribute('y2') ?? '0') || 0

  const p1 = transformPoint(m, x1, y1)
  const p2 = transformPoint(m, x2, y2)

  const minX = Math.min(p1.x, p2.x)
  const minY = Math.min(p1.y, p2.y)
  const width = Math.abs(p2.x - p1.x)
  const height = Math.abs(p2.y - p1.y)

  return {
    id: generateId(),
    name: node.getAttribute('id') || 'Line',
    type: 'line',
    visible: true,
    locked: false,
    transform: {
      x: roundCoord(minX),
      y: roundCoord(minY),
      width: roundCoord(width),
      height: roundCoord(height),
      rotation: 0,
    },
    style: {
      ...extractStyleAttributes(context),
      fill: 'none',
    },
    textStyle: extractTextStyleAttributes(context, ''),
    x1: roundCoord(p1.x),
    y1: roundCoord(p1.y),
    x2: roundCoord(p2.x),
    y2: roundCoord(p2.y),
  }
}

function parsePolylineOrPolygon(node: Element, context: StyleContext, m: Matrix2D, isPolygon: boolean): CanvasElement | null {
  const pointsStr = node.getAttribute('points')
  if (!pointsStr) return null

  const rawPoints = parsePointsAttribute(pointsStr)
  if (rawPoints.length === 0) return null

  const transformedPoints: PathPoint[] = rawPoints.map((p) => {
    const pt = transformPoint(m, p.x, p.y)
    return { x: roundCoord(pt.x), y: roundCoord(pt.y) }
  })

  const bounds = computePointsBounds(transformedPoints)

  if (isPolygon) {
    const pathData =
      transformedPoints
        .map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(' ') + ' Z'

    return {
      id: generateId(),
      name: node.getAttribute('id') || 'Polygon',
      type: 'path',
      visible: true,
      locked: false,
      transform: {
        x: roundCoord(bounds.x),
        y: roundCoord(bounds.y),
        width: roundCoord(bounds.width),
        height: roundCoord(bounds.height),
        rotation: 0,
      },
      style: extractStyleAttributes(context),
      textStyle: extractTextStyleAttributes(context, ''),
      points: transformedPoints,
      pathData,
    }
  }

  return {
    id: generateId(),
    name: node.getAttribute('id') || 'Polyline',
    type: 'polyline',
    visible: true,
    locked: false,
    transform: {
      x: roundCoord(bounds.x),
      y: roundCoord(bounds.y),
      width: roundCoord(bounds.width),
      height: roundCoord(bounds.height),
      rotation: 0,
    },
    style: {
      ...extractStyleAttributes(context),
      fill: context.fill === '#000000' && !node.hasAttribute('fill') ? 'none' : context.fill,
    },
    textStyle: extractTextStyleAttributes(context, ''),
    points: transformedPoints,
  }
}

function parsePath(node: Element, context: StyleContext, m: Matrix2D): CanvasElement | null {
  const d = node.getAttribute('d')
  if (!d || !d.trim()) return null

  const transformedD = transformPathData(d, m)
  const points = extractPointsFromPathData(transformedD)
  const bounds = computePointsBounds(points)

  return {
    id: generateId(),
    name: node.getAttribute('id') || 'Path',
    type: 'path',
    visible: true,
    locked: false,
    transform: {
      x: roundCoord(bounds.x),
      y: roundCoord(bounds.y),
      width: roundCoord(bounds.width),
      height: roundCoord(bounds.height),
      rotation: 0,
    },
    style: extractStyleAttributes(context),
    textStyle: extractTextStyleAttributes(context, ''),
    points,
    pathData: transformedD,
  }
}

function parseText(node: Element, context: StyleContext, m: Matrix2D): CanvasElement | null {
  const tspanNodes = Array.from(node.querySelectorAll('tspan'))
  let textContent = ''

  if (tspanNodes.length > 0) {
    const lines = tspanNodes.map((t) => t.textContent ?? '').filter((line) => line.length > 0)
    textContent = lines.join('\n')
  } else {
    textContent = node.textContent ?? ''
  }

  if (!textContent.trim()) return null

  const initialX = parseFloat(node.getAttribute('x') ?? (tspanNodes[0]?.getAttribute('x') ?? '0')) || 0
  const initialY = parseFloat(node.getAttribute('y') ?? (tspanNodes[0]?.getAttribute('y') ?? '0')) || 0

  const pt = transformPoint(m, initialX, initialY)
  const scaleY = Math.hypot(m[2], m[3])
  const rotDeg = (Math.atan2(m[1], m[0]) * 180) / Math.PI
  const fontSize = Math.max(1, Math.round(context.fontSize * scaleY))

  return {
    id: generateId(),
    name: node.getAttribute('id') || 'Text',
    type: 'text',
    visible: true,
    locked: false,
    transform: {
      x: roundCoord(pt.x),
      y: roundCoord(pt.y),
      width: 0,
      height: fontSize,
      rotation: roundCoord(rotDeg),
    },
    style: extractStyleAttributes(context),
    textStyle: {
      ...extractTextStyleAttributes(context, textContent),
      fontSize,
    },
    textContent,
  }
}

// ---------------------------------------------------------------------------
// Traversal
// ---------------------------------------------------------------------------

const SILENT_TAGS = new Set([
  'metadata',
  'title',
  'desc',
])

function traverseNode(
  node: Element,
  parentStyle: StyleContext,
  parentMatrix: Matrix2D,
  elements: CanvasElement[],
  warnings: string[]
): void {
  const tag = node.tagName.toLowerCase()

  if (SILENT_TAGS.has(tag)) {
    return
  }

  const localTransform = parseTransform(node.getAttribute('transform'))
  const currentMatrix = multiplyMatrices(parentMatrix, localTransform)
  const currentStyle = resolveStyle(node, parentStyle)

  if (tag === 'svg' || tag === 'g') {
    const children = Array.from(node.children)
    for (const child of children) {
      traverseNode(child, currentStyle, currentMatrix, elements, warnings)
    }
    return
  }

  if (tag === 'rect') {
    elements.push(parseRect(node, currentStyle, currentMatrix))
    return
  }

  if (tag === 'circle') {
    elements.push(parseCircleOrEllipse(node, currentStyle, currentMatrix, true))
    return
  }

  if (tag === 'ellipse') {
    elements.push(parseCircleOrEllipse(node, currentStyle, currentMatrix, false))
    return
  }

  if (tag === 'line') {
    elements.push(parseLine(node, currentStyle, currentMatrix))
    return
  }

  if (tag === 'polyline') {
    const el = parsePolylineOrPolygon(node, currentStyle, currentMatrix, false)
    if (el) elements.push(el)
    return
  }

  if (tag === 'polygon') {
    const el = parsePolylineOrPolygon(node, currentStyle, currentMatrix, true)
    if (el) elements.push(el)
    return
  }

  if (tag === 'path') {
    const el = parsePath(node, currentStyle, currentMatrix)
    if (el) elements.push(el)
    return
  }

  if (tag === 'text') {
    const el = parseText(node, currentStyle, currentMatrix)
    if (el) elements.push(el)
    return
  }

  warnings.push(`Skipped unsupported tag <${node.tagName}>`)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses an SVG string into CanvasElement models with warnings.
 *
 * - Pure function. No React, no store.
 * - Flattens <g> hierarchy and resolves cumulative affine transforms.
 * - Resolves presentation attributes and inline style="" (style wins) with inheritance.
 * - Sanitizes <script>, <foreignObject>, and on* event handlers.
 * - Throws an Error with a readable message if XML is malformed or lacks an <svg> root.
 */
export function parseSvg(text: string): SvgParseResult {
  if (!text || typeof text !== 'string') {
    throw new Error('Failed to parse SVG: input must be a non-empty string')
  }

  const cleanedText = sanitizeSvgString(text)

  if (typeof DOMParser === 'undefined') {
    throw new Error('Failed to parse SVG: DOMParser is not available in the current environment')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(cleanedText, 'image/svg+xml')

  const parserErrors = doc.getElementsByTagName('parsererror')
  if (parserErrors.length > 0) {
    const errorMsg = parserErrors[0].textContent?.trim() || 'XML syntax error'
    throw new Error(`Failed to parse SVG: ${errorMsg}`)
  }

  const svgRoot = doc.querySelector('svg')
  if (!svgRoot) {
    throw new Error('Failed to parse SVG: No <svg> root element found')
  }

  sanitizeDom(svgRoot)

  const elements: CanvasElement[] = []
  const warnings: string[] = []

  const rootTransform = parseTransform(svgRoot.getAttribute('transform'))
  const rootStyle = resolveStyle(svgRoot, DEFAULT_STYLE_CONTEXT)

  const children = Array.from(svgRoot.children)
  for (const child of children) {
    traverseNode(child, rootStyle, rootTransform, elements, warnings)
  }

  return { elements, warnings }
}

/**
 * Moves all imported elements together so their union bounds are centred
 * on the canvas. If the elements bounding box is larger than the canvas,
 * scales them down uniformly to fit.
 */
export function fitAndCenterElements(
  elements: CanvasElement[],
  canvasWidth = 800,
  canvasHeight = 600
): CanvasElement[] {
  if (elements.length === 0) return []

  // Compute union bounding box of all elements
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const el of elements) {
    const t = el.transform
    if (el.type === 'line' && el.x1 !== undefined && el.y1 !== undefined && el.x2 !== undefined && el.y2 !== undefined) {
      minX = Math.min(minX, el.x1, el.x2)
      minY = Math.min(minY, el.y1, el.y2)
      maxX = Math.max(maxX, el.x1, el.x2)
      maxY = Math.max(maxY, el.y1, el.y2)
    } else if (el.points && el.points.length > 0) {
      for (const p of el.points) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
    } else {
      minX = Math.min(minX, t.x)
      minY = Math.min(minY, t.y)
      maxX = Math.max(maxX, t.x + t.width)
      maxY = Math.max(maxY, t.y + t.height)
    }
  }

  const origWidth = Math.max(1, maxX - minX)
  const origHeight = Math.max(1, maxY - minY)
  const origCenterX = minX + origWidth / 2
  const origCenterY = minY + origHeight / 2

  const targetCenterX = canvasWidth / 2
  const targetCenterY = canvasHeight / 2

  // If the SVG is larger than the canvas, scale it down uniformly to fit
  let scale = 1
  if (origWidth > canvasWidth || origHeight > canvasHeight) {
    scale = Math.min(canvasWidth / origWidth, canvasHeight / origHeight)
  }

  const tx = targetCenterX - origCenterX * scale
  const ty = targetCenterY - origCenterY * scale
  const m: Matrix2D = [scale, 0, 0, scale, tx, ty]

  return elements.map((el) => {
    const t = el.transform
    const transformedX = t.x * scale + tx
    const transformedY = t.y * scale + ty
    const transformedW = t.width * scale
    const transformedH = t.height * scale

    const nextEl: CanvasElement = {
      ...el,
      transform: {
        ...t,
        x: roundCoord(transformedX),
        y: roundCoord(transformedY),
        width: roundCoord(transformedW),
        height: roundCoord(transformedH),
      },
      style: {
        ...el.style,
        strokeWidth: scale < 1 ? Math.max(0.5, roundCoord(el.style.strokeWidth * scale)) : el.style.strokeWidth,
      },
    }

    if (el.rx !== undefined) {
      nextEl.rx = roundCoord(el.rx * scale)
    }
    if (el.ry !== undefined) {
      nextEl.ry = roundCoord(el.ry * scale)
    }

    if (el.type === 'line' && el.x1 !== undefined && el.y1 !== undefined && el.x2 !== undefined && el.y2 !== undefined) {
      nextEl.x1 = roundCoord(el.x1 * scale + tx)
      nextEl.y1 = roundCoord(el.y1 * scale + ty)
      nextEl.x2 = roundCoord(el.x2 * scale + tx)
      nextEl.y2 = roundCoord(el.y2 * scale + ty)
    }

    if (el.points && el.points.length > 0) {
      nextEl.points = el.points.map((p) => ({
        x: roundCoord(p.x * scale + tx),
        y: roundCoord(p.y * scale + ty),
        ...(p.handleOut
          ? {
              handleOut: {
                x: roundCoord(p.handleOut.x * scale + tx),
                y: roundCoord(p.handleOut.y * scale + ty),
              },
            }
          : {}),
        ...(p.handleIn
          ? {
              handleIn: {
                x: roundCoord(p.handleIn.x * scale + tx),
                y: roundCoord(p.handleIn.y * scale + ty),
              },
            }
          : {}),
      }))
    }

    if (el.pathData) {
      nextEl.pathData = transformPathData(el.pathData, m)
    }

    if (el.type === 'text') {
      nextEl.textStyle = {
        ...el.textStyle,
        fontSize: Math.max(1, Math.round(el.textStyle.fontSize * scale)),
      }
    }

    return nextEl
  })
}

