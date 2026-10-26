import { useEffect } from 'react'
import type { Tool } from '../types/canvas'

interface KeyboardShortcutsOptions {
  activeTool: Tool
  contextMenuOpen: boolean
  selectedElementIds: string[]
  polylineTool: {
    isDrawing: boolean
    cancel: () => void
    commit: () => void
  }
  penTool: {
    isDrawing: boolean
    cancel: () => void
    commit: () => void
  }
  pencilTool: {
    isDrawing: boolean
    cancel: () => void
    commit: () => void
  }
  setActiveTool: (tool: Tool) => void
  clearSelection: () => void
  deleteElement: (id: string) => void
  setContextMenu: (contextMenu: null) => void
  undo: () => void
  redo: () => void
}

export function useKeyboardShortcuts({
  activeTool,
  contextMenuOpen,
  selectedElementIds,
  polylineTool,
  penTool,
  pencilTool,
  setActiveTool,
  clearSelection,
  deleteElement,
  setContextMenu,
  undo,
  redo,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }
      const isShortcut = e.ctrlKey || e.metaKey
      if (isShortcut && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (isShortcut && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        redo()
        return
      }
      switch (e.key) {
        case 'Escape':
          if (contextMenuOpen) {
            setContextMenu(null)
            break
          }
          if (activeTool === 'polyline' && polylineTool.isDrawing) {
            polylineTool.cancel()
          } else if (activeTool === 'pen' && penTool.isDrawing) {
            penTool.cancel()
          } else if (activeTool === 'pencil' && pencilTool.isDrawing) {
            pencilTool.cancel()
          } else {
            clearSelection()
          }
          break
        case 'Enter':
          if (activeTool === 'polyline') polylineTool.commit()
          if (activeTool === 'pen') penTool.commit()
          if (activeTool === 'pencil') pencilTool.commit()
          break
        case 'Delete':
        case 'Backspace':
          if (selectedElementIds.length > 0) {
            e.preventDefault()
            selectedElementIds.forEach((id) => deleteElement(id))
            clearSelection()
          }
          break
        case 'v': case 'V': setActiveTool('select'); break
        case 'h': case 'H': setActiveTool('pan'); break
        case 'r': case 'R': setActiveTool('rect'); break
        case 'o': case 'O': setActiveTool('ellipse'); break
        case 'l': case 'L': setActiveTool('line'); break
        case 'y': case 'Y': setActiveTool('polyline'); break
        case 'p': case 'P': setActiveTool('pen'); break
        case 'b': case 'B': setActiveTool('pencil'); break
        case 't': case 'T': setActiveTool('text'); break
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeTool, clearSelection, contextMenuOpen, deleteElement, pencilTool, penTool, polylineTool, redo, selectedElementIds, setActiveTool, setContextMenu, undo])
}
