import { describe, it, expect } from 'vitest'
import { detectCycle, type CpmDependency } from './cpm'

function dep(predecessorId: string, successorId: string): CpmDependency {
  return { predecessorId, successorId, type: 'FS', lagDays: 0 }
}

describe('detectCycle', () => {
  it('returns no cycle for a simple linear chain', () => {
    const result = detectCycle(['A', 'B', 'C'], [dep('A', 'B'), dep('B', 'C')])
    expect(result.hasCycle).toBe(false)
    expect(result.cycleIds).toEqual([])
  })

  it('returns no cycle for a diamond (shared dependency, not circular)', () => {
    const result = detectCycle(
      ['A', 'B', 'C', 'D'],
      [dep('A', 'B'), dep('A', 'C'), dep('B', 'D'), dep('C', 'D')]
    )
    expect(result.hasCycle).toBe(false)
  })

  it('detects a direct two-node cycle', () => {
    const result = detectCycle(['A', 'B'], [dep('A', 'B'), dep('B', 'A')])
    expect(result.hasCycle).toBe(true)
    expect(result.cycleIds).toEqual(expect.arrayContaining(['A', 'B']))
  })

  it('detects a longer indirect cycle', () => {
    const result = detectCycle(['A', 'B', 'C'], [dep('A', 'B'), dep('B', 'C'), dep('C', 'A')])
    expect(result.hasCycle).toBe(true)
    expect(result.cycleIds).toEqual(expect.arrayContaining(['A', 'B', 'C']))
  })

  it('returns no cycle when there are no dependencies at all', () => {
    const result = detectCycle(['A', 'B', 'C'], [])
    expect(result.hasCycle).toBe(false)
  })
})
