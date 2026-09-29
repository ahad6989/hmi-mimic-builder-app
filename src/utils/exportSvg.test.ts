/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { exportToSVG, exportToPNG } from './exportSvg'
import { createRectElement, createEllipseElement, createLineElement, createTextElement, DEFAULT_STYLE } from '../types/canvas'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

describe('exportSvg — CSS variable resolution', () => {
  const originalBody = document.body.innerHTML

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = originalBody
    document.documentElement.className = ''

    // Set up CSS custom properties mimicking index.css (light mode defaults)
    const root = document.documentElement
    root.style.setProperty('--canvas-default-fill', '#334155')
    root.style.setProperty('--canvas-default-stroke', '#334155')

    // Dark mode overrides (only active when .dark class is on a descendant)
    const darkWrapper = document.createElement('div')
    darkWrapper.className = ''
    darkWrapper.style.setProperty('--canvas-default-fill', '#e2e8f0')
    darkWrapper.style.setProperty('--canvas-default-stroke', '#e2e8f0')
    document.body.appendChild(darkWrapper)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('resolves var(--canvas-default-fill) and var(--canvas-default-stroke) in SVG output', () => {
    const rect = createRectElement(10, 20, 100, 80)
    // rect.style.fill and rect.style.stroke should contain var(...) references
    expect(rect.style.fill).toBe('var(--canvas-default-fill)')
    expect(rect.style.stroke).toBe('var(--canvas-default-stroke)')

    const svg = exportToSVG([rect], CANVAS_WIDTH, CANVAS_HEIGHT)

    // The exported SVG must NOT contain unresolved var(...) references
    expect(svg).not.toContain('var(--canvas-default-fill)')
    expect(svg).not.toContain('var(--canvas-default-stroke)')

    // The exported SVG must contain resolved hex color values
    expect(svg).toContain('#334155')
  })

  it('resolves CSS variables to dark-mode values when .dark class is present', () => {
    // Simulate dark mode: add .dark to the body wrapper
    const darkWrapper = document.querySelector('div')!
    darkWrapper.classList.add('dark')

    const ellipse = createEllipseElement(100, 100, 50, 50)
    expect(ellipse.style.fill).toBe('var(--canvas-default-fill)')

    const svg = exportToSVG([ellipse], CANVAS_WIDTH, CANVAS_HEIGHT)

    // Should NOT contain unresolved var() references
    expect(svg).not.toContain('var(')

    // Should contain dark-mode fill color
    expect(svg).toContain('#e2e8f0')
  })

  it('resolves fill/stroke for all shape types', () => {
    const rect = createRectElement(10, 10, 50, 50)
    const ellipse = createEllipseElement(100, 100, 30, 30)
    const line = createLineElement(0, 0, 100, 100)
    const text = createTextElement(200, 200)

    const svg = exportToSVG([rect, ellipse, line, text], CANVAS_WIDTH, CANVAS_HEIGHT)

    // None of the exported SVGs should contain var() references for fill/stroke
    expect(svg).not.toContain('var(--canvas-default-fill)')
    expect(svg).not.toContain('var(--canvas-default-stroke)')

    // All should contain resolved colors
    expect(svg).toContain('#334155')
  })

  it('passes through already-resolved colors unchanged', () => {
    // A shape with explicitly set colors (not using CSS variables)
    const rect = {
      ...createRectElement(10, 10, 50, 50),
      style: { ...DEFAULT_STYLE, fill: '#ff0000', stroke: '#00ff00' },
    }

    const svg = exportToSVG([rect], CANVAS_WIDTH, CANVAS_HEIGHT)

    expect(svg).toContain('#ff0000')
    expect(svg).toContain('#00ff00')
    expect(svg).not.toContain('var(')
  })

  it('passes through "none" fill unchanged (for line/polyline/path shapes)', () => {
    const line = createLineElement(0, 0, 100, 100)
    // createLineElement sets fill to 'none' (not a CSS variable)
    expect(line.style.fill).toBe('none')

    const svg = exportToSVG([line], CANVAS_WIDTH, CANVAS_HEIGHT)

    expect(svg).toContain('fill="none"')
    expect(svg).not.toContain('var(')
  })

  it('PNG export resolves CSS variables before rasterization', async () => {
    // happy-dom doesn't support SVG image loading via <img> or the full Canvas API.
    // Mock those to verify the pipeline runs end-to-end with resolved colors.
    const mockImageInstance = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      privateSrc: '',
    }
    vi.stubGlobal('Image', function () { return mockImageInstance } as unknown as Image)
    Object.defineProperty(mockImageInstance, 'src', {
      get: () => mockImageInstance.privateSrc,
      set: (value: string) => {
        mockImageInstance.privateSrc = value
        queueMicrotask(() => mockImageInstance.onload?.())
      },
    })

    const mockContext = { fillRect: vi.fn(), drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (cb: (blob: Blob | null) => void) =>
        cb(new Blob([new Uint8Array([137, 80])], { type: 'image/png' }))
    )

    try {
      const rect = createRectElement(10, 20, 100, 80)

      // The PNG pipeline internally calls exportToSVG first, then rasterizes.
      // If CSS variables weren't resolved, the SVG would contain var(--...)
      // which the browser cannot resolve in a standalone data: URL image.
      const svg = exportToSVG([rect], CANVAS_WIDTH, CANVAS_HEIGHT)
      expect(svg).not.toContain('var(--')

      // PNG export should complete without error (it uses the resolved SVG)
      const blob = await exportToPNG([rect], CANVAS_WIDTH, CANVAS_HEIGHT, '#ffffff')
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/png')
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  })
})
