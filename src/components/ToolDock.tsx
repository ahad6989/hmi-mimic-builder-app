// =============================================================================
// ToolDock.tsx — Vertical tool selector panel
//
// Responsibilities:
//   - Display one button per tool
//   - Highlight the active tool
//   - Call setActiveTool() on click
//   - Show the keyboard shortcut for each tool
//
// This component is intentionally simple.
// It reads activeTool from Zustand and writes back via setActiveTool.
// It does NOT know anything about drawing, canvas events, or geometry.
// =============================================================================

import { useEditorStore } from '../store/EditorStore'
import type { Tool } from '../types/canvas'

// ---------------------------------------------------------------------------
// Tool configuration
//
// Define the tools as data, not as repeated JSX.
// If we need to add a new tool, we add one entry here — nothing else changes.
// ---------------------------------------------------------------------------

interface ToolConfig {
  tool: Tool
  label: string       // Short label shown in the button
  shortcut: string    // Keyboard shortcut shown as a hint
  title: string       // Full name shown in the browser tooltip
}

const TOOLS: ToolConfig[] = [
  { tool: 'select',  label: '▲', shortcut: 'V', title: 'Select (V)' },
  { tool: 'rect',    label: '▭', shortcut: 'R', title: 'Rectangle (R)' },
  { tool: 'ellipse', label: '◯', shortcut: 'O', title: 'Ellipse (O)' },
  { tool: 'line',    label: '╱', shortcut: 'L', title: 'Line (L)' },
  { tool: 'polyline', label: '⌁', shortcut: 'Y', title: 'Polyline (Y)' },
  { tool: 'pen',     label: '✒', shortcut: 'P', title: 'Pen (P)' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ToolDock() {
  const activeTool  = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)

  return (
    <aside className="w-14 border-r border-gray-200 bg-gray-50 flex flex-col items-center py-3 gap-1">

      {TOOLS.map(({ tool, label, shortcut, title }) => {
        const isActive = activeTool === tool

        return (
          <button
            key={tool}
            title={title}
            onClick={() => setActiveTool(tool)}
            className={[
              'relative w-10 h-10 rounded flex flex-col items-center justify-center text-sm',
              'transition-colors duration-100',
              isActive
                ? 'bg-blue-100 text-blue-700 shadow-inner'
                : 'text-gray-600 hover:bg-gray-200',
            ].join(' ')}
          >
            {/* Tool icon */}
            <span className="leading-none text-base">{label}</span>

            {/* Keyboard shortcut badge — bottom-right corner of the button */}
            <span className="absolute bottom-0.5 right-1 text-[9px] font-mono opacity-50 leading-none">
              {shortcut}
            </span>
          </button>
        )
      })}

    </aside>
  )
}

export default ToolDock