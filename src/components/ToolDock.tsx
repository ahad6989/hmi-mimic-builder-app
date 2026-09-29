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

import {
  Circle,
  CircleDot,
  Minus,
  MousePointer2,
  PenTool,
  Square,
  Type,
  type LucideIcon,
} from 'lucide-react'
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
  icon: LucideIcon
  shortcut: string    // Keyboard shortcut shown as a hint
  title: string       // Full name shown in the browser tooltip
}

const TOOLS: ToolConfig[] = [
  { tool: 'select', icon: MousePointer2, shortcut: 'V', title: 'Select (V)' },
  { tool: 'rect', icon: Square, shortcut: 'R', title: 'Rectangle (R)' },
  { tool: 'ellipse', icon: Circle, shortcut: 'O', title: 'Ellipse (O)' },
  { tool: 'line', icon: Minus, shortcut: 'L', title: 'Line (L)' },
  { tool: 'polyline', icon: CircleDot, shortcut: 'Y', title: 'Polyline (Y)' },
  { tool: 'pen', icon: PenTool, shortcut: 'P', title: 'Pen (P)' },
  { tool: 'text', icon: Type, shortcut: 'T', title: 'Text (T)' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ToolDock() {
  const activeTool  = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)

  return (
    <aside className="w-14 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col items-center gap-1 py-3 transition-colors dark:border-slate-700 dark:bg-slate-900">

      {TOOLS.map(({ tool, icon: Icon, shortcut, title }) => {
        const isActive = activeTool === tool

        return (
          <button
            key={tool}
            title={title}
            onClick={() => setActiveTool(tool)}
            className={[
              'relative flex h-10 w-10 flex-col items-center justify-center rounded transition-colors duration-100',
              isActive
                ? 'bg-blue-100 text-blue-700 shadow-inner dark:bg-blue-950 dark:text-blue-300'
                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
            ].join(' ')}
          >
            {/* Tool icon */}
            <Icon size={17} strokeWidth={1.9} aria-hidden="true" />

            {/* Keyboard shortcut badge — bottom-right corner of the button */}
            <span className="absolute bottom-0.5 right-1 text-[9px] font-mono leading-none opacity-50">
              {shortcut}
            </span>
          </button>
        )
      })}

    </aside>
  )
}

export default ToolDock