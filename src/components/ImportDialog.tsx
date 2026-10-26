import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useEffect } from 'react'

export interface ImportModalState {
  type: 'error' | 'warning'
  title: string
  message: string
  details?: string[]
}

interface ImportDialogProps {
  modal: ImportModalState | null
  notice: string | null
  onCloseModal: () => void
  onDismissNotice: () => void
}

export function ImportDialog({
  modal,
  notice,
  onCloseModal,
  onDismissNotice,
}: ImportDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modal) onCloseModal()
        else if (notice) onDismissNotice()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modal, notice, onCloseModal, onDismissNotice])

  return (
    <>
      {/* Dismissible Notice Banner (when items are skipped) */}
      {notice && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-16 right-6 z-50 flex max-w-md items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-xl transition-all duration-200 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <Info size={16} className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p className="flex-1 font-medium">{notice}</p>
          <button
            type="button"
            onClick={onDismissNotice}
            title="Dismiss notice"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-amber-600 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-400 dark:hover:bg-amber-900 dark:hover:text-amber-100"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </aside>
      )}

      {/* Error / Validation Modal Dialog */}
      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={onCloseModal}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  modal.type === 'error'
                    ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                }`}
              >
                {modal.type === 'error' ? (
                  <AlertCircle size={20} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={20} strokeWidth={2} aria-hidden="true" />
                )}
              </div>

              <div className="flex-1">
                <h3
                  id="import-dialog-title"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  {modal.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {modal.message}
                </p>

                {modal.details && modal.details.length > 0 && (
                  <div className="mt-3 max-h-36 overflow-y-auto rounded-md border border-slate-100 bg-slate-50 p-2.5 text-[11px] font-mono text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    {modal.details.map((detail, index) => (
                      <p key={index} className="truncate" title={detail}>
                        {detail}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onCloseModal}
                className="rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ImportDialog
