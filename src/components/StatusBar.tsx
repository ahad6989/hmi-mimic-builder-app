import { Crosshair, ZoomIn } from 'lucide-react'

function StatusBar() {
  return (
    <footer className="flex h-8 shrink-0 items-center border-t border-slate-200 bg-white px-4 text-[11px] text-slate-500 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
      <div className="flex items-center gap-2">
        <Crosshair size={13} aria-hidden="true" />
        <span className="font-mono tabular-nums">X: 0</span>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span className="font-mono tabular-nums">Y: 0</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ZoomIn size={13} aria-hidden="true" />
        <span className="font-mono tabular-nums">Zoom: 100%</span>
      </div>
    </footer>
  )
}

export default StatusBar