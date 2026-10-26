import { describe, it, expect } from 'vitest'
import { buildPathData, createPathElement, type PathPoint } from './canvas'

describe('buildPathData', () => {
  it('starts with M and emits L segments for handle-free points', () => {
    const data = buildPathData([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 5 },
    ])
    expect(data).toBe('M 0 0 L 10 10 L 20 5')
  })

  it('emits a full cubic (C c1 c2 p) when both handles exist', () => {
    const data = buildPathData([
      { x: 0, y: 0, handleOut: { x: 5, y: 10 } },
      { x: 20, y: 0, handleIn: { x: 15, y: -10 } },
    ])
    expect(data).toBe('M 0 0 C 5 10 15 -10 20 0')
  })

  it('falls back to a degenerate cubic for legacy single-handle data', () => {
    const data = buildPathData([
      { x: 0, y: 0, handleOut: { x: 5, y: 10 } },
      { x: 20, y: 0 },
    ])
    expect(data).toBe('M 0 0 C 5 10 20 0 20 0')
  })

  it('mixes straight and curved segments in one path', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0, handleOut: { x: 25, y: 5 } },
      { x: 30, y: 10, handleIn: { x: 35, y: 5 } },
    ]
    const data = buildPathData(points)
    expect(data).toBe('M 0 0 L 10 0 L 20 0 C 25 5 35 5 30 10')
  })
})

describe('createPathElement', () => {
  it('produces a path element with bounds and path data', () => {
    const element = createPathElement([
      { x: 10, y: 20 },
      { x: 50, y: 80 },
    ])
    expect(element.type).toBe('path')
    expect(element.name).toBe('Path')
    expect(element.transform).toMatchObject({ x: 10, y: 20, width: 40, height: 60 })
    expect(element.pathData).toBe('M 10 20 L 50 80')
  })

  it('deep-copies cubic handles so later mutation cannot corrupt the element', () => {
    const source: PathPoint[] = [
      { x: 0, y: 0, handleOut: { x: 5, y: 5 } },
      { x: 20, y: 20, handleIn: { x: 15, y: 15 } },
    ]
    const element = createPathElement(source)

    source[0].handleOut!.x = 999
    source[1].handleIn!.x = 999

    expect(element.points![0].handleOut).toEqual({ x: 5, y: 5 })
    expect(element.points![1].handleIn).toEqual({ x: 15, y: 15 })
    expect(element.pathData).toBe('M 0 0 C 5 5 15 15 20 20')
  })
})