import { SlidersHorizontal } from 'lucide-react'

function Inspector() {
  return (
    <aside className="w-64 shrink-0 border-l border-slate-200 bg-white transition-colors dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <SlidersHorizontal size={15} className="text-slate-500 dark:text-slate-400" aria-hidden="true" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">
          Inspector
        </h2>
      </div>

      <div className="space-y-1 p-3">
        {['Transform', 'Appearance', 'Geometry'].map((section) => (
          <div
            key={section}
            className="flex items-center justify-between border-b border-slate-100 px-2 py-3 text-xs font-medium text-slate-400 last:border-b-0 dark:border-slate-800 dark:text-slate-500"
          >
            {section}
            <span className="text-[10px] uppercase tracking-wide">Unavailable</span>
          </div>
        ))}
      </div>

      <p className="mx-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Select an object to inspect its properties.
      </p>
    </aside>
  )
}

export default Inspector