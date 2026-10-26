/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './EditorStore'
import { createLineElement, createRectElement } from '../types/canvas'

function resetStore() {
  useEditorStore.setState({
    elements: [],
    past: [],
    future: [],
    selectedElementIds: [],
    editingTextId: null,
    activeTool: 'select',
  })
}

describe('EditorStore — multi-selection state', () => {
  beforeEach(resetStore)

  describe('selectElements', () => {
    it('replaces the selection and removes duplicates', () => {
      useEditorStore.getState().selectElement('a')
      useEditorStore.getState().selectElements(['b', 'c', 'b'])
      expect(useEditorStore.getState().selectedElementIds).toEqual(['b', 'c'])
    })

    it('can empty the selection', () => {
      useEditorStore.getState().selectElements(['a'])
      useEditorStore.getState().selectElements([])
      expect(useEditorStore.getState().selectedElementIds).toEqual([])
    })
  })

  describe('toggleSelectElement (shift-click)', () => {
    it('adds an unselected element', () => {
      useEditorStore.getState().selectElement('a')
      useEditorStore.getState().toggleSelectElement('b')
      expect(useEditorStore.getState().selectedElementIds).toEqual(['a', 'b'])
    })

    it('removes a selected element', () => {
      useEditorStore.getState().selectElements(['a', 'b'])
      useEditorStore.getState().toggleSelectElement('a')
      expect(useEditorStore.getState().selectedElementIds).toEqual(['b'])
    })

    it('empties the selection when toggling the last element', () => {
      useEditorStore.getState().selectElement('a')
      useEditorStore.getState().toggleSelectElement('a')
      expect(useEditorStore.getState().selectedElementIds).toEqual([])
    })
  })

  describe('moveElements (group move)', () => {
    it('moves only the given ids and preserves relative positions', () => {
      const a = createRectElement(0, 0, 10, 10)
      const b = createRectElement(100, 50, 20, 20)
      const c = createRectElement(500, 500, 10, 10)
      useEditorStore.setState({ elements: [a, b, c] })

      useEditorStore.getState().moveElements([a.id, b.id], 15, -5)

      const [na, nb, nc] = useEditorStore.getState().elements
      expect(na.transform).toMatchObject({ x: 15, y: -5 })
      expect(nb.transform).toMatchObject({ x: 115, y: 45 })
      // Relative offset between a and b is unchanged: (100,50) → (100,50)
      expect(nb.transform.x - na.transform.x).toBe(100)
      expect(nb.transform.y - na.transform.y).toBe(50)
      // Untouched element stays put
      expect(nc.transform).toMatchObject({ x: 500, y: 500 })
    })

    it('translates line endpoints together with the transform', () => {
      const line = createLineElement(0, 0, 40, 40)
      useEditorStore.setState({ elements: [line] })

      useEditorStore.getState().moveElements([line.id], 10, 20)

      const moved = useEditorStore.getState().elements[0]
      expect(moved.x1).toBe(10)
      expect(moved.y1).toBe(20)
      expect(moved.x2).toBe(50)
      expect(moved.y2).toBe(60)
    })

    it('coalesces moves sharing a history key into ONE undo step', () => {
      const a = createRectElement(0, 0, 10, 10)
      useEditorStore.setState({ elements: [a], past: [], future: [] })

      useEditorStore.getState().moveElements([a.id], 5, 0, 'drag-1')
      useEditorStore.getState().moveElements([a.id], 5, 0, 'drag-1')
      useEditorStore.getState().moveElements([a.id], 5, 0, 'drag-1')

      expect(useEditorStore.getState().elements[0].transform.x).toBe(15)
      expect(useEditorStore.getState().past).toHaveLength(1)

      useEditorStore.getState().undo()
      expect(useEditorStore.getState().elements[0].transform.x).toBe(0)

      useEditorStore.getState().redo()
      expect(useEditorStore.getState().elements[0].transform.x).toBe(15)
    })

    it('creates a separate undo step per new history key', () => {
      const a = createRectElement(0, 0, 10, 10)
      useEditorStore.setState({ elements: [a], past: [], future: [] })

      useEditorStore.getState().moveElements([a.id], 10, 0, 'drag-1')
      useEditorStore.getState().moveElements([a.id], 10, 0, 'drag-2')

      expect(useEditorStore.getState().elements[0].transform.x).toBe(20)

      useEditorStore.getState().undo()
      expect(useEditorStore.getState().elements[0].transform.x).toBe(10)
      useEditorStore.getState().undo()
      expect(useEditorStore.getState().elements[0].transform.x).toBe(0)
    })

    it('ignores empty id lists and zero deltas', () => {
      const a = createRectElement(0, 0, 10, 10)
      useEditorStore.setState({ elements: [a], past: [], future: [] })

      useEditorStore.getState().moveElements([], 10, 10, 'k')
      useEditorStore.getState().moveElements([a.id], 0, 0, 'k')

      expect(useEditorStore.getState().elements[0].transform.x).toBe(0)
      expect(useEditorStore.getState().past).toHaveLength(0)
    })
  })

  describe('selection lifecycle', () => {
    it('drops deleted ids from the selection', () => {
      const a = createRectElement(0, 0, 10, 10)
      const b = createRectElement(20, 20, 10, 10)
      useEditorStore.setState({ elements: [a, b] })
      useEditorStore.getState().selectElements([a.id, b.id])

      useEditorStore.getState().deleteElement(a.id)

      expect(useEditorStore.getState().selectedElementIds).toEqual([b.id])
    })
  })

  describe('setSnapConfig', () => {
    it('merges partial snapping settings', () => {
      useEditorStore.getState().setSnapConfig({ snapToGrid: true, gridSize: 16 })
      expect(useEditorStore.getState().snapConfig).toEqual({
        snapToGrid: true,
        gridSize: 16,
        snapToObjects: true,
      })
    })
  })
})