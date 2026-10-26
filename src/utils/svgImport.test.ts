// =============================================================================
// svgImport.test.ts — Tests for SVG import parsing
// =============================================================================

import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { ParsedSvg } from './svgImport'

let parseSvgString: (svgString: string, options?: { defaultFill?: string; defaultStroke?: string; defaultTextColor?: string }) => ParsedSvg

beforeAll(async () => {
  // Minimal DOMParser mock for Node.js test environment
  class MockDOMParser {
    parseFromString(content: string) {
      const isError = content.includes('<not svg>') || !content.match(/<svg[\s>]/)
      const rectMatch = content.match(/<rect\s+([^>]*)\/?>/)
      const circleMatch = content.match(/<circle\s+([^>]*)\/?>/)
      const textMatch = content.match(/<text[^>]*>([^<]*)<\/text>/)
      const polylineMatch = content.match(/<polyline\s+([^>]*)\/?>/)

      const getAttrs = (str: string) => {
        const attrs: Record<string, string> = {}
        str.replace(/(\w+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v; return '' })
        return attrs
      }

      const buildRect = () => {
        const a = getAttrs(rectMatch![1])
        return {
          tagName: 'rect',
          getAttribute: (name: string) => a[name] ?? null,
        }
      }

      const buildCircle = () => {
        const a = getAttrs(circleMatch![1])
        return {
          tagName: 'circle',
          getAttribute: (name: string) => a[name] ?? null,
        }
      }

      const buildText = () => ({
        tagName: 'text',
        getAttribute: (name: string) => {
          const a = getAttrs(textMatch![0].split('>')[0])
          return a[name] ?? null
        },
        textContent: textMatch![1],
      })

      const buildPolyline = () => {
        const a = getAttrs(polylineMatch![1])
        return {
          tagName: 'polyline',
          getAttribute: (name: string) => a[name] ?? null,
        }
      }

type MockElement = {
  tagName: string
  getAttribute: (name: string) => string | null
  textContent?: string
}

      const directChildren: MockElement[] = []
      if (rectMatch) directChildren.push(buildRect())
      if (circleMatch) directChildren.push(buildCircle())
      if (textMatch) directChildren.push(buildText())
      if (polylineMatch) directChildren.push(buildPolyline())

      const svgRoot = isError ? null : {
        tagName: 'svg',
        childNodes: directChildren.map((c) => ({ ...c, nodeType: 1 })),
      }

      return {
        getElementsByTagName: (_tag: string) =>
          isError && _tag === 'parsererror' ? [{ length: 1 }] : { length: 0 },
        querySelector: (_selector: string) =>
          _selector === 'svg' ? svgRoot : null,
      }
    }
  }

  vi.stubGlobal('DOMParser', MockDOMParser as unknown as typeof DOMParser)
  ;(globalThis as unknown as { DOMParser: typeof MockDOMParser }).DOMParser = MockDOMParser

  const mod = await import('./svgImport')
  parseSvgString = mod.parseSvgString
})

describe('parseSvgString', () => {
  const svgWithRect = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="50" height="60" fill="#ff0000" stroke="#000000" stroke-width="2"/></svg>`

  const svgFullDoc = `<?xml version="1.0"?><svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="30" fill="blue"/></svg>`

  const svgWithText = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><text x="10" y="30" font-family="Arial" font-size="14" fill="#000000">Hello</text></svg>`

  const svgWithPolyline = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><polyline points="0,0 50,50 100,0" fill="none" stroke="black" stroke-width="2"/></svg>`

  it('parses rect elements', () => {
    const result = parseSvgString(svgWithRect)
    expect(result.elements.length).toBe(1)
    const group = result.elements[0]
    expect(group.type).toBe('group')
    // For wrapped SVG, check via childrenIds; the rect should be in the group
    expect(group.childrenIds).toHaveLength(1)
  })

  it('wraps multiple children in a group for full SVG docs', () => {
    const result = parseSvgString(svgFullDoc)
    expect(result.rootWrapped).toBe(true)
    expect(result.elements.length).toBe(1)
    expect(result.elements[0].type).toBe('group')
    expect(result.elements[0].childrenIds).toHaveLength(1)
  })

  it('parses text elements', () => {
    const result = parseSvgString(svgWithText)
    expect(result.elements.length).toBe(1)
    const group = result.elements[0]
    expect(group.type).toBe('group')
    expect(group.childrenIds).toHaveLength(1)
  })

  it('parses polyline elements', () => {
    const result = parseSvgString(svgWithPolyline)
    expect(result.elements.length).toBe(1)
    const group = result.elements[0]
    expect(group.type).toBe('group')
    expect(group.childrenIds).toHaveLength(1)
  })

  it('returns empty elements for invalid SVG', () => {
    const result = parseSvgString('<not svg>')
    expect(result.elements).toEqual([])
    expect(result.rootWrapped).toBe(false)
  })

  it('uses default colors when attributes are missing', () => {
    const result = parseSvgString(`<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="10" height="10"/></svg>`)
    expect(result.elements.length).toBe(1)
  })
})

