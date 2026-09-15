import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Download } from 'lucide-react'
import { useEditorStore } from '../store/EditorStore'
import { exportToJPEG, exportToPDF, exportToPNG, exportToSVG } from '../utils/exportSvg'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

type ExportFormat = 'PNG' | 'JPEG' | 'PDF' | 'SVG'
type ExportScale = 1 | 2 | 3

interface ExportPanelProps {
  onClose: () => void
}

function ExportPanel({ onClose }: ExportPanelProps) {
  const elements = useEditorStore((state) => state.elements)
  const panelRef = useRef<HTMLDivElement>(null)
  const [format, setFormat] = useState<ExportFormat>('PNG')
  const [scale, setScale] = useState<ExportScale>(1)
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true)

  const svg = exportToSVG(elements, CANVAS_WIDTH, CANVAS_HEIGHT)
  const previewSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleExport = async () => {
    const width = format === 'SVG' ? CANVAS_WIDTH : CANVAS_WIDTH * scale
    const height = format === 'SVG' ? CANVAS_HEIGHT : CANVAS_HEIGHT * scale
    let blob: Blob

    if (format === 'SVG') {
      blob = new Blob([exportToSVG(elements, width, height)], { type: 'image/svg+xml' })
    } else if (format === 'PNG') {
      blob = await exportToPNG(elements, width, height, '#ffffff')
    } else if (format === 'JPEG') {
      blob = await exportToJPEG(elements, CANVAS_WIDTH, CANVAS_HEIGHT, scale)
    } else {
      blob = await exportToPDF(elements, CANVAS_WIDTH, CANVAS_HEIGHT, scale)
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `Untitled.${format === 'JPEG' ? 'jpg' : format.toLowerCase()}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    onClose()
  }

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-11 z-30 w-72 rounded-lg border border-slate-200 bg-white p-3 text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      role="dialog"
      aria-label="Export settings"
    >
      <div className="flex gap-2">
        <label className="min-w-0 flex-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Scale
          <select
            value={scale}
            onChange={(event) => setScale(Number(event.target.value) as ExportScale)}
            className="mt-1 block h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
          </select>
        </label>
        <label className="min-w-0 flex-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Format
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
            className="mt-1 block h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="PNG">PNG</option>
            <option value="JPEG">JPEG</option>
            <option value="PDF">PDF</option>
            <option value="SVG">SVG</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={() => void handleExport()}
        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded bg-slate-800 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        <Download size={14} aria-hidden="true" />
        Export Untitled
      </button>

      <button
        type="button"
        onClick={() => setIsPreviewExpanded((expanded) => !expanded)}
        className="mt-3 flex w-full items-center justify-between text-left text-xs font-medium text-slate-600 dark:text-slate-300"
        aria-expanded={isPreviewExpanded}
      >
        Preview
        {isPreviewExpanded
          ? <ChevronUp size={14} aria-hidden="true" />
          : <ChevronDown size={14} aria-hidden="true" />}
      </button>

      {isPreviewExpanded && (
        <div className="mt-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-800">
          <img
            src={previewSource}
            alt="Current canvas preview"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </div>
  )
}

export default ExportPanel
