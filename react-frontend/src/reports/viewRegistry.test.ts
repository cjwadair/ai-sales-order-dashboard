import { describe, expect, it } from 'vitest'
import { viewRegistry, type ViewType } from './viewRegistry'

describe('viewRegistry', () => {
  const allTypes: ViewType[] = ['table', 'bar', 'line', 'pie', 'kpi', 'list']

  it('has a component registered for every ViewType', () => {
    for (const type of allTypes) {
      expect(typeof viewRegistry[type]).toBe('function')
    }
  })

  it('has no extra entries beyond the declared ViewType union', () => {
    expect(Object.keys(viewRegistry).sort()).toEqual([...allTypes].sort())
  })
})
