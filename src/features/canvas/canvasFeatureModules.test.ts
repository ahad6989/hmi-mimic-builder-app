// =============================================================================
// canvasFeatureModules.test.ts — Tests for canvas feature module wiring
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  getAvailableTools, isToolEnabled, getToolByName,
  REGISTERED_TOOLS, TOOL_CATEGORIES,
} from './canvasFeatureModules'

describe('canvasFeatureModules', () => {
  describe('getAvailableTools', () => {
    it('returns all registered tools', () => {
      const tools = getAvailableTools()
      expect(tools.length).toBeGreaterThan(0)
      expect(tools.some((t) => t.name === 'Select')).toBe(true)
    })
  })

  describe('isToolEnabled', () => {
    it('returns true for enabled tools', () => {
      expect(isToolEnabled('select')).toBe(true)
    })

    it('returns false for unknown tools', () => {
      expect(isToolEnabled('nonexistent')).toBe(false)
    })
  })

  describe('getToolByName', () => {
    it('returns a tool by its name', () => {
      const tool = getToolByName('Select')
      expect(tool).toBeDefined()
      if (tool) expect(tool.name).toBe('Select')
    })

    it('returns undefined for unknown names', () => {
      expect(getToolByName('Not A Tool')).toBeUndefined()
    })
  })

  describe('REGISTERED_TOOLS', () => {
    it('contains expected tool entries', () => {
      const names = REGISTERED_TOOLS.map((t) => t.name)
      expect(names).toContain('Select')
      expect(names).toContain('Rectangle')
      expect(names).toContain('Ellipse')
      expect(names).toContain('Line')
      expect(names).toContain('Polyline')
      expect(names).toContain('Pen')
      expect(names).toContain('Pencil')
      expect(names).toContain('Text')
      expect(names).toContain('Pan')
    })
  })

  describe('TOOL_CATEGORIES', () => {
    it('lists tool categories', () => {
      const categories = TOOL_CATEGORIES.map((c) => c.label)
      expect(categories).toContain('Selection')
      expect(categories).toContain('Shapes')
      expect(categories).toContain('Drawing')
      expect(categories).toContain('Text')
      expect(categories).toContain('Navigation')
    })
  })
})
