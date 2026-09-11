import {
  Download,
  FileText,
  History,
  Moon,
  Pencil,
  Sun,
  ZoomIn,
} from 'lucide-react'

interface TopBarProps {
  isDarkMode: boolean
  onToggleTheme: () => void
}

function TopBar({ isDarkMode, onToggleTheme }: TopBarProps) {
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
        <button title="Edit" className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
          <Pencil size={14} aria-hidden="true" />
          Edit
        </button>
        <button title="Zoom" className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
          <ZoomIn size={14} aria-hidden="true" />
          Zoom
        </button>
        <button title="Export" className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
          <Download size={14} aria-hidden="true" />
          Export
        </button>
        <button title="History" className="flex h-8 items-center gap-2 rounded px-3 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
          <History size={14} aria-hidden="true" />
          History
        </button>
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
