import { Crosshair, Magnet, ZoomIn } from 'lucide-react'
import { useEditorStore } from '../store/EditorStore'

function StatusBar() {
  const viewport = useEditorStore((state) => state.viewport)
  const snapConfig = useEditorStore((state) => state.snapConfig)
  const setSnapConfig = useEditorStore((state) => state.setSnapConfig)

  const toggleClass = (active: boolean) =>
    [
      'h-5 rounded px-1.5 font-mono transition-colors',
      active
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300',
    ].join(' ')

  return (
    <footer className="flex h-8 shrink-0 items-center border-t border-slate-200 bg-white px-4 text-[11px] text-slate-500 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
      <div className="flex items-center gap-2">
        <Crosshair size={13} aria-hidden="true" />
        <span className="font-mono tabular-nums">X: 0</span>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span className="font-mono tabular-nums">Y: 0</span>
      </div>

      {/* Snapping controls */}
      <div className="ml-6 flex items-center gap-1.5">
        <Magnet size={13} aria-hidden="true" />
        <button
          type="button"
          title="Snap to grid"
          className={toggleClass(snapConfig.snapToGrid)}
          onClick={() => setSnapConfig({ snapToGrid: !snapConfig.snapToGrid })}
        >
          Grid
        </button>
        {snapConfig.snapToGrid && (
          <span className="flex overflow-hidden rounded border border-slate-200 dark:border-slate-700">
            {([8, 16] as const).map((size) => (
              <button
                key={size}
                type="button"
                title={`Grid size ${size}px`}
                className={toggleClass(snapConfig.gridSize === size)}
                onClick={() => setSnapConfig({ gridSize: size })}
              >
                {size}
              </button>
            ))}
          </span>
        )}
        <button
          type="button"
          title="Snap to object edges and centres"
          className={toggleClass(snapConfig.snapToObjects)}
          onClick={() => setSnapConfig({ snapToObjects: !snapConfig.snapToObjects })}
        >
          Objects
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ZoomIn size={13} aria-hidden="true" />
        <span className="font-mono tabular-nums">Zoom: {Math.round(viewport.zoom * 100)}%</span>
      </div>
    </footer>
  )
}

export default StatusBar