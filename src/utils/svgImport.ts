// svgImport.ts - Import SVG files into the canvas
import type { CanvasElement, StyleAttributes } from '../types/canvas'
import { createPolylineElement } from '../types/canvas'

const MIN_DIMENSION = 0.0001

export interface SvgParseOptions { defaultFill?: string; defaultStroke?: string; defaultTextColor?: string }

export function parseSvgString(svgString: string, options: SvgParseOptions = {}): ParsedSvg {
  const { defaultFill = '#334155', defaultStroke = '#334155' } = options
  const cleaned = svgString.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\\[CDATA\\[[\s\S]*?]]>/g, '')
  const parser = new DOMParser()
  const doc = parser.parseFromString(cleaned, 'image/svg+xml')
  const parserErrors = doc.getElementsByTagName('parsererror')
  if (parserErrors.length > 0) return { rootWrapped: false, elements: [] }
  const svgRoot = doc.querySelector('svg')
  if (!svgRoot) return { rootWrapped: false, elements: [] }
  const elements: CanvasElement[] = []
  const directChildren = Array.from(svgRoot.childNodes).filter((node): node is Element => node.nodeType === 1)
  const isFullSvg = svgRoot.tagName.toLowerCase() === 'svg' && directChildren.every((n) => n.tagName !== 'svg')
  if (isFullSvg) {
    for (const child of directChildren) {
      const el = parseElement(child, defaultFill, defaultStroke)
      if (el) elements.push(el)
    }
  } else {
    for (const child of directChildren) {
      const el = parseElement(child, defaultFill, defaultStroke)
      if (el) elements.push(el)
    }
  }

  if (isFullSvg && elements.length > 0) {
    const group = createGroupElement(elements)
    return { rootWrapped: true, elements: [group] }
  }
  return { rootWrapped: false, elements }
}

