import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Download } from 'lucide-react'
import { useEditorStore } from '../store/EditorStore'
import { exportToJPEG, exportToPDF, exportToPNG, exportToSVG } from '../utils/exportSvg'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

type ExportFormat = 'PNG' | 'JPEG' | 'PDF' | 'SVG'
type ExportScale = 1 | 2 | 3
type BackgroundOption = 'transparent' | '#ffffff' | '#0f172a' | 'custom'

interface ExportPanelProps {
  onClose: () => void
}

function ExportPanel({ onClose }: ExportPanelProps) {
  const elements = useEditorStore((state) => state.elements)
  const panelRef = useRef<HTMLDivElement>(null)
  const [format, setFormat] = useState<ExportFormat>('PNG')
  const [scale, setScale] = useState<ExportScale>(1)
  const [bgOption, setBgOption] = useState<BackgroundOption>('transparent')
  const [customBg, setCustomBg] = useState('#ffffff')
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

  const getEffectiveBg = (currentFormat: ExportFormat): string | undefined => {
    if (currentFormat === 'PNG') {
      if (bgOption === 'transparent') return undefined
      if (bgOption === 'custom') return customBg
      return bgOption
    }
    // JPEG/PDF don't support alpha channel in standard usage
    if (bgOption === 'transparent' || bgOption === '#ffffff') return '#ffffff'
    if (bgOption === 'custom') return customBg
    return bgOption
  }

  const handleExport = async () => {
    let blob: Blob
    const effectiveBg = getEffectiveBg(format)

    if (format === 'SVG') {
      blob = new Blob([exportToSVG(elements, CANVAS_WIDTH, CANVAS_HEIGHT)], { type: 'image/svg+xml' })
    } else if (format === 'PNG') {
      blob = await exportToPNG(elements, CANVAS_WIDTH, CANVAS_HEIGHT, effectiveBg, scale)
    } else if (format === 'JPEG') {
      blob = await exportToJPEG(elements, CANVAS_WIDTH, CANVAS_HEIGHT, scale, 0.92, effectiveBg ?? '#ffffff')
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

  const previewBgStyle = format === 'PNG' && bgOption === 'transparent'
    ? { backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px' }
    : { backgroundColor: getEffectiveBg(format) ?? '#ffffff' }

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

      {(format === 'PNG' || format === 'JPEG') && (
        <div className="mt-2.5">
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Background
            <div className="mt-1 flex items-center gap-1.5">
              <select
                value={bgOption}
                onChange={(event) => setBgOption(event.target.value as BackgroundOption)}
                className="block h-9 flex-1 rounded border border-slate-200 bg-white px-2 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {format === 'PNG' && <option value="transparent">Transparent</option>}
                <option value="#ffffff">White</option>
                <option value="#0f172a">Dark</option>
                <option value="custom">Custom Color</option>
              </select>
              {bgOption === 'custom' && (
                <input
                  type="color"
                  value={customBg}
                  onChange={(e) => setCustomBg(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
                  aria-label="Custom background color"
                />
              )}
            </div>
          </label>
        </div>
      )}

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
        <div
          style={previewBgStyle}
          className="mt-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded border border-slate-200 p-2 dark:border-slate-700"
        >
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
