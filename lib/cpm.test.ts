import { describe, it, expect } from 'vitest'
import {
  detectCycle,
  runCpm,
  cpmStartToDate,
  cpmFinishToDate,
  type CpmDependency,
  type CpmActivity,
} from './cpm'
import { computeDurasiHK } from '@/lib/calendar'

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
    const result = runCpm([activity('A', 5)], [], new Date('2026-01-01'), [])
    expect(result.nodes.get('A')).toMatchObject({ earliestStart: 0, earliestFinish: 5 })
  })

  it('FS: successor starts when predecessor finishes (+ lag)', () => {
    const result = runCpm(
      [activity('A', 5), activity('B', 3)],
      [{ predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 }],
      new Date('2026-01-01'),
      []
    )
    expect(result.nodes.get('B')).toMatchObject({ earliestStart: 5, earliestFinish: 8 })
  })

  it('FS with positive lag delays the successor further', () => {
    const result = runCpm(
      [activity('A', 5), activity('B', 3)],
      [{ predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 2 }],
      new Date('2026-01-01'),
      []
    )
    expect(result.nodes.get('B')).toMatchObject({ earliestStart: 7, earliestFinish: 10 })
  })

  it('SS: successor starts when predecessor starts (+ lag)', () => {
    const result = runCpm(
      [activity('A', 5), activity('B', 3)],
      [{ predecessorId: 'A', successorId: 'B', type: 'SS', lagDays: 1 }],
      new Date('2026-01-01'),
      []
    )
    expect(result.nodes.get('B')).toMatchObject({ earliestStart: 1, earliestFinish: 4 })
  })

  it('FF: successor finishes when predecessor finishes (+ lag)', () => {
    const result = runCpm(
      [activity('A', 5), activity('B', 3)],
      [{ predecessorId: 'A', successorId: 'B', type: 'FF', lagDays: 0 }],
      new Date('2026-01-01'),
      []
    )
    expect(result.nodes.get('B')).toMatchObject({ earliestStart: 2, earliestFinish: 5 })
  })

  it('SF: successor finishes when predecessor starts (+ lag)', () => {
    const result = runCpm(
      [activity('A', 2), activity('B', 3)],
      [{ predecessorId: 'A', successorId: 'B', type: 'SF', lagDays: 6 }],
      new Date('2026-01-01'),
      []
    )
    expect(result.nodes.get('B')).toMatchObject({ earliestStart: 3, earliestFinish: 6 })
  })

  it('takes the max constraint when a successor has multiple predecessors', () => {
    const result = runCpm(
      [activity('A', 2), activity('B', 1), activity('C', 3)],
      [
        { predecessorId: 'A', successorId: 'C', type: 'FS', lagDays: 0 },
        { predecessorId: 'B', successorId: 'C', type: 'FS', lagDays: 0 },
      ],
      new Date('2026-01-01'),
      []
    )
    // A finishes at 2, B finishes at 1 — C must wait for the later one (A)
    expect(result.nodes.get('C')).toMatchObject({ earliestStart: 2, earliestFinish: 5 })
  })
})

describe('locked activities via runCpm', () => {
  it('uses the locked date as ES, ignoring predecessors', () => {
    const projectStart = new Date('2026-07-01') // Wednesday
    const activities: CpmActivity[] = [
      { id: 'A', duration: 2, dateLocked: false, lockedStartDate: null },
      { id: 'B', duration: 5, dateLocked: true, lockedStartDate: new Date('2026-07-08') },
    ]
    const dependencies: CpmDependency[] = [{ predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 }]
    const result = runCpm(activities, dependencies, projectStart, [])
    // workingDaysBetween(2026-07-01 Wed, 2026-07-08 Wed) = 5 working days
    // (Thu, Fri, Mon, Tue, Wed — one weekend skipped), same math verified in
    // Task 4's equivalent test.
    expect(result.nodes.get('B')).toMatchObject({ earliestStart: 5, earliestFinish: 10 })
  })
})

describe('date conversion', () => {
  it('cpmStartToDate(0, ...) returns projectStart itself', () => {
    const projectStart = new Date('2026-07-01')
    expect(cpmStartToDate(0, projectStart, [])).toEqual(projectStart)
  })

  it('cpmFinishToDate for a 5-day activity starting at day 0 lands 4 working days later', () => {
    const projectStart = new Date('2026-07-01') // Wednesday
    // duration 5, ES=0, EF=5 (per EF = ES + duration)
    const result = cpmFinishToDate(0, 5, projectStart, [])
    // 4 working days after 2026-07-01 (Wed): Thu, Fri, Mon, Tue -> 2026-07-07
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-07')
  })

  it('round-trips with computeDurasiHK: a known mulai/selesai pair produces the same duration and reconstructs the same selesai', () => {
    const projectStart = new Date('2026-07-01')
    const mulai = '2026-07-01'
    const selesai = '2026-07-07' // 5 working days inclusive (Wed-Tue, skipping weekend)
    const duration = computeDurasiHK(mulai, selesai, [])
    expect(duration).toBe(5)
    const reconstructedSelesai = cpmFinishToDate(0, duration, projectStart, [])
    expect(reconstructedSelesai.toISOString().slice(0, 10)).toBe(selesai)
  })

  it('cpmFinishToDate for a zero-duration (milestone) activity equals its start date', () => {
    const projectStart = new Date('2026-07-01') // Wednesday
    // Milestone activity: earliestStart = earliestFinish = 3 (duration 0, no working days consumed).
    const start = cpmStartToDate(3, projectStart, [])
    const finish = cpmFinishToDate(3, 3, projectStart, [])
    expect(finish).toEqual(start)
  })
})

describe('runCpm — full integration', () => {
  const projectStart = new Date('2026-07-01')

  it('computes float and critical path for a diamond with an off-critical branch', () => {
    // A -> B -> D (critical path: durations 2, 5, 3 = ends at day 10)
    // A -> C -> D (off-critical: durations 2, 1, 3 = ends at day 6, float 4)
    const activities: CpmActivity[] = [
      { id: 'A', duration: 2, dateLocked: false, lockedStartDate: null },
      { id: 'B', duration: 5, dateLocked: false, lockedStartDate: null },
      { id: 'C', duration: 1, dateLocked: false, lockedStartDate: null },
      { id: 'D', duration: 3, dateLocked: false, lockedStartDate: null },
    ]
    const dependencies: CpmDependency[] = [
      { predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
      { predecessorId: 'A', successorId: 'C', type: 'FS', lagDays: 0 },
      { predecessorId: 'B', successorId: 'D', type: 'FS', lagDays: 0 },
      { predecessorId: 'C', successorId: 'D', type: 'FS', lagDays: 0 },
    ]

    const result = runCpm(activities, dependencies, projectStart, [])

    expect(result.hasCycle).toBe(false)
    expect(result.nodes.get('A')).toMatchObject({ earliestStart: 0, earliestFinish: 2, latestStart: 0, latestFinish: 2, totalFloat: 0, isCritical: true })
    expect(result.nodes.get('B')).toMatchObject({ earliestStart: 2, earliestFinish: 7, latestStart: 2, latestFinish: 7, totalFloat: 0, isCritical: true })
    expect(result.nodes.get('C')).toMatchObject({ earliestStart: 2, earliestFinish: 3, latestStart: 6, latestFinish: 7, totalFloat: 4, isCritical: false })
    expect(result.nodes.get('D')).toMatchObject({ earliestStart: 7, earliestFinish: 10, latestStart: 7, latestFinish: 10, totalFloat: 0, isCritical: true })
    expect(result.criticalPath).toEqual(['A', 'B', 'D'])
  })

  it('returns hasCycle true with no nodes computed when the dependency graph has a cycle', () => {
    const activities: CpmActivity[] = [
      { id: 'A', duration: 1, dateLocked: false, lockedStartDate: null },
      { id: 'B', duration: 1, dateLocked: false, lockedStartDate: null },
    ]
    const dependencies: CpmDependency[] = [
      { predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
      { predecessorId: 'B', successorId: 'A', type: 'FS', lagDays: 0 },
    ]
    const result = runCpm(activities, dependencies, projectStart, [])
    expect(result.hasCycle).toBe(true)
    expect(result.cycleIds).toEqual(expect.arrayContaining(['A', 'B']))
    expect(result.nodes.size).toBe(0)
  })

  it('marks every activity critical when there are no dependencies and only one activity', () => {
    const activities: CpmActivity[] = [{ id: 'A', duration: 3, dateLocked: false, lockedStartDate: null }]
    const result = runCpm(activities, [], projectStart, [])
    expect(result.nodes.get('A')).toMatchObject({ totalFloat: 0, isCritical: true })
  })

  it('gives independent parallel activities float relative to the longest one', () => {
    const activities: CpmActivity[] = [
      { id: 'SHORT', duration: 2, dateLocked: false, lockedStartDate: null },
      { id: 'LONG', duration: 10, dateLocked: false, lockedStartDate: null },
    ]
    const result = runCpm(activities, [], projectStart, [])
    expect(result.nodes.get('LONG')).toMatchObject({ isCritical: true, totalFloat: 0 })
    expect(result.nodes.get('SHORT')).toMatchObject({ isCritical: false, totalFloat: 8 })
  })
})

describe('performance', () => {
  it('computes CPM for 60 activities and 80 dependencies in under 200ms', () => {
    const activities: CpmActivity[] = []
    for (let i = 0; i < 60; i++) {
      activities.push({ id: `A${i}`, duration: (i % 5) + 1, dateLocked: false, lockedStartDate: null })
    }
    const dependencies: CpmDependency[] = []
    let depCount = 0
    for (let i = 0; i < 59 && depCount < 80; i++) {
      dependencies.push({ predecessorId: `A${i}`, successorId: `A${i + 1}`, type: 'FS', lagDays: 0 })
      depCount++
    }
    // Add extra cross-links (skip-ahead edges) to reach 80 total, without creating a cycle
    for (let i = 0; i < 60 && depCount < 80; i += 3) {
      const target = i + 2
      if (target < 60) {
        dependencies.push({ predecessorId: `A${i}`, successorId: `A${target}`, type: 'FS', lagDays: 0 })
        depCount++
      }
    }

    const start = performance.now()
    const result = runCpm(activities, dependencies, new Date('2026-01-01'), [])
    const elapsed = performance.now() - start

    expect(result.hasCycle).toBe(false)
    expect(elapsed).toBeLessThan(200)
  })
})
