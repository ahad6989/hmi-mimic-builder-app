import type { RefObject } from 'react'

interface ContextMenuState {
  id: string
  x: number
  y: number
}

interface ShapeContextMenuProps {
  contextMenu: ContextMenuState
  contextMenuRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  deleteElement: (id: string) => void
}

function ShapeContextMenu({
  contextMenu,
  contextMenuRef,
  onClose,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  deleteElement,
}: ShapeContextMenuProps) {
  const runAction = (action: (id: string) => void) => {
    action(contextMenu.id)
    onClose()
  }

  return (
    <div
      ref={contextMenuRef}
      className="absolute z-20 min-w-28 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="w-full rounded px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => runAction(bringToFront)}
      >
        Bring to Front
      </button>
      <button
        type="button"
        className="w-full rounded px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => runAction(sendToBack)}
      >
        Send to Back
      </button>
      <button
        type="button"
        className="w-full rounded px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => runAction(bringForward)}
      >
        Bring Forward
      </button>
      <button
        type="button"
        className="w-full rounded px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => runAction(sendBackward)}
      >
        Send Backward
      </button>
      <button
        type="button"
        className="w-full rounded px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-red-50 hover:text-red-600 dark:text-slate-200 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        onClick={() => runAction(deleteElement)}
      >
        Delete
      </button>
    </div>
  )
}

export default ShapeContextMenu
