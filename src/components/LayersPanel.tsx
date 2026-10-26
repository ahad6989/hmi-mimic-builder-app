// =============================================================================
// LayersPanel.tsx — Layers / object list panel
// =============================================================================
import { Eye, EyeOff, Lock, LockOpen, Trash2, ArrowUp, ArrowDown, Layers, Filter, X, CircleDot } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { toLayerModel } from '../features/layers/layerModel'
import { type LayerItem, type LayerFilter, LAYER_FILTERS } from '../features/layers/types'
import { toggleVisibility, toggleLock, selectVisibleIds } from '../features/layers/layerActions'

interface LayersPanelProps { className?: string }

function LayersPanel({ className }: LayersPanelProps) {
  const elements = useEditorStore((s) => s.elements)
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const setSelectedElementIds = useEditorStore((s) => s.selectElements)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const updateElement = useEditorStore((s) => s.updateElement)
  const deleteElement = useEditorStore((s) => s.deleteElement)
  const bringForward = useEditorStore((s) => s.bringForward)
  const sendBackward = useEditorStore((s) => s.sendBackward)

  const [filter, setFilter] = useState<LayerFilter>('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const items: LayerItem[] = useMemo(() => toLayerModel(elements, filter), [elements, filter])
  const isSelected = (id: string) => selectedElementIds.includes(id)

  const handleToggleVisibility = useCallback((id: string) => {
    const next = toggleVisibility(elements, id)
    if (next) updateElement(id, { visible: next.visible })
  }, [elements, updateElement])

  const handleToggleLock = useCallback((id: string) => {
    const next = toggleLock(elements, id)
    if (next) updateElement(id, { locked: next.locked })
  }, [elements, updateElement])

  const handleMoveUp = useCallback((id: string) => {
    const idx = items.findIndex((i) => i.id === id)
    if (idx <= 0) return
    bringForward(items[idx - 1].id)
  }, [items, bringForward])

  const handleMoveDown = useCallback((id: string) => {
    const idx = items.findIndex((i) => i.id === id)
    if (idx < 0 || idx >= items.length - 1) return
    sendBackward(items[idx + 1].id)
  }, [items, sendBackward])

  const handleDelete = useCallback((id: string) => {
    deleteElement(id)
    clearSelection()
  }, [deleteElement, clearSelection])

  const handleSelect = useCallback((id: string, multi: boolean) => {
    if (multi) { useEditorStore.getState().toggleSelectElement(id) }
    else setSelectedElementIds([id])
  }, [setSelectedElementIds])

  const handleSelectAllVisible = useCallback(() => {
    const ids = selectVisibleIds(items)
    if (ids.length > 0) setSelectedElementIds(ids)
    else clearSelection()
  }, [items, setSelectedElementIds, clearSelection])

  return (
    <aside className={['w-72 shrink-0 border-l border-slate-200 bg-white flex flex-col transition-colors dark:border-slate-700 dark:bg-slate-900', className].filter(Boolean).join(' ')}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2"><Layers size={16} strokeWidth={1.5} aria-hidden="true" /><span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Layers</span></div>
        <div className="flex items-center gap-1"><button onClick={handleSelectAllVisible} title="Select all visible" className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"><CircleDot size={13} strokeWidth={1.8} aria-hidden="true" /></button><button onClick={clearSelection} title="Clear selection" className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"><X size={13} strokeWidth={1.8} aria-hidden="true" /></button></div>
      </div>
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2 text-xs"><Filter size={13} strokeWidth={1.5} aria-hidden="true" /><select value={filter} onChange={(e) => setFilter(e.target.value as LayerFilter)} className="flex-1 h-7 rounded border border-slate-300 bg-white px-2 text-[10px] outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500">{LAYER_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div></div>
      <div className="flex-1 overflow-y-auto">{items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs dark:text-slate-500"><Layers size={20} strokeWidth={1.5} opacity={0.4} aria-hidden="true" /><p className="mt-2">No layers</p></div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">{items.map((item) => {
          const el = item.element
          const sel = isSelected(el.id)
          const VisIcon = el.visible ? Eye : EyeOff
          const LockIcon = el.locked ? LockOpen : Lock
          return (
            <div key={el.id} className={['flex items-center justify-between px-3 py-2 cursor-pointer select-none', sel ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'].join(' ')} onClick={(e) => { e.stopPropagation(); handleSelect(el.id, e.ctrlKey || e.metaKey) }} onMouseEnter={() => setHoveredId(el.id)} onMouseLeave={() => setHoveredId(null)}>
              <div className="flex items-center gap-2 min-w-0"><button onClick={(e) => { e.stopPropagation(); handleToggleVisibility(el.id) }} title={el.visible ? 'Hide' : 'Show'} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300" aria-label={el.visible ? 'Hide layer' : 'Show layer'}><VisIcon size={12} strokeWidth={1.6} aria-hidden="true" /></button><button onClick={(e) => { e.stopPropagation(); handleToggleLock(el.id) }} title={el.locked ? 'Unlock' : 'Lock'} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300" aria-label={el.locked ? 'Unlock layer' : 'Lock layer'}><LockIcon size={12} strokeWidth={1.6} aria-hidden="true" /></button><div className="flex-1 min-w-0 overflow-hidden"><div className="truncate text-xs font-medium" title={el.name}>{el.name || el.type}</div><div className="truncate text-[10px] text-slate-400 dark:text-slate-500">{el.type}</div></div><div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{item.index > 0 && <button onClick={(e) => { e.stopPropagation(); handleMoveUp(el.id) }} title="Move up" className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-30" disabled={item.index <= 0}><ArrowUp size={10} strokeWidth={1.6} aria-hidden="true" /></button>}{item.index < items.length - 1 && <button onClick={(e) => { e.stopPropagation(); handleMoveDown(el.id) }} title="Move down" className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-30" disabled={item.index >= items.length - 1}><ArrowDown size={10} strokeWidth={1.6} aria-hidden="true" /></button>}</div></div><div className="flex items-center gap-1">{hoveredId === el.id && <button onClick={(e) => { e.stopPropagation(); handleDelete(el.id) }} title="Delete" className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/30 dark:hover:text-red-400" aria-label="Delete layer"><Trash2 size={11} strokeWidth={1.6} aria-hidden="true" /></button>}</div>
            </div>
          )
        })}</div>
      )}
      </div>
    </aside>
  )
}

export default LayersPanel