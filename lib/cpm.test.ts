import { describe, it, expect } from 'vitest'
import { detectCycle, runForwardPassForTest, type CpmDependency, type CpmActivity } from './cpm'

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

function activity(id: string, duration: number): CpmActivity {
  return { id, duration, dateLocked: false, lockedStartDate: null }
}

describe('forward pass', () => {
  it('computes ES=0, EF=duration for an activity with no predecessors', () => {
    const nodes = runForwardPassForTest([activity('A', 5)], [])
    expect(nodes.get('A')).toMatchObject({ earliestStart: 0, earliestFinish: 5 })
  })

  it('FS: successor starts when predecessor finishes (+ lag)', () => {
    const nodes = runForwardPassForTest(
      [activity('A', 5), activity('B', 3)],
      [{ predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 }]
    )
    expect(nodes.get('B')).toMatchObject({ earliestStart: 5, earliestFinish: 8 })
  })

  it('FS with positive lag delays the successor further', () => {
    const nodes = runForwardPassForTest(
      [activity('A', 5), activity('B', 3)],
      [{ predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 2 }]
    )
    expect(nodes.get('B')).toMatchObject({ earliestStart: 7, earliestFinish: 10 })
  })

  it('SS: successor starts when predecessor starts (+ lag)', () => {
    const nodes = runForwardPassForTest(
      [activity('A', 5), activity('B', 3)],
      [{ predecessorId: 'A', successorId: 'B', type: 'SS', lagDays: 1 }]
    )
    expect(nodes.get('B')).toMatchObject({ earliestStart: 1, earliestFinish: 4 })
  })

  it('FF: successor finishes when predecessor finishes (+ lag)', () => {
    const nodes = runForwardPassForTest(
      [activity('A', 5), activity('B', 3)],
      [{ predecessorId: 'A', successorId: 'B', type: 'FF', lagDays: 0 }]
    )
    expect(nodes.get('B')).toMatchObject({ earliestStart: 2, earliestFinish: 5 })
  })

  it('SF: successor finishes when predecessor starts (+ lag)', () => {
    const nodes = runForwardPassForTest(
      [activity('A', 2), activity('B', 3)],
      [{ predecessorId: 'A', successorId: 'B', type: 'SF', lagDays: 6 }]
    )
    expect(nodes.get('B')).toMatchObject({ earliestStart: 3, earliestFinish: 6 })
  })

  it('takes the max constraint when a successor has multiple predecessors', () => {
    const nodes = runForwardPassForTest(
      [activity('A', 2), activity('B', 1), activity('C', 3)],
      [
        { predecessorId: 'A', successorId: 'C', type: 'FS', lagDays: 0 },
        { predecessorId: 'B', successorId: 'C', type: 'FS', lagDays: 0 },
      ]
    )
    // A finishes at 2, B finishes at 1 — C must wait for the later one (A)
    expect(nodes.get('C')).toMatchObject({ earliestStart: 2, earliestFinish: 5 })
  })
})
