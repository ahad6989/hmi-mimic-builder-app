import {
  FileText,
  FilePlus2,
  History,
  Moon,
  Pencil,
  Redo2,
  Sun,
  Undo2,
  ZoomIn,
} from 'lucide-react'
import { useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import ExportPanel from './ExportPanel'

interface TopBarProps {
  isDarkMode: boolean
  onToggleTheme: () => void
}

function TopBar({ isDarkMode, onToggleTheme }: TopBarProps) {
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const clearCanvas = useEditorStore((state) => state.clearCanvas)
  const canUndo = useEditorStore((state) => state.past.length > 0)
  const canRedo = useEditorStore((state) => state.future.length > 0)
  const viewport = useEditorStore((state) => state.viewport)
  const setViewport = useEditorStore((state) => state.setViewport)
  const [isExportOpen, setIsExportOpen] = useState(false)

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 bg-white px-5 flex items-center shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-white dark:bg-slate-700">
          <FileText size={16} strokeWidth={2.25} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
            VectorCraft Studio
          </h1>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            HMI Mimic Builder
          </p>
        </div>
      </div>

      <div className="ml-10 flex h-full items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        <button title="File" className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
          <FileText size={14} aria-hidden="true" />
          File
        </button>
        <button
          type="button"
          title="New file"
          onClick={() => {
            if (window.confirm('Start a new file? This will clear your current canvas and cannot be undone.')) {
              clearCanvas()
            }
          }}
          className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <FilePlus2 size={14} aria-hidden="true" />
          New
        </button>
        <button title="Edit" className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
          <Pencil size={14} aria-hidden="true" />
          Edit
        </button>
        <div className="relative group">
          <button title="Zoom" className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
            <ZoomIn size={14} aria-hidden="true" />
            Zoom
          </button>
          <div className="absolute top-full left-0 mt-1 hidden w-32 flex-col rounded-md border border-slate-200 bg-white p-1 shadow-lg group-hover:flex dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setViewport({ ...viewport, zoom: Math.min(10, viewport.zoom * 1.5) })}
              className="flex w-full items-center px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Zoom In
            </button>
            <button
              onClick={() => setViewport({ ...viewport, zoom: Math.max(0.1, viewport.zoom / 1.5) })}
              className="flex w-full items-center px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Zoom Out
            </button>
            <button
              onClick={() => setViewport({ ...viewport, zoom: 1 })}
              className="flex w-full items-center px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Zoom to 100%
            </button>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            title="Export"
            aria-expanded={isExportOpen}
            onClick={() => setIsExportOpen((open) => !open)}
            className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Export
          </button>
          {isExportOpen && <ExportPanel onClose={() => setIsExportOpen(false)} />}
        </div>
        <button title="History" className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
          <History size={14} aria-hidden="true" />
          History
        </button>
        <div className="ml-3 flex items-center gap-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            aria-label="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={!canUndo}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Undo2 size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            aria-label="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            onClick={redo}
            disabled={!canRedo}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Redo2 size={15} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={onToggleTheme}
          className="ml-3 flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {isDarkMode ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
        </button>
      </div>
    </header>
  )
}

export default TopBar
