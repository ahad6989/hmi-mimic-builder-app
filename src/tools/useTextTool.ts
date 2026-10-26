import { useCallback } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { createTextElement } from '../types/canvas'
import { toWorldPoint } from '../geometry/coordinates'

export function useTextTool(svgRef: React.RefObject<SVGSVGElement | null>) {
  const addElement = useEditorStore((state) => state.addElement)
  const selectElement = useEditorStore((state) => state.selectElement)
  const setEditingTextId = useEditorStore((state) => state.setEditingTextId)
  const elements = useEditorStore((state) => state.elements)

  const getPoint = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const { zoom, panX, panY } = useEditorStore.getState().viewport
      return toWorldPoint(event.clientX, event.clientY, svg, zoom, panX, panY)
    },
    [svgRef]
  )

  const onCanvasClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      // Use the browser's REAL hit-testing to find what's actually under
      // the cursor, instead of an approximated bounding-box calculation.
      // Text shapes are tagged with data-el-id in ShapeRenderer.tsx —
      // walk up from whatever the click actually landed on to find it.
      const domTarget = document.elementFromPoint(event.clientX, event.clientY)
      const matchedEl = domTarget?.closest('[data-el-id]')
      const hitId = matchedEl?.getAttribute('data-el-id')
      const hit = hitId ? elements.find((el) => el.id === hitId && el.type === 'text') : undefined

      if (hit) {
        selectElement(hit.id)
        setEditingTextId(hit.id)
        return
      }

      const point = getPoint(event)
      const element = createTextElement(point.x, point.y)
      addElement(element)
      selectElement(element.id)
      setEditingTextId(element.id)
    },
    [addElement, selectElement, setEditingTextId, getPoint, elements]
  )

  return { onCanvasClick }
}