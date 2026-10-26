import {
  FileText,
  FilePlus2,
  History,
  Moon,
  Pencil,
  Redo2,
  Sun,
  Undo2,
  Upload,
  ZoomIn,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import ExportPanel from './ExportPanel'
import { ImportDialog, type ImportModalState } from './ImportDialog'
import { parseSvg, fitAndCenterElements } from '../io/importSvg'

interface TopBarProps {
  isDarkMode: boolean
  onToggleTheme: () => void
}

function TopBar({ isDarkMode, onToggleTheme }: TopBarProps) {
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const clearCanvas = useEditorStore((state) => state.clearCanvas)
  const importElements = useEditorStore((state) => state.importElements)
  const canUndo = useEditorStore((state) => state.past.length > 0)
  const canRedo = useEditorStore((state) => state.future.length > 0)
  const viewport = useEditorStore((state) => state.viewport)
  const setViewport = useEditorStore((state) => state.setViewport)

  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false)
  const [importModal, setImportModal] = useState<ImportModalState | null>(null)
  const [importNotice, setImportNotice] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleImportClick = () => {
    setIsFileMenuOpen(false)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 2. Reject files over 5 MB
    const MAX_SIZE_BYTES = 5 * 1024 * 1024
    if (file.size > MAX_SIZE_BYTES) {
      setImportModal({
        type: 'error',
        title: 'File Too Large',
        message: 'This file is too large. Maximum supported SVG file size is 5 MB.',
      })
      e.target.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text !== 'string') {
        setImportModal({
          type: 'error',
          title: 'Read Error',
          message: 'Unable to read the selected file as text.',
        })
        e.target.value = ''
        return
      }

      try {
        const { elements: parsedElements, warnings } = parseSvg(text)

        if (parsedElements.length === 0) {
          setImportModal({
            type: 'error',
            title: 'No Supported Shapes',
            message: 'No supported shapes were found',
            details: warnings.length > 0 ? warnings : undefined,
          })
          return
        }

        // Center all elements together; scale down uniformly if larger than canvas
        const fitted = fitAndCenterElements(parsedElements, 800, 600)
        importElements(fitted)

        if (warnings.length > 0) {
          setImportNotice(
            `Imported ${parsedElements.length} shapes. Skipped ${warnings.length} unsupported items.`
          )
        }
      } catch (err) {
        const error = err as Error
        setImportModal({
          type: 'error',
          title: 'Import Error',
          message: 'This file is not a valid SVG',
          details: [error.message],
        })
      } finally {
        e.target.value = ''
      }
    }

    reader.onerror = () => {
      setImportModal({
        type: 'error',
        title: 'Read Error',
        message: 'An error occurred while reading the file from disk.',
      })
      e.target.value = ''
    }

    reader.readAsText(file)
  }

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 bg-white px-5 flex items-center shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
      {/* Hidden file input for SVG import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
      />

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
        {/* File Dropdown Menu */}
        <div className="relative group">
          <button
            type="button"
            title="File menu"
            onClick={() => setIsFileMenuOpen((prev) => !prev)}
            className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <FileText size={14} aria-hidden="true" />
            File
          </button>
          <div
            className={`absolute top-full left-0 mt-1 w-44 flex-col rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800 z-30 ${
              isFileMenuOpen ? 'flex' : 'hidden group-hover:flex'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setIsFileMenuOpen(false)
                if (window.confirm('Start a new file? This will clear your current canvas and cannot be undone.')) {
                  clearCanvas()
                }
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              <FilePlus2 size={13} aria-hidden="true" />
              New Canvas
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              <Upload size={13} aria-hidden="true" />
              Import SVG...
            </button>
          </div>
        </div>

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
              onClick={() => {
                const newZoom = Math.min(10, Math.max(0.1, viewport.zoom * 1.5))
                const centerX = 400
                const centerY = 300
                const newPanX = centerX - (centerX - viewport.panX) * (newZoom / viewport.zoom)
                const newPanY = centerY - (centerY - viewport.panY) * (newZoom / viewport.zoom)
                setViewport({ zoom: newZoom, panX: newPanX, panY: newPanY })
              }}
              className="flex w-full items-center px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Zoom In
            </button>
            <button
              onClick={() => {
                const newZoom = Math.min(10, Math.max(0.1, viewport.zoom / 1.5))
                const centerX = 400
                const centerY = 300
                const newPanX = centerX - (centerX - viewport.panX) * (newZoom / viewport.zoom)
                const newPanY = centerY - (centerY - viewport.panY) * (newZoom / viewport.zoom)
                setViewport({ zoom: newZoom, panX: newPanX, panY: newPanY })
              }}
              className="flex w-full items-center px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Zoom Out
            </button>
            <button
              onClick={() => setViewport({ zoom: 1, panX: 40, panY: 40 })}
              className="flex w-full items-center px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Reset 100%
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

      <ImportDialog
        modal={importModal}
        notice={importNotice}
        onCloseModal={() => setImportModal(null)}
        onDismissNotice={() => setImportNotice(null)}
      />
    </header>
  )
}

export default TopBar
