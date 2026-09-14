import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/EditorStore'
import { buildPathData, type CanvasElement } from '../types/canvas'
import { getElementBounds } from '../geometry/bounds'

interface NumberFieldProps {
  fieldKey: string
  label: string
  value: number
  readOnly?: boolean
  onCommit?: (value: number) => void
}

function NumberField({ fieldKey, label, value, readOnly = false, onCommit }: NumberFieldProps) {
  const displayedValue = Math.round(value)
  const [draftValue, setDraftValue] = useState(String(displayedValue))
  const [isFocused, setIsFocused] = useState(false)
  const skipNextBlurCommitRef = useRef(false)

  useEffect(() => {
    if (!isFocused) {
      // Intentional: synchronize external store changes when the field is idle.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftValue(String(displayedValue))
    }
  }, [displayedValue, isFocused])

  const commitValue = (nextInputValue: string) => {
    if (readOnly || !onCommit) return
    const nextValue = Number(nextInputValue)
    if (Number.isFinite(nextValue) && nextValue !== displayedValue) onCommit(nextValue)
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
      <span className="min-w-5 shrink-0 whitespace-nowrap font-medium uppercase">{label}</span>
      <input
        type="number"
        value={draftValue}
        readOnly={readOnly}
        key={fieldKey}
        onFocus={(event) => {
          setIsFocused(true)
          event.currentTarget.select()
        }}
        onChange={(event) => setDraftValue(event.currentTarget.value)}
        onBlur={(event) => {
          if (skipNextBlurCommitRef.current) {
            skipNextBlurCommitRef.current = false
            setIsFocused(false)
            return
          }
          commitValue(event.currentTarget.value)
          setIsFocused(false)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          event.stopPropagation()
          skipNextBlurCommitRef.current = true
          commitValue(draftValue)
          event.currentTarget.blur()
        }}
        className="min-w-[4ch] flex-1 bg-transparent px-2 text-right text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:ring-1 focus:ring-slate-300 [appearance:textfield] dark:text-slate-200 dark:focus:ring-slate-600"
      />
    </div>
  )
}

interface ColorFieldProps {
  label: string
  value: string
  opacity: number
  onColorCommit: (value: string, historyKey?: string) => void
  onOpacityCommit: (value: number) => void
}

function asHexColor(value: string, fallback: string) {
  const trimmedValue = value.trim()
  const normalizedValue = trimmedValue.startsWith('#') ? trimmedValue : `#${trimmedValue}`
  const match = normalizedValue.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return fallback
  if (match[1].length === 3) {
    return `#${match[1].split('').map((character) => character + character).join('')}`
  }
  return normalizedValue.toLowerCase()
}

