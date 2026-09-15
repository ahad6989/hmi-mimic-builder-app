import { getElementBounds } from '../geometry/bounds'
import type { CanvasElement } from '../types/canvas'

const SELECTION_PADDING = 4

interface SelectionOverlayProps {
  elements: CanvasElement[]
  selectedElementIds: string[]
}

function SelectionOverlay({ elements, selectedElementIds }: SelectionOverlayProps) {
  return (
    <g id="selection-overlay" pointerEvents="none">
      {elements
        .filter((element) => selectedElementIds.includes(element.id))
        .map((element) => {
          const bounds = getElementBounds(element)
          return (
            <rect
              key={element.id}
              x={bounds.x - SELECTION_PADDING}
              y={bounds.y - SELECTION_PADDING}
              width={bounds.width + SELECTION_PADDING * 2}
              height={bounds.height + SELECTION_PADDING * 2}
              fill="none"
              stroke="#2563eb"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
          )
        })}
    </g>
  )
}

export default SelectionOverlay
