/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { parseSvg, fitAndCenterElements } from './importSvg'
import { exportToSVG } from '../utils/exportSvg'
import { useEditorStore } from '../store/EditorStore'
import type { CanvasElement } from '../types/canvas'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

describe('SVG Import and Store Integration Tests', () => {
  beforeEach(() => {
    useEditorStore.setState({
      elements: [],
      past: [],
      future: [],
      selectedElementIds: [],
    })
  })

  // Test Requirement (a): Export a drawing, then import it, and confirm the shapes look the same
  describe('(a) export a drawing, then import it, and confirm shapes match', () => {
    it('exports rect, circle, line, and text and imports them with preserved properties', () => {
      const originalElements: CanvasElement[] = [
        {
          id: 'rect-1',
          name: 'Main Box',
          type: 'rect',
          visible: true,
          locked: false,
          transform: { x: 100, y: 150, width: 200, height: 100, rotation: 0 },
          style: {
            fill: '#ff5500',
            fillOpacity: 1,
            stroke: '#002244',
            strokeOpacity: 0.8,
            strokeWidth: 3,
            opacity: 1,
            strokeDashArray: '',
            strokeLineCap: 'round',
            strokeLineJoin: 'miter',
          },
          textStyle: {
            content: '',
            fontFamily: 'sans-serif',
            fontSize: 16,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            color: '#000000',
            backgroundColor: 'transparent',
          },
          rx: 10,
        },
        {
          id: 'ellipse-1',
          name: 'Indicator Circle',
          type: 'ellipse',
          visible: true,
          locked: false,
          transform: { x: 400, y: 150, width: 80, height: 80, rotation: 0 },
          style: {
            fill: '#00bb55',
            fillOpacity: 0.9,
            stroke: '#004411',
            strokeOpacity: 1,
            strokeWidth: 2,
            opacity: 1,
            strokeDashArray: '4,4',
            strokeLineCap: 'butt',
            strokeLineJoin: 'bevel',
          },
          textStyle: {
            content: '',
            fontFamily: 'sans-serif',
            fontSize: 16,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            color: '#000000',
            backgroundColor: 'transparent',
          },
        },
        {
          id: 'line-1',
          name: 'Connector',
          type: 'line',
          visible: true,
          locked: false,
          transform: { x: 300, y: 200, width: 100, height: 0, rotation: 0 },
          x1: 300,
          y1: 200,
          x2: 400,
          y2: 200,
          style: {
            fill: 'none',
            fillOpacity: 1,
            stroke: '#333333',
            strokeOpacity: 1,
            strokeWidth: 2,
            opacity: 1,
            strokeDashArray: '',
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
          },
          textStyle: {
            content: '',
            fontFamily: 'sans-serif',
            fontSize: 16,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            color: '#000000',
            backgroundColor: 'transparent',
          },
        },
        {
          id: 'text-1',
          name: 'Label',
          type: 'text',
          visible: true,
          locked: false,
          transform: { x: 120, y: 190, width: 160, height: 30, rotation: 0 },
          style: {
            fill: '#111111',
            fillOpacity: 1,
            stroke: 'none',
            strokeOpacity: 1,
            strokeWidth: 1,
            opacity: 1,
            strokeDashArray: '',
            strokeLineCap: 'butt',
            strokeLineJoin: 'miter',
          },
          textStyle: {
            content: 'Valve Status: OK',
            color: '#111111',
            fontFamily: 'Arial',
            fontSize: 18,
            fontWeight: 'bold',
            fontStyle: 'normal',
            textDecoration: 'none',
            backgroundColor: 'transparent',
          },
        },
      ]

      // Step 1: Export to SVG
      const exportedSvg = exportToSVG(originalElements, CANVAS_WIDTH, CANVAS_HEIGHT)
      expect(exportedSvg).toContain('<svg')
      expect(exportedSvg).toContain('Valve Status: OK')
      expect(exportedSvg).toContain('rect')
      expect(exportedSvg).toContain('ellipse')
      expect(exportedSvg).toContain('line')

      // Step 2: Import the SVG
      const { elements: imported, warnings } = parseSvg(exportedSvg)
      expect(warnings).toHaveLength(0)
      expect(imported).toHaveLength(4)

      // Step 3: Verify imported elements preserve shape types, dimensions, colors, and styles
      const importedRect = imported.find((el) => el.type === 'rect')
      expect(importedRect).toBeDefined()
      expect(importedRect!.transform.width).toBe(200)
      expect(importedRect!.transform.height).toBe(100)
      expect(importedRect!.style.fill).toBe('#ff5500')
      expect(importedRect!.style.stroke).toBe('#002244')
      expect(importedRect!.style.strokeWidth).toBe(3)
      expect(importedRect!.rx).toBe(10)

      const importedCircle = imported.find((el) => el.type === 'ellipse')
      expect(importedCircle).toBeDefined()
      expect(importedCircle!.transform.width).toBe(80)
      expect(importedCircle!.transform.height).toBe(80)
      expect(importedCircle!.style.fill).toBe('#00bb55')
      expect(importedCircle!.style.strokeDashArray).toBe('4,4')

      const importedLine = imported.find((el) => el.type === 'line')
      expect(importedLine).toBeDefined()
      expect(importedLine!.x1).toBe(300)
      expect(importedLine!.y1).toBe(200)
      expect(importedLine!.x2).toBe(400)
      expect(importedLine!.y2).toBe(200)

      const importedText = imported.find((el) => el.type === 'text')
      expect(importedText).toBeDefined()
      expect(importedText!.textStyle.content).toBe('Valve Status: OK')
      expect(importedText!.style.fill).toBe('#111111')
      expect(importedText!.textStyle.fontSize).toBe(18)
    })
  })

  // Test Requirement (b): Import a .txt renamed to .svg and confirm error is thrown/handled without crash
  describe('(b) import a .txt renamed to .svg', () => {
    it('throws a descriptive error when parsing plain text renamed to .svg', () => {
      const plainText = 'Hello world! This is a plain text file, not an SVG document at all.'
      expect(() => parseSvg(plainText)).toThrow(/No <svg> root element found|Failed to parse SVG/)
    })

    it('throws a descriptive error on malformed XML syntax', () => {
      const malformedXml = '<svg><rect x="10" y="10" width="100" <unclosed tag>'
      expect(() => parseSvg(malformedXml)).toThrow(/Failed to parse SVG/)
    })

    it('returns empty elements array when SVG contains no supported shape tags', () => {
      const emptySvg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><filter id="f1"></filter></defs></svg>'
      const { elements, warnings } = parseSvg(emptySvg)
      expect(elements).toHaveLength(0)
      // Warnings should log skipped unsupported tags
      expect(warnings.some((w) => w.includes('defs'))).toBe(true)
    })
  })

  // Test Requirement (c): Import, press Ctrl+Z once, and confirm everything disappears
  describe('(c) import, press Ctrl+Z once, and confirm everything disappears', () => {
    it('imports elements, selects them, assigns new IDs, and undo reverts canvas atomically', () => {
      const store = useEditorStore.getState()
      expect(store.elements).toHaveLength(0)
      expect(store.past).toHaveLength(0)

      const importedBatch: CanvasElement[] = [
        {
          id: 'imported-1',
          name: 'Box 1',
          type: 'rect',
          visible: true,
          locked: false,
          transform: { x: 50, y: 50, width: 100, height: 100, rotation: 0 },
          style: {
            fill: '#ffffff',
            fillOpacity: 1,
            stroke: '#000000',
            strokeOpacity: 1,
            strokeWidth: 1,
            opacity: 1,
            strokeDashArray: '',
            strokeLineCap: 'round',
            strokeLineJoin: 'miter',
          },
          textStyle: {
            content: '',
            fontFamily: 'sans-serif',
            fontSize: 14,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            color: '#000000',
            backgroundColor: 'transparent',
          },
        },
        {
          id: 'imported-2',
          name: 'Box 2',
          type: 'rect',
          visible: true,
          locked: false,
          transform: { x: 200, y: 50, width: 100, height: 100, rotation: 0 },
          style: {
            fill: '#0000ff',
            fillOpacity: 1,
            stroke: '#000000',
            strokeOpacity: 1,
            strokeWidth: 1,
            opacity: 1,
            strokeDashArray: '',
            strokeLineCap: 'round',
            strokeLineJoin: 'miter',
          },
          textStyle: {
            content: '',
            fontFamily: 'sans-serif',
            fontSize: 14,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            color: '#000000',
            backgroundColor: 'transparent',
          },
        },
      ]

      // Execute importElements
      useEditorStore.getState().importElements(importedBatch)

      const stateAfterImport = useEditorStore.getState()
      expect(stateAfterImport.elements).toHaveLength(2)
      // Confirm fresh IDs were assigned
      expect(stateAfterImport.elements[0].id).not.toBe('imported-1')
      expect(stateAfterImport.elements[1].id).not.toBe('imported-2')
      // Confirm all imported elements are selected
      expect(stateAfterImport.selectedElementIds).toEqual([
        stateAfterImport.elements[0].id,
        stateAfterImport.elements[1].id,
      ])
      // Confirm exactly ONE history snapshot in past
      expect(stateAfterImport.past).toHaveLength(1)

      // Trigger undo (Ctrl+Z)
      useEditorStore.getState().undo()

      const stateAfterUndo = useEditorStore.getState()
      // Everything disappears back to initial empty canvas
      expect(stateAfterUndo.elements).toHaveLength(0)
      expect(stateAfterUndo.past).toHaveLength(0)
      expect(stateAfterUndo.future).toHaveLength(1)
    })

    it('preserves existing pre-import canvas elements when undoing imported elements', () => {
      // Setup initial canvas element
      const preExistingElement: CanvasElement = {
        id: 'pre-existing',
        name: 'Background Base',
        type: 'rect',
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, width: 800, height: 600, rotation: 0 },
        style: {
          fill: '#f0f0f0',
          fillOpacity: 1,
          stroke: '#cccccc',
          strokeOpacity: 1,
          strokeWidth: 1,
          opacity: 1,
          strokeDashArray: '',
          strokeLineCap: 'round',
          strokeLineJoin: 'miter',
        },
        textStyle: {
          content: '',
          fontFamily: 'sans-serif',
          fontSize: 14,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          color: '#000000',
          backgroundColor: 'transparent',
        },
      }

      useEditorStore.setState({
        elements: [preExistingElement],
        past: [],
        future: [],
      })

      const newShape: CanvasElement = {
        id: 'new-1',
        name: 'Circle',
        type: 'ellipse',
        visible: true,
        locked: false,
        transform: { x: 100, y: 100, width: 50, height: 50, rotation: 0 },
        style: {
          fill: '#ff0000',
          fillOpacity: 1,
          stroke: 'none',
          strokeOpacity: 1,
          strokeWidth: 1,
          opacity: 1,
          strokeDashArray: '',
          strokeLineCap: 'round',
          strokeLineJoin: 'miter',
        },
        textStyle: {
          content: '',
          fontFamily: 'sans-serif',
          fontSize: 14,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          color: '#000000',
          backgroundColor: 'transparent',
        },
      }

      useEditorStore.getState().importElements([newShape])
      expect(useEditorStore.getState().elements).toHaveLength(2)

      // Undo once
      useEditorStore.getState().undo()

      const restoredState = useEditorStore.getState()
      expect(restoredState.elements).toHaveLength(1)
      expect(restoredState.elements[0].id).toBe('pre-existing')
    })
  })

  // Test Requirement 4: Centering and uniform scaling
  describe('centering and scaling', () => {
    it('scales down uniformly if SVG bounding box exceeds 800x600 canvas', () => {
      const largeRect: CanvasElement = {
        id: 'large-1',
        name: 'Huge Canvas',
        type: 'rect',
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, width: 1600, height: 1200, rotation: 0 },
        style: {
          fill: '#333333',
          fillOpacity: 1,
          stroke: 'none',
          strokeOpacity: 1,
          strokeWidth: 1,
          opacity: 1,
          strokeDashArray: '',
          strokeLineCap: 'round',
          strokeLineJoin: 'miter',
        },
        textStyle: {
          content: '',
          fontFamily: 'sans-serif',
          fontSize: 14,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          color: '#000000',
          backgroundColor: 'transparent',
        },
      }

      const fitted = fitAndCenterElements([largeRect], 800, 600)
      expect(fitted).toHaveLength(1)
      // Scaled by 0.5 (800 / 1600)
      expect(fitted[0].transform.width).toBe(800)
      expect(fitted[0].transform.height).toBe(600)
      // Centered at canvas center (400, 300) -> top-left at (0, 0)
      expect(fitted[0].transform.x).toBe(0)
      expect(fitted[0].transform.y).toBe(0)
    })

    it('centers elements that are smaller than canvas without scaling up', () => {
      const smallRect: CanvasElement = {
        id: 'small-1',
        name: 'Small Box',
        type: 'rect',
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, width: 200, height: 100, rotation: 0 },
        style: {
          fill: '#333333',
          fillOpacity: 1,
          stroke: 'none',
          strokeOpacity: 1,
          strokeWidth: 1,
          opacity: 1,
          strokeDashArray: '',
          strokeLineCap: 'round',
          strokeLineJoin: 'miter',
        },
        textStyle: {
          content: '',
          fontFamily: 'sans-serif',
          fontSize: 14,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          color: '#000000',
          backgroundColor: 'transparent',
        },
      }

      const fitted = fitAndCenterElements([smallRect], 800, 600)
      expect(fitted).toHaveLength(1)
      expect(fitted[0].transform.width).toBe(200)
      expect(fitted[0].transform.height).toBe(100)
      // Center of 800x600 canvas is (400, 300). Box center (100, 50) + offset -> top-left at (300, 250)
      expect(fitted[0].transform.x).toBe(300)
      expect(fitted[0].transform.y).toBe(250)
    })
  })
})