function ColorField({ label, value, opacity, onColorCommit, onOpacityCommit }: ColorFieldProps) {
  const hexValue = asHexColor(value, label === 'Fill' ? '#ffffff' : '#111827')
  const [hexDraftValue, setHexDraftValue] = useState(hexValue)
  const [isHexFocused, setIsHexFocused] = useState(false)
  const skipHexBlurCommitRef = useRef(false)
  const skipOpacityBlurCommitRef = useRef(false)
  const colorHistoryKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isHexFocused) {
      // Intentional: synchronize external color changes when the field is idle.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHexDraftValue(hexValue)
    }
  }, [hexValue, isHexFocused])

  const beginColorGesture = () => {
    colorHistoryKeyRef.current = crypto.randomUUID()
  }

  const commitHexValue = (nextInputValue: string) => {
    const nextValue = asHexColor(nextInputValue, '')
    if (nextValue) onColorCommit(nextValue)
  }

  const commitOpacityValue = (nextInputValue: string) => {
    const nextValue = Number(nextInputValue)
    if (Number.isFinite(nextValue)) onOpacityCommit(Math.min(100, Math.max(0, nextValue)) / 100)
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(104px,max-content)] items-center gap-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800">
        <input
          type="color"
          defaultValue={hexValue}
          onPointerDown={beginColorGesture}
          onChange={(event) => onColorCommit(event.currentTarget.value, colorHistoryKeyRef.current ?? undefined)}
          onBlur={() => {
            colorHistoryKeyRef.current = null
          }}
          className="h-5 w-5 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-700"
          aria-label={`${label} color`}
        />
        <input
          type="text"
          value={hexDraftValue}
          onFocus={(event) => {
            setIsHexFocused(true)
            event.currentTarget.select()
          }}
          onChange={(event) => setHexDraftValue(event.currentTarget.value)}
          onBlur={(event) => {
            if (skipHexBlurCommitRef.current) {
              skipHexBlurCommitRef.current = false
              setIsHexFocused(false)
              return
            }
            commitHexValue(event.currentTarget.value)
            setIsHexFocused(false)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            event.stopPropagation()
            skipHexBlurCommitRef.current = true
            commitHexValue(hexDraftValue)
            event.currentTarget.blur()
          }}
          className="min-w-[7ch] flex-1 bg-transparent px-1 text-sm font-mono uppercase text-slate-700 outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-200 dark:focus:ring-slate-600"
          aria-label={`${label} hex value`}
        />
      </div>
      <div className="flex min-w-[104px] items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800">
        <input
          type="number"
          min="0"
          max="100"
          defaultValue={Math.round(opacity * 100)}
          onBlur={(event) => {
            if (skipOpacityBlurCommitRef.current) {
              skipOpacityBlurCommitRef.current = false
              return
            }
            commitOpacityValue(event.currentTarget.value)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            event.stopPropagation()
            skipOpacityBlurCommitRef.current = true
            commitOpacityValue(event.currentTarget.value)
            event.currentTarget.blur()
          }}
          className="min-w-[5ch] flex-1 bg-transparent px-1 text-right text-xs text-slate-700 outline-none focus:ring-1 focus:ring-slate-300 [appearance:textfield] dark:text-slate-200 dark:focus:ring-slate-600"
          aria-label={`${label} opacity percentage`}
        />
        <span className="shrink-0 text-[10px] text-slate-400">%</span>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-b border-slate-200 pb-4 last:border-0 dark:border-slate-700">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Inspector() {
  const elements = useEditorStore((state) => state.elements)
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds)
  const updateElement = useEditorStore((state) => state.updateElement)

  const selectedElement = selectedElementIds.length === 1
    ? elements.find((element) => element.id === selectedElementIds[0])
    : undefined

  const updateTransform = (element: CanvasElement, changes: Partial<CanvasElement['transform']>) => {
    updateElement(element.id, {
      transform: { ...element.transform, ...changes },
    })
  }

  const updateStyle = (
    element: CanvasElement,
    changes: Partial<CanvasElement['style']>,
    historyKey?: string
  ) => {
    updateElement(element.id, {
      style: { ...element.style, ...changes },
    }, historyKey)
  }

  const updatePosition = (element: CanvasElement, axis: 'x' | 'y', value: number) => {
    const bounds = getElementBounds(element)
    const delta = value - bounds[axis]

    if (element.type === 'line') {
      updateElement(element.id, {
        x1: (element.x1 ?? 0) + (axis === 'x' ? delta : 0),
        y1: (element.y1 ?? 0) + (axis === 'y' ? delta : 0),
        x2: (element.x2 ?? 0) + (axis === 'x' ? delta : 0),
        y2: (element.y2 ?? 0) + (axis === 'y' ? delta : 0),
        transform: { ...element.transform, [axis]: value },
      })
      return
    }

    if ((element.type === 'polyline' || element.type === 'path') && element.points) {
      const points = element.points.map((point) => ({
        ...point,
        [axis]: point[axis] + delta,
        ...(point.handleOut
          ? { handleOut: { ...point.handleOut, [axis]: point.handleOut[axis] + delta } }
          : {}),
      }))
      updateElement(element.id, {
        points,
        ...(element.type === 'path' ? { pathData: buildPathData(points) } : {}),
        transform: { ...element.transform, [axis]: value },
      })
      return
    }

    updateTransform(element, { [axis]: value })
  }

  const renderPositionFields = (element: CanvasElement) => {
    const bounds = getElementBounds(element)
    return (
      <div className="grid grid-cols-2 gap-2">
        <NumberField fieldKey={`${element.id}-x`} label="X" value={bounds.x} onCommit={(value) => updatePosition(element, 'x', value)} />
        <NumberField fieldKey={`${element.id}-y`} label="Y" value={bounds.y} onCommit={(value) => updatePosition(element, 'y', value)} />
      </div>
    )
  }

  const renderDimensionFields = (element: CanvasElement) => {
    const bounds = getElementBounds(element)
    const editable = element.type === 'rect' || element.type === 'ellipse'
    return (
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          fieldKey={`${element.id}-width`}
          label="W"
          value={bounds.width}
          readOnly={!editable}
          onCommit={(value) => updateTransform(element, { width: Math.max(0, value) })}
        />
        <NumberField
          fieldKey={`${element.id}-height`}
          label="H"
          value={bounds.height}
          readOnly={!editable}
          onCommit={(value) => updateTransform(element, { height: Math.max(0, value) })}
        />
      </div>
    )
  }

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white transition-colors dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <SlidersHorizontal size={15} className="text-slate-500 dark:text-slate-400" aria-hidden="true" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">
          Inspector
        </h2>
      </div>

      {selectedElementIds.length === 0 && (
        <p className="mx-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Select an object to inspect its properties.
        </p>
      )}

      {selectedElementIds.length > 1 && (
        <p className="mx-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Multiple elements selected.
        </p>
      )}

      {selectedElement && (
        <div className="space-y-4 overflow-y-auto p-3">
          <Section title="Position">
            {renderPositionFields(selectedElement)}
          </Section>

          <Section title="Dimensions">
            {renderDimensionFields(selectedElement)}
          </Section>

          <Section title="Appearance">
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                fieldKey={`${selectedElement.id}-opacity`}
                label="Opacity"
                value={Math.round((selectedElement.style.opacity ?? 1) * 100)}
                onCommit={(value) => updateStyle(selectedElement, {
                  opacity: Math.min(100, Math.max(0, value)) / 100,
                })}
              />
              {selectedElement.type === 'rect' ? (
                <NumberField
                  fieldKey={`${selectedElement.id}-radius`}
                  label="Radius"
                  value={selectedElement.rx ?? 0}
                  onCommit={(value) => updateElement(selectedElement.id, {
                    rx: Math.max(0, value),
                    ry: Math.max(0, value),
                  })}
                />
              ) : <div />}
            </div>
          </Section>

          <Section title="Fill">
            <ColorField
              label="Fill"
              value={selectedElement.style.fill}
              opacity={selectedElement.style.fillOpacity}
              onColorCommit={(value, historyKey) => updateStyle(selectedElement, { fill: value }, historyKey)}
              onOpacityCommit={(value) => updateStyle(selectedElement, { fillOpacity: value })}
            />
          </Section>

          <Section title="Stroke">
            <ColorField
              label="Stroke"
              value={selectedElement.style.stroke}
              opacity={selectedElement.style.strokeOpacity}
              onColorCommit={(value, historyKey) => updateStyle(selectedElement, { stroke: value }, historyKey)}
              onOpacityCommit={(value) => updateStyle(selectedElement, { strokeOpacity: value })}
            />
            <NumberField
              fieldKey={`${selectedElement.id}-stroke-width`}
              label="Weight"
              value={selectedElement.style.strokeWidth}
              onCommit={(value) => updateStyle(selectedElement, {
                strokeWidth: Math.max(0, value),
              })}
            />
          </Section>

          {(selectedElement.type === 'polyline' || selectedElement.type === 'path') && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {selectedElement.points?.length ?? 0} points
            </p>
          )}
        </div>
      )}
    </aside>
  )
}

export default Inspector