function parseElement(node: Element, defaultFill: string, defaultStroke: string): CanvasElement | null {
  const tag = node.tagName.toLowerCase()
  if (tag === 'rect') {
    const x = parseFloat(node.getAttribute('x') ?? '0')
    const y = parseFloat(node.getAttribute('y') ?? '0')
    const width = parseFloat(node.getAttribute('width') ?? '0')
    const height = parseFloat(node.getAttribute('height') ?? '0')
    const rx = node.getAttribute('rx') ? parseFloat(node.getAttribute('rx')!) : undefined
    const ry = node.getAttribute('ry') ? parseFloat(node.getAttribute('ry')!) : undefined
    const style = readStyle(node, defaultFill, defaultStroke)
    return {
      id: node.getAttribute('id') ?? crypto.randomUUID(),
      name: node.getAttribute('aria-label') ?? node.getAttribute('data-name') ?? 'Rectangle',
      type: 'rect',
      visible: true,
      locked: false,
      transform: { x, y, width: Math.max(width, MIN_DIMENSION), height: Math.max(height, MIN_DIMENSION), rotation: 0 },
      style,
      textStyle: { content: '', fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', color: '#000000', backgroundColor: 'transparent' },
      rx, ry,
    }
  }
  if (tag === 'ellipse') {
    const cx = parseFloat(node.getAttribute('cx') ?? '0')
    const cy = parseFloat(node.getAttribute('cy') ?? '0')
    const rx = parseFloat(node.getAttribute('rx') ?? '0')
    const ry = parseFloat(node.getAttribute('ry') ?? '0')
    const style = readStyle(node, defaultFill, defaultStroke)
    return {
      id: node.getAttribute('id') ?? crypto.randomUUID(),
      name: node.getAttribute('aria-label') ?? node.getAttribute('data-name') ?? 'Ellipse',
      type: 'ellipse',
      visible: true,
      locked: false,
      transform: { x: cx - Math.max(rx, MIN_DIMENSION) / 2, y: cy - Math.max(ry, MIN_DIMENSION) / 2, width: Math.max(rx, MIN_DIMENSION), height: Math.max(ry, MIN_DIMENSION), rotation: 0 },
      style,
      textStyle: { content: '', fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', color: '#000000', backgroundColor: 'transparent' },
    }
  }
  if (tag === 'circle') {
    const cx = parseFloat(node.getAttribute('cx') ?? '0')
    const cy = parseFloat(node.getAttribute('cy') ?? '0')
    const r = parseFloat(node.getAttribute('r') ?? '0')
    const style = readStyle(node, defaultFill, defaultStroke)
    return {
      id: node.getAttribute('id') ?? crypto.randomUUID(),
      name: node.getAttribute('aria-label') ?? node.getAttribute('data-name') ?? 'Circle',
      type: 'ellipse',
      visible: true,
      locked: false,
      transform: { x: cx - Math.max(r, MIN_DIMENSION), y: cy - Math.max(r, MIN_DIMENSION), width: Math.max(r * 2, MIN_DIMENSION), height: Math.max(r * 2, MIN_DIMENSION), rotation: 0 },
      style,
      textStyle: { content: '', fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', color: '#000000', backgroundColor: 'transparent' },
    }
  }

  if (tag === 'line') {
    const x1 = parseFloat(node.getAttribute('x1') ?? '0')
    const y1 = parseFloat(node.getAttribute('y1') ?? '0')
    const x2 = parseFloat(node.getAttribute('x2') ?? '0')
    const y2 = parseFloat(node.getAttribute('y2') ?? '0')
    const style = readStyle(node, defaultFill, defaultStroke)
    return {
      id: node.getAttribute('id') ?? crypto.randomUUID(),
      name: node.getAttribute('aria-label') ?? node.getAttribute('data-name') ?? 'Line',
      type: 'line',
      visible: true,
      locked: false,
      transform: { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1) + MIN_DIMENSION, height: Math.abs(y2 - y1) + MIN_DIMENSION, rotation: 0 },
      style,
      x1, y1, x2, y2,
      textStyle: { content: '', fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', color: '#000000', backgroundColor: 'transparent' },
    }
  }
  if (tag === 'polyline') {
    const pointsStr = node.getAttribute('points')
    if (!pointsStr) return null
    const points = parsePointsString(pointsStr).map((p) => ({ x: p.x, y: p.y })).filter((p) => Math.abs(p.x) > MIN_DIMENSION || Math.abs(p.y) > MIN_DIMENSION)
    if (points.length === 0) return null
    return createPolylineElement(points)
  }
  if (tag === 'path') {
    const d = node.getAttribute('d')
    if (!d) return null
    const points = parsePathDataToPoints(d)
    if (points.length === 0) return null
    const style = readStyle(node, defaultFill, defaultStroke)
    return {
      id: node.getAttribute('id') ?? crypto.randomUUID(),
      name: node.getAttribute('aria-label') ?? node.getAttribute('data-name') ?? 'Path',
      type: 'path',
      visible: true,
      locked: false,
      transform: {
        x: Math.min(...points.map((p) => p.x)),
        y: Math.min(...points.map((p) => p.y)),
        width: Math.max(...points.map((p => p.x))) - Math.min(...points.map((p => p.x))),
        height: Math.max(...points.map((p => p.y))) - Math.min(...points.map((p => p.y))),
        rotation: 0,
      },
      style,
      points,
      pathData: d,
      textStyle: { content: '', fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', color: '#000000', backgroundColor: 'transparent' },
    }
  }
  if (tag === 'text' || tag === 'tspan') {
    const text = node.textContent?.trim() ?? ''
    if (!text) return null
    const x = parseFloat(node.getAttribute('x') ?? '0')
    const y = parseFloat(node.getAttribute('y') ?? '0')
    const style = readStyle(node, defaultFill, defaultStroke)
    return {
      id: node.getAttribute('id') ?? crypto.randomUUID(),
      name: node.getAttribute('aria-label') ?? node.getAttribute('data-name') ?? 'Text',
      type: 'text',
      visible: true,
      locked: false,
      transform: { x, y, width: 0, height: 16, rotation: 0 },
      style,
      textStyle: { content: text, fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', color: '#000000', backgroundColor: 'transparent' },
    }
  }
  return null
}

function readStyle(node: Element, defaultFill: string, defaultStroke: string): StyleAttributes {
  return {
    fill: node.getAttribute('fill') ?? defaultFill,
    fillOpacity: parseFloat(node.getAttribute('fill-opacity') ?? '1'),
    stroke: node.getAttribute('stroke') ?? defaultStroke,
    strokeWidth: parseFloat(node.getAttribute('stroke-width') ?? '2'),
    strokeOpacity: parseFloat(node.getAttribute('stroke-opacity') ?? '1'),
    opacity: parseFloat(node.getAttribute('opacity') ?? '1'),
    strokeDashArray: node.getAttribute('stroke-dasharray') ?? '',
    strokeLineCap: (node.getAttribute('stroke-linecap') ?? 'butt') as 'butt' | 'round' | 'square',
    strokeLineJoin: (node.getAttribute('stroke-linejoin') ?? 'miter') as 'round' | 'miter' | 'bevel',
  }
}

function parsePointsString(pointsStr: string): { x: number; y: number }[] {
  return pointsStr.split(/\s+/).map((pair) => {
    const [x, y] = pair.split(',').map(Number)
    return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }
  }).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
}

function parsePathDataToPoints(d: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  const tokens = d.match(/-?\d+(?:\.\d+)?/g) ?? []
  let i = 0
  while (i < tokens.length) {
    const x = parseFloat(tokens[i]!)
    const y = parseFloat(tokens[i + 1]!)
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y })
      i += 2
    } else {
      i += 1
    }
  }
  return points
}

function createGroupElement(children: CanvasElement[]): CanvasElement {
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
    name: 'Imported SVG',
    type: 'group',
    visible: true,
    locked: false,
    transform: { x: gx, y: gy, width: gw - gx, height: gh - gy, rotation: 0 },
    style: { fill: 'var(--canvas-default-fill)', fillOpacity: 1, stroke: 'var(--canvas-default-stroke)', strokeWidth: 2, strokeOpacity: 1, opacity: 1, strokeDashArray: '', strokeLineCap: 'butt', strokeLineJoin: 'miter' },
    textStyle: { content: '', fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', color: '#000000', backgroundColor: 'transparent' },
    childrenIds: children.map((c) => c.id),
  }
}

export interface ParsedSvg { rootWrapped: boolean; elements: CanvasElement[] }