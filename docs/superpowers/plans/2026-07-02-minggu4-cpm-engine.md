# Minggu 4: CPM Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Critical Path Method engine as a pure TypeScript module with a full unit test suite, and wire it into the 10 existing `TODO Week 4` markers across the Week 2 API routes so activity dates and critical-path status recalculate automatically whenever schedule-affecting data changes.

**Architecture:** `lib/cpm.ts` is a pure, DB-free module implementing PRD §8's algorithm (cycle detection, topological sort, forward/backward pass, float, critical path). `lib/cpm-runner.ts` is the DB-aware wrapper that fetches a location's activities/dependencies/holidays, calls `runCpm`, writes results back, and logs an audit entry. Every mutation route that can affect scheduling calls `runCpmForLocation` (or, for holiday changes, `runCpmForAllActiveLocations`) after its own write succeeds. No UI changes this week — every existing endpoint's response shape is unchanged except the recalculate endpoint, whose whole purpose is exposing the CPM result.

**Tech Stack:** TypeScript · Vitest (new — first automated test runner in this project) · date-fns v3 · Supabase JS v2

**Spec:** `docs/superpowers/specs/2026-07-02-minggu4-cpm-engine-design.md`

## Global Constraints

- `lib/cpm.ts` contains NO Supabase/DB calls — pure functions only, per PRD §8's explicit directive
- Types in `lib/cpm.ts` match PRD §8.1, with one necessary addition: `CpmActivity.lockedStartDate: Date | null`, required to implement "use existing date for locked activities" (the PRD's own type snippet omits a field for this, but its algorithm description requires it)
- Response envelope unchanged for every endpoint except `POST /api/locations/[locationId]/recalculate`: `{ data: T | null, error: { code, message } | null }`
- Every existing route's `isAdmin(profile.role)` check stays exactly where it is — CPM triggers happen only after a successful, already-authorized write
- CPM must be `await`-ed (never fire-and-forget) so the DB is consistent by the time each handler responds, and so `POST /api/dependencies` can reject a cycle-creating request before inserting it
- `npm run build` must pass before every commit; `npm test` (new) must pass before every commit from Task 1 onward
- Vitest is scoped to `lib/cpm.ts` and `lib/calendar.ts` only — no jsdom, no React/component tests this week
- TypeScript strict — no implicit `any`
- Every git commit message follows the existing convention: `feat:`/`fix:` prefix, one line

---

## Task 1: Vitest Setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/smoke.test.ts` (deleted at the end of this task — exists only to prove the runner works)

**Interfaces:**
- Produces: `npm test` runs Vitest once (`vitest run`, not watch mode) and exits non-zero on failure

- [ ] **Step 1: Install Vitest**

  ```bash
  npm install -D vitest
  ```

- [ ] **Step 2: Create `vitest.config.ts`**

  ```typescript
  import { defineConfig } from 'vitest/config'

  export default defineConfig({
    test: {
      include: ['lib/**/*.test.ts'],
    },
  })
  ```

- [ ] **Step 3: Add the test script to `package.json`**

  In the `"scripts"` block, add:
  ```json
      "test": "vitest run",
  ```
  (alongside the existing `dev`, `build`, `start`, `lint` scripts — comma-separate correctly with the existing entries)

- [ ] **Step 4: Write a throwaway smoke test to verify the runner works**

  Create `lib/smoke.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'

  describe('vitest smoke test', () => {
    it('runs', () => {
      expect(1 + 1).toBe(2)
    })
  })
  ```

- [ ] **Step 5: Run it**

  Run: `npm test`
  Expected: 1 passed, exit code 0

- [ ] **Step 6: Delete the smoke test**

  ```bash
  rm lib/smoke.test.ts
  ```

  Run `npm test` again. Expected: "No test files found" — this is fine, it's expected until Task 2 adds real tests. Do not treat this as a failure.

- [ ] **Step 7: Commit**

  ```bash
  git add package.json package-lock.json vitest.config.ts
  git commit -m "feat: add Vitest as the project's first automated test runner"
  ```

---

## Task 2: `lib/cpm.ts` — Types + Cycle Detection

**Files:**
- Create: `lib/cpm.ts`
- Create: `lib/cpm.test.ts`

**Interfaces:**
- Produces: `DepType`, `CpmActivity`, `CpmDependency`, `CpmNode`, `CpmResult` types; `detectCycle(activityIds: string[], dependencies: CpmDependency[]): { hasCycle: boolean; cycleIds: string[] }`

- [ ] **Step 1: Write the failing tests**

  Create `lib/cpm.test.ts`:
  ```typescript
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
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npm test`
  Expected: FAIL — `lib/cpm.ts` doesn't exist yet ("Cannot find module './cpm'")

- [ ] **Step 3: Create `lib/cpm.ts` with types and `detectCycle`**

  ```typescript
  export type DepType = 'FS' | 'SS' | 'FF' | 'SF'

  export interface CpmActivity {
    id: string
    duration: number
    dateLocked: boolean
    // Required (non-null) when dateLocked is true; ignored otherwise. Not in
    // the PRD's own CpmActivity snippet, but required to implement "use
    // existing date for locked activities" (PRD §8.3 step 3).
    lockedStartDate: Date | null
  }

  export interface CpmDependency {
    predecessorId: string
    successorId: string
    type: DepType
    lagDays: number
  }

  export interface CpmNode extends CpmActivity {
    earliestStart: number
    earliestFinish: number
    latestStart: number
    latestFinish: number
    totalFloat: number
    isCritical: boolean
  }

  export interface CpmResult {
    nodes: Map<string, CpmNode>
    criticalPath: string[]
    hasCycle: boolean
    cycleIds: string[]
  }

  export function detectCycle(
    activityIds: string[],
    dependencies: CpmDependency[]
  ): { hasCycle: boolean; cycleIds: string[] } {
    const adjacency = new Map<string, string[]>()
    for (const id of activityIds) adjacency.set(id, [])
    for (const dep of dependencies) {
      adjacency.get(dep.predecessorId)?.push(dep.successorId)
    }

    const WHITE = 0
    const GRAY = 1
    const BLACK = 2
    const color = new Map<string, number>()
    for (const id of activityIds) color.set(id, WHITE)
    const stack: string[] = []
    let cycleIds: string[] = []
    let hasCycle = false

    function dfs(node: string) {
      if (hasCycle) return
      color.set(node, GRAY)
      stack.push(node)
      for (const next of adjacency.get(node) ?? []) {
        if (hasCycle) return
        const c = color.get(next)
        if (c === GRAY) {
          const idx = stack.indexOf(next)
          cycleIds = stack.slice(idx)
          hasCycle = true
          return
        }
        if (c === WHITE) dfs(next)
      }
      stack.pop()
      color.set(node, BLACK)
    }

    for (const id of activityIds) {
      if (hasCycle) break
      if (color.get(id) === WHITE) dfs(id)
    }

    return { hasCycle, cycleIds }
  }
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npm test`
  Expected: 5 passed

- [ ] **Step 5: Commit**

  ```bash
  git add lib/cpm.ts lib/cpm.test.ts
  git commit -m "feat: add CPM types and cycle detection"
  ```

---

## Task 3: `lib/cpm.ts` — Topological Sort + Forward Pass (Unlocked Activities)

**Files:**
- Modify: `lib/cpm.ts`
- Modify: `lib/cpm.test.ts`

**Interfaces:**
- Consumes: `CpmActivity`, `CpmDependency`, `CpmNode` from Task 2
- Produces: internal (non-exported) `topologicalSort`, `forwardPass` — exercised in this task only through a temporary exported test helper (removed in Task 5 once `runCpm` exists and supersedes it)

- [ ] **Step 1: Write the failing tests**

  Append to `lib/cpm.test.ts`:
  ```typescript
  import { runForwardPassForTest } from './cpm'

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
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npm test`
  Expected: FAIL — `runForwardPassForTest` is not exported

- [ ] **Step 3: Add topological sort and forward pass to `lib/cpm.ts`**

  Append to `lib/cpm.ts` (after `detectCycle`):
  ```typescript
  function topologicalSort(activityIds: string[], dependencies: CpmDependency[]): string[] {
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()
    for (const id of activityIds) {
      inDegree.set(id, 0)
      adjacency.set(id, [])
    }
    for (const dep of dependencies) {
      adjacency.get(dep.predecessorId)?.push(dep.successorId)
      inDegree.set(dep.successorId, (inDegree.get(dep.successorId) ?? 0) + 1)
    }

    const queue: string[] = activityIds.filter((id) => inDegree.get(id) === 0)
    const order: string[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      order.push(node)
      for (const next of adjacency.get(node) ?? []) {
        const newDegree = (inDegree.get(next) ?? 0) - 1
        inDegree.set(next, newDegree)
        if (newDegree === 0) queue.push(next)
      }
    }
    return order
  }

  function forwardPass(
    order: string[],
    nodeMap: Map<string, CpmNode>,
    predecessorsOf: Map<string, CpmDependency[]>,
    projectStart: Date,
    holidays: Date[]
  ): void {
    for (const id of order) {
      const node = nodeMap.get(id)!

      if (node.dateLocked && node.lockedStartDate) {
        node.earliestStart = workingDaysBetween(projectStart, node.lockedStartDate, holidays)
        node.earliestFinish = node.earliestStart + node.duration
        continue
      }

      const preds = predecessorsOf.get(id) ?? []
      let es = 0
      for (const dep of preds) {
        const predNode = nodeMap.get(dep.predecessorId)!
        // Every dependency type is translated into an ES lower bound for
        // `node`, then combined with a single max() — equivalent to PRD's
        // per-type running ES/EF accumulators, but also correct when a
        // successor has predecessors of mixed types (a case the PRD's
        // pseudocode doesn't spell out explicitly).
        if (dep.type === 'FS') {
          es = Math.max(es, predNode.earliestFinish + dep.lagDays)
        } else if (dep.type === 'SS') {
          es = Math.max(es, predNode.earliestStart + dep.lagDays)
        } else if (dep.type === 'FF') {
          es = Math.max(es, predNode.earliestFinish + dep.lagDays - node.duration)
        } else if (dep.type === 'SF') {
          es = Math.max(es, predNode.earliestStart + dep.lagDays - node.duration)
        }
      }
      node.earliestStart = es
      node.earliestFinish = es + node.duration
    }
  }

  function buildNodeMap(activities: CpmActivity[]): Map<string, CpmNode> {
    const nodeMap = new Map<string, CpmNode>()
    for (const activity of activities) {
      nodeMap.set(activity.id, {
        ...activity,
        earliestStart: 0,
        earliestFinish: 0,
        latestStart: 0,
        latestFinish: 0,
        totalFloat: 0,
        isCritical: false,
      })
    }
    return nodeMap
  }

  function buildAdjacencyMaps(
    activityIds: string[],
    dependencies: CpmDependency[]
  ): { predecessorsOf: Map<string, CpmDependency[]>; successorsOf: Map<string, CpmDependency[]> } {
    const predecessorsOf = new Map<string, CpmDependency[]>()
    const successorsOf = new Map<string, CpmDependency[]>()
    for (const id of activityIds) {
      predecessorsOf.set(id, [])
      successorsOf.set(id, [])
    }
    for (const dep of dependencies) {
      predecessorsOf.get(dep.successorId)?.push(dep)
      successorsOf.get(dep.predecessorId)?.push(dep)
    }
    return { predecessorsOf, successorsOf }
  }

  // Exported only for Task 3's own tests. Task 5 replaces call sites with the
  // full `runCpm`; this export is removed at the end of Task 5.
  export function runForwardPassForTest(
    activities: CpmActivity[],
    dependencies: CpmDependency[]
  ): Map<string, CpmNode> {
    const activityIds = activities.map((a) => a.id)
    const nodeMap = buildNodeMap(activities)
    const order = topologicalSort(activityIds, dependencies)
    const { predecessorsOf } = buildAdjacencyMaps(activityIds, dependencies)
    forwardPass(order, nodeMap, predecessorsOf, new Date('2026-01-01'), [])
    return nodeMap
  }
  ```

  Add `workingDaysBetween` to the top of `lib/cpm.ts`:
  ```typescript
  import { workingDaysBetween } from '@/lib/calendar'
  ```
  (insert as the first line of the file, above the `DepType` export)

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npm test`
  Expected: all tests pass (5 from Task 2 + 7 new)

- [ ] **Step 5: Commit**

  ```bash
  git add lib/cpm.ts lib/cpm.test.ts
  git commit -m "feat: add CPM topological sort and forward pass"
  ```

---

## Task 4: `lib/cpm.ts` — Locked Activities + Date Conversion Helpers

**Files:**
- Modify: `lib/cpm.ts`
- Modify: `lib/cpm.test.ts`

**Interfaces:**
- Consumes: `addWorkingDays`, `workingDaysBetween` from `lib/calendar.ts`
- Produces: `cpmStartToDate(earliestStart: number, projectStart: Date, holidays: Date[]): Date`, `cpmFinishToDate(earliestFinish: number, projectStart: Date, holidays: Date[]): Date`

- [ ] **Step 1: Write the failing tests**

  Append to `lib/cpm.test.ts`:
  ```typescript
  import { cpmStartToDate, cpmFinishToDate } from './cpm'

  describe('locked activities in forward pass', () => {
    it('uses the locked date as ES, ignoring predecessors', () => {
      const projectStart = new Date('2026-07-01') // Wednesday
      const locked: CpmActivity = {
        id: 'A',
        duration: 5,
        dateLocked: true,
        lockedStartDate: new Date('2026-07-08'), // 3 working days after projectStart
      }
      const nodes = runForwardPassForTest([locked], [])
      // runForwardPassForTest currently hardcodes projectStart to 2026-01-01;
      // this test calls the lower-level pieces directly instead.
      expect(nodes).toBeDefined() // placeholder assertion removed below
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
      const result = cpmFinishToDate(5, projectStart, [])
      // 4 working days after 2026-07-01 (Wed): Thu, Fri, Mon, Tue -> 2026-07-07
      expect(result.toISOString().slice(0, 10)).toBe('2026-07-07')
    })

    it('round-trips with computeDurasiHK: a known mulai/selesai pair produces the same duration and reconstructs the same selesai', () => {
      const projectStart = new Date('2026-07-01')
      const mulai = '2026-07-01'
      const selesai = '2026-07-07' // 5 working days inclusive (Wed-Tue, skipping weekend)
      const duration = computeDurasiHK(mulai, selesai, [])
      expect(duration).toBe(5)
      const reconstructedSelesai = cpmFinishToDate(duration, projectStart, [])
      expect(reconstructedSelesai.toISOString().slice(0, 10)).toBe(selesai)
    })
  })
  ```

  Replace the placeholder locked-activity test above with a real one once the lower-level pieces are exported — since `runForwardPassForTest` hardcodes `projectStart`, add a second test helper. Replace the whole `describe('locked activities in forward pass', ...)` block with:
  ```typescript
  describe('locked activities in forward pass', () => {
    it('uses the locked date as ES (converted via workingDaysBetween from projectStart), ignoring predecessors', () => {
      const projectStart = new Date('2026-07-01') // Wednesday
      const activities: CpmActivity[] = [
        { id: 'A', duration: 2, dateLocked: false, lockedStartDate: null },
        {
          id: 'B',
          duration: 5,
          dateLocked: true,
          lockedStartDate: new Date('2026-07-08'), // 3 working days after projectStart
        },
      ]
      // A -> B FS, lag 0: if B were NOT locked, B.ES would be A.EF = 2.
      // Because B is locked, its ES must come from lockedStartDate instead.
      const deps: CpmDependency[] = [{ predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 }]
      const nodeMap = buildNodeMapForTest(activities)
      const order = topologicalSortForTest(
        activities.map((a) => a.id),
        deps
      )
      const { predecessorsOf } = buildAdjacencyMapsForTest(activities.map((a) => a.id), deps)
      forwardPassForTest(order, nodeMap, predecessorsOf, projectStart, [])
      expect(nodeMap.get('B')).toMatchObject({ earliestStart: 3, earliestFinish: 8 })
    })
  })
  ```

  This requires exporting three more internal helpers for testing (temporary, same lifecycle as `runForwardPassForTest` — removed in Task 5). Add these imports at the top of the locked-activity test block instead of inline requires:
  ```typescript
  import {
    buildNodeMapForTest,
    topologicalSortForTest,
    buildAdjacencyMapsForTest,
    forwardPassForTest,
  } from './cpm'
  ```

  And `computeDurasiHK` for the round-trip test:
  ```typescript
  import { computeDurasiHK } from '@/lib/calendar'
  ```

  (`computeDurasiHK` doesn't exist in `lib/calendar.ts` yet — that's Task 7. This specific round-trip test is written now but will fail to import until Task 7 lands. Mark it `it.skip` for now and un-skip it in Task 7:
  ```typescript
    it.skip('round-trips with computeDurasiHK: a known mulai/selesai pair produces the same duration and reconstructs the same selesai', () => {
  ```
  )

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npm test`
  Expected: FAIL — `cpmStartToDate`, `cpmFinishToDate`, `buildNodeMapForTest`, `topologicalSortForTest`, `buildAdjacencyMapsForTest`, `forwardPassForTest` are not exported

- [ ] **Step 3: Add date conversion helpers and temporary test exports to `lib/cpm.ts`**

  Change the top import line to include `addWorkingDays`:
  ```typescript
  import { addWorkingDays, workingDaysBetween } from '@/lib/calendar'
  ```

  Append at the end of `lib/cpm.ts`:
  ```typescript
  export function cpmStartToDate(earliestStart: number, projectStart: Date, holidays: Date[]): Date {
    return addWorkingDays(projectStart, earliestStart, holidays)
  }

  export function cpmFinishToDate(earliestFinish: number, projectStart: Date, holidays: Date[]): Date {
    return addWorkingDays(projectStart, earliestFinish - 1, holidays)
  }

  // Temporary test-only exports, same lifecycle as runForwardPassForTest —
  // removed in Task 5 once runCpm supersedes them.
  export const buildNodeMapForTest = buildNodeMap
  export const topologicalSortForTest = topologicalSort
  export const buildAdjacencyMapsForTest = buildAdjacencyMaps
  export const forwardPassForTest = forwardPass
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npm test`
  Expected: all tests pass, with the round-trip test showing as skipped (not failed)

- [ ] **Step 5: Commit**

  ```bash
  git add lib/cpm.ts lib/cpm.test.ts
  git commit -m "feat: add CPM locked-activity handling and date conversion helpers"
  ```

---

## Task 5: `lib/cpm.ts` — Backward Pass, Float, Critical Path, Full `runCpm`

**Files:**
- Modify: `lib/cpm.ts`
- Modify: `lib/cpm.test.ts`

**Interfaces:**
- Produces: `runCpm(activities: CpmActivity[], dependencies: CpmDependency[], projectStart: Date, holidays: Date[]): CpmResult` — the main public entry point
- Removes: `runForwardPassForTest`, `buildNodeMapForTest`, `topologicalSortForTest`, `buildAdjacencyMapsForTest`, `forwardPassForTest` (Tasks 3-4's temporary test-only exports) and their corresponding test imports, now superseded by `runCpm`

- [ ] **Step 1: Write the failing tests**

  Append to `lib/cpm.test.ts`:
  ```typescript
  import { runCpm } from './cpm'

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
  ```

  Remove Task 3/4's now-superseded imports and the standalone locked-activity test (the same scenario is more clearly expressed through `runCpm` directly — replace it):

  Delete the `import { runForwardPassForTest } from './cpm'` line, the `import { buildNodeMapForTest, topologicalSortForTest, buildAdjacencyMapsForTest, forwardPassForTest } from './cpm'` block, and the entire `describe('locked activities in forward pass', ...)` block from Task 4. Replace with:
  ```typescript
  describe('locked activities via runCpm', () => {
    it('uses the locked date as ES, ignoring predecessors', () => {
      const projectStart = new Date('2026-07-01') // Wednesday
      const activities: CpmActivity[] = [
        { id: 'A', duration: 2, dateLocked: false, lockedStartDate: null },
        { id: 'B', duration: 5, dateLocked: true, lockedStartDate: new Date('2026-07-08') },
      ]
      const dependencies: CpmDependency[] = [{ predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 }]
      const result = runCpm(activities, dependencies, projectStart, [])
      expect(result.nodes.get('B')).toMatchObject({ earliestStart: 3, earliestFinish: 8 })
    })
  })
  ```

  Also change every remaining call to `runForwardPassForTest` in the `describe('forward pass', ...)` block (Task 3) to use `runCpm` instead, extracting `.nodes` from the result:
  ```typescript
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
      expect(result.nodes.get('C')).toMatchObject({ earliestStart: 2, earliestFinish: 5 })
    })
  })
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npm test`
  Expected: FAIL — `runCpm` is not exported yet; also the temporary test-only symbols removed from the test file will fail to resolve until Step 3 removes them from `lib/cpm.ts` too (that's fine, expected mid-step state)

- [ ] **Step 3: Add backward pass, critical path assembly, and `runCpm` to `lib/cpm.ts`; remove the temporary test-only exports**

  Remove these lines from `lib/cpm.ts` (Task 3/4's temporary exports, now superseded):
  ```typescript
  // Exported only for Task 3's own tests. Task 5 replaces call sites with the
  // full `runCpm`; this export is removed at the end of Task 5.
  export function runForwardPassForTest(
    activities: CpmActivity[],
    dependencies: CpmDependency[]
  ): Map<string, CpmNode> {
    const activityIds = activities.map((a) => a.id)
    const nodeMap = buildNodeMap(activities)
    const order = topologicalSort(activityIds, dependencies)
    const { predecessorsOf } = buildAdjacencyMaps(activityIds, dependencies)
    forwardPass(order, nodeMap, predecessorsOf, new Date('2026-01-01'), [])
    return nodeMap
  }
  ```
  and:
  ```typescript
  // Temporary test-only exports, same lifecycle as runForwardPassForTest —
  // removed in Task 5 once runCpm supersedes them.
  export const buildNodeMapForTest = buildNodeMap
  export const topologicalSortForTest = topologicalSort
  export const buildAdjacencyMapsForTest = buildAdjacencyMaps
  export const forwardPassForTest = forwardPass
  ```

  Append to `lib/cpm.ts`:
  ```typescript
  function backwardPass(
    order: string[],
    nodeMap: Map<string, CpmNode>,
    successorsOf: Map<string, CpmDependency[]>,
    projectFinish: number
  ): void {
    const reverseOrder = [...order].reverse()
    for (const id of reverseOrder) {
      const node = nodeMap.get(id)!
      const succs = successorsOf.get(id) ?? []

      if (succs.length === 0) {
        node.latestFinish = projectFinish
        node.latestStart = node.latestFinish - node.duration
        continue
      }

      let lf = Infinity
      for (const dep of succs) {
        const succNode = nodeMap.get(dep.successorId)!
        if (dep.type === 'FS') {
          lf = Math.min(lf, succNode.latestStart - dep.lagDays)
        } else if (dep.type === 'SS') {
          lf = Math.min(lf, succNode.latestStart - dep.lagDays + node.duration)
        } else if (dep.type === 'FF') {
          lf = Math.min(lf, succNode.latestFinish - dep.lagDays)
        } else if (dep.type === 'SF') {
          lf = Math.min(lf, succNode.latestFinish - dep.lagDays + node.duration)
        }
      }
      node.latestFinish = lf
      node.latestStart = node.latestFinish - node.duration
    }
  }

  function buildCriticalPath(
    order: string[],
    nodeMap: Map<string, CpmNode>,
    dependencies: CpmDependency[]
  ): string[] {
    const criticalIds = new Set(order.filter((id) => nodeMap.get(id)!.isCritical))
    if (criticalIds.size === 0) return []

    const criticalEdges = new Map<string, string[]>()
    for (const id of criticalIds) criticalEdges.set(id, [])
    for (const dep of dependencies) {
      if (criticalIds.has(dep.predecessorId) && criticalIds.has(dep.successorId)) {
        criticalEdges.get(dep.predecessorId)!.push(dep.successorId)
      }
    }

    const hasIncoming = new Set<string>()
    for (const targets of criticalEdges.values()) {
      for (const t of targets) hasIncoming.add(t)
    }
    const startCandidates = order.filter((id) => criticalIds.has(id) && !hasIncoming.has(id))
    const start = startCandidates[0]
    if (!start) return [...criticalIds]

    const path: string[] = [start]
    let current = start
    const visited = new Set([start])
    while (true) {
      const nexts = (criticalEdges.get(current) ?? []).filter((n) => !visited.has(n))
      if (nexts.length === 0) break
      const next = nexts[0]
      path.push(next)
      visited.add(next)
      current = next
    }
    return path
  }

  /**
   * Run CPM for a full set of activities and dependencies in one location.
   * Pure — no DB access. See lib/cpm-runner.ts for the DB-aware wrapper.
   */
  export function runCpm(
    activities: CpmActivity[],
    dependencies: CpmDependency[],
    projectStart: Date,
    holidays: Date[]
  ): CpmResult {
    const activityIds = activities.map((a) => a.id)
    const { hasCycle, cycleIds } = detectCycle(activityIds, dependencies)
    if (hasCycle) {
      return { nodes: new Map(), criticalPath: [], hasCycle: true, cycleIds }
    }

    const nodeMap = buildNodeMap(activities)
    const order = topologicalSort(activityIds, dependencies)
    const { predecessorsOf, successorsOf } = buildAdjacencyMaps(activityIds, dependencies)

    forwardPass(order, nodeMap, predecessorsOf, projectStart, holidays)

    let projectFinish = 0
    for (const node of nodeMap.values()) {
      projectFinish = Math.max(projectFinish, node.earliestFinish)
    }

    backwardPass(order, nodeMap, successorsOf, projectFinish)

    for (const node of nodeMap.values()) {
      node.totalFloat = node.latestStart - node.earliestStart
      node.isCritical = node.totalFloat === 0
    }

    const criticalPath = buildCriticalPath(order, nodeMap, dependencies)

    return { nodes: nodeMap, criticalPath, hasCycle: false, cycleIds: [] }
  }
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npm test`
  Expected: all tests pass (the round-trip test from Task 4 still shows as skipped)

- [ ] **Step 5: Commit**

  ```bash
  git add lib/cpm.ts lib/cpm.test.ts
  git commit -m "feat: add CPM backward pass, float, critical path, and runCpm"
  ```

---

## Task 6: `lib/cpm.ts` — Performance Smoke Test

**Files:**
- Modify: `lib/cpm.test.ts`

**Interfaces:**
- Consumes: `runCpm` from Task 5

- [ ] **Step 1: Write the test**

  Append to `lib/cpm.test.ts`:
  ```typescript
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
  ```

- [ ] **Step 2: Run the test**

  Run: `npm test`
  Expected: passes — if it doesn't, do not "fix" it by relaxing the threshold; investigate the algorithm for an accidental non-linear pass (e.g. an O(n²) scan) before touching the test

- [ ] **Step 3: Commit**

  ```bash
  git add lib/cpm.test.ts
  git commit -m "test: add CPM performance smoke test (60 activities, 80 deps, <200ms)"
  ```

---

## Task 7: `lib/calendar.ts` — Relocate `computeDurasiHK` + Calendar Tests

**Files:**
- Modify: `lib/calendar.ts`
- Modify: `lib/activity-helpers.ts`
- Modify: `components/activities/ActivityRow.tsx`
- Create: `lib/calendar.test.ts`
- Modify: `lib/cpm.test.ts` (un-skip the round-trip test from Task 4)

**Interfaces:**
- Produces: `computeDurasiHK(mulai: string, selesai: string, holidays: Date[]): number` now lives in `lib/calendar.ts` (moved from `lib/activity-helpers.ts`)

- [ ] **Step 1: Write the failing tests**

  Create `lib/calendar.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import { addWorkingDays, workingDaysBetween, computeDurasiHK } from './calendar'

  describe('addWorkingDays', () => {
    it('adding 0 days returns the same date', () => {
      const start = new Date('2026-07-01')
      expect(addWorkingDays(start, 0, [])).toEqual(start)
    })

    it('skips weekends when adding forward', () => {
      const friday = new Date('2026-07-03') // Friday
      const result = addWorkingDays(friday, 1, [])
      expect(result.toISOString().slice(0, 10)).toBe('2026-07-06') // Monday
    })

    it('skips holidays when adding forward', () => {
      const start = new Date('2026-07-01') // Wednesday
      const holiday = new Date('2026-07-02') // Thursday, declared a holiday
      const result = addWorkingDays(start, 1, [holiday])
      expect(result.toISOString().slice(0, 10)).toBe('2026-07-03') // Friday, skipping the holiday
    })

    it('goes backward correctly with negative days', () => {
      const monday = new Date('2026-07-06')
      const result = addWorkingDays(monday, -1, [])
      expect(result.toISOString().slice(0, 10)).toBe('2026-07-03') // Friday
    })
  })

  describe('workingDaysBetween', () => {
    it('returns 0 when start >= end', () => {
      const date = new Date('2026-07-01')
      expect(workingDaysBetween(date, date, [])).toBe(0)
    })

    it('counts working days exclusive of start, inclusive of end', () => {
      const wed = new Date('2026-07-01')
      const nextTue = new Date('2026-07-07') // Thu, Fri, (weekend), Mon, Tue = 4 working days
      expect(workingDaysBetween(wed, nextTue, [])).toBe(4)
    })

    it('excludes holidays from the count', () => {
      const wed = new Date('2026-07-01')
      const nextTue = new Date('2026-07-07')
      const holiday = new Date('2026-07-03') // Friday
      expect(workingDaysBetween(wed, nextTue, [holiday])).toBe(3)
    })
  })

  describe('computeDurasiHK', () => {
    it('returns 1 for a single-day activity', () => {
      expect(computeDurasiHK('2026-07-01', '2026-07-01', [])).toBe(1)
    })

    it('returns 5 for a Wed-Tue span (skipping one weekend)', () => {
      expect(computeDurasiHK('2026-07-01', '2026-07-07', [])).toBe(5)
    })

    it('excludes holidays from the duration', () => {
      const holiday = new Date('2026-07-03') // Friday, inside the span
      expect(computeDurasiHK('2026-07-01', '2026-07-07', [holiday])).toBe(4)
    })
  })
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npm test`
  Expected: FAIL — `computeDurasiHK` is not exported from `lib/calendar.ts` yet

- [ ] **Step 3: Move `computeDurasiHK` into `lib/calendar.ts`**

  Change the top of `lib/calendar.ts` from:
  ```typescript
  import { addDays, isSameDay, isWeekend } from 'date-fns'
  ```
  to:
  ```typescript
  import { addDays, isSameDay, isWeekend, subDays } from 'date-fns'
  ```

  Append to the end of `lib/calendar.ts`:
  ```typescript

  /**
   * Inclusive working-day count from mulai to selesai. Mirrors the inverse of
   * lib/templates.ts's `addWorkingDays(mulai, durationWorkingDays - 1, holidays)`.
   */
  export function computeDurasiHK(mulai: string, selesai: string, holidays: Date[]): number {
    const start = subDays(new Date(mulai), 1)
    const end = new Date(selesai)
    return workingDaysBetween(start, end, holidays)
  }
  ```

- [ ] **Step 4: Remove `computeDurasiHK` from `lib/activity-helpers.ts`**

  Replace the full contents of `lib/activity-helpers.ts` with:
  ```typescript
  export function validateRencanaDates(mulai: string, selesai: string): string | null {
    if (selesai < mulai) return 'Tanggal selesai rencana harus setelah tanggal mulai rencana'
    return null
  }

  export function validateRealisasiDates(mulai: string | null, selesai: string | null): string | null {
    if (mulai && selesai && selesai < mulai) {
      return 'Tanggal selesai realisasi harus setelah tanggal mulai realisasi'
    }
    return null
  }
  ```

- [ ] **Step 5: Update the one call site — `components/activities/ActivityRow.tsx`**

  Find this import line:
  ```typescript
  import { computeDurasiHK, validateRencanaDates, validateRealisasiDates } from '@/lib/activity-helpers'
  ```
  Replace with:
  ```typescript
  import { computeDurasiHK } from '@/lib/calendar'
  import { validateRencanaDates, validateRealisasiDates } from '@/lib/activity-helpers'
  ```

- [ ] **Step 6: Un-skip the round-trip test in `lib/cpm.test.ts`**

  Find:
  ```typescript
    it.skip('round-trips with computeDurasiHK: a known mulai/selesai pair produces the same duration and reconstructs the same selesai', () => {
  ```
  Remove `.skip`:
  ```typescript
    it('round-trips with computeDurasiHK: a known mulai/selesai pair produces the same duration and reconstructs the same selesai', () => {
  ```

  Also fix the import at the top of that test's describe block — `computeDurasiHK` now comes from `@/lib/calendar`, which is already how it's imported (`lib/cpm.ts` itself imports from `'@/lib/calendar'`, and the test file's `import { computeDurasiHK } from '@/lib/calendar'` line added in Task 4 is already correct — no change needed there, just confirm it resolves now that the function actually exists at that path).

- [ ] **Step 7: Run all tests and the build**

  Run: `npm test`
  Expected: all tests pass, nothing skipped

  Run: `npm run build`
  Expected: succeeds (confirms `ActivityRow.tsx`'s updated imports compile)

- [ ] **Step 8: Commit**

  ```bash
  git add lib/calendar.ts lib/calendar.test.ts lib/activity-helpers.ts components/activities/ActivityRow.tsx lib/cpm.test.ts
  git commit -m "feat: relocate computeDurasiHK to lib/calendar.ts, add calendar tests"
  ```

---

## Task 8: `lib/cpm-runner.ts` — DB-Aware CPM Wrapper

**Files:**
- Create: `lib/cpm-runner.ts`

**Interfaces:**
- Consumes: `runCpm`, `cpmStartToDate`, `cpmFinishToDate`, `CpmActivity`, `CpmDependency` from `lib/cpm.ts`; `computeDurasiHK` from `lib/calendar.ts`; `insertAuditLog` from `lib/audit.ts`
- Produces:
  - `extractLocationId(phases: { location_id: string } | { location_id: string }[] | null): string | null`
  - `getActivityLocationId(supabase: SupabaseClient, activityId: string): Promise<string | null>`
  - `runCpmForLocation(supabase: SupabaseClient, locationId: string, actor: { id: string; email: string; full_name: string }): Promise<{ updatedActivities: Array<{ id: string; tanggal_mulai_rencana: string; tanggal_selesai_rencana: string; is_on_critical_path: boolean }>; criticalPath: string[]; hasCycle: boolean; cycleIds: string[] }>`
  - `runCpmForAllActiveLocations(supabase: SupabaseClient, actor: { id: string; email: string; full_name: string }): Promise<void>`

This task has no automated tests — it's DB-dependent (Supabase Cloud), consistent with every other DB-touching file in this project (Weeks 1-3 have no automated tests for API routes either). It's exercised in Task 13's manual curl pass.

- [ ] **Step 1: Create `lib/cpm-runner.ts`**

  ```typescript
  import { format } from 'date-fns'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import { runCpm, cpmStartToDate, cpmFinishToDate, type CpmActivity, type CpmDependency } from '@/lib/cpm'
  import { computeDurasiHK } from '@/lib/calendar'
  import { insertAuditLog } from '@/lib/audit'

  interface Actor {
    id: string
    email: string
    full_name: string
  }

  interface UpdatedActivity {
    id: string
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    is_on_critical_path: boolean
  }

  interface CpmRunResult {
    updatedActivities: UpdatedActivity[]
    criticalPath: string[]
    hasCycle: boolean
    cycleIds: string[]
  }

  type PhaseEmbed = { location_id: string } | { location_id: string }[] | null

  export function extractLocationId(phases: PhaseEmbed): string | null {
    if (!phases) return null
    return Array.isArray(phases) ? (phases[0]?.location_id ?? null) : phases.location_id
  }

  export async function getActivityLocationId(supabase: SupabaseClient, activityId: string): Promise<string | null> {
    const { data } = await supabase.from('activities').select('phases(location_id)').eq('id', activityId).single()
    if (!data) return null
    return extractLocationId(data.phases as PhaseEmbed)
  }

  export async function runCpmForLocation(
    supabase: SupabaseClient,
    locationId: string,
    actor: Actor
  ): Promise<CpmRunResult> {
    const empty: CpmRunResult = { updatedActivities: [], criticalPath: [], hasCycle: false, cycleIds: [] }

    const { data: location } = await supabase
      .from('locations')
      .select('project_start_date')
      .eq('id', locationId)
      .single()
    if (!location) return empty

    const { data: phases } = await supabase.from('phases').select('id').eq('location_id', locationId)
    const phaseIds = (phases ?? []).map((p: { id: string }) => p.id)
    if (phaseIds.length === 0) return empty

    const { data: activityRows } = await supabase
      .from('activities')
      .select('id, tanggal_mulai_rencana, tanggal_selesai_rencana, date_locked')
      .in('phase_id', phaseIds)
    const activities = (activityRows ?? []) as Array<{
      id: string
      tanggal_mulai_rencana: string
      tanggal_selesai_rencana: string
      date_locked: boolean
    }>
    if (activities.length === 0) return empty
    const activityIds = activities.map((a) => a.id)

    const { data: depRows } = await supabase
      .from('activity_dependencies')
      .select('predecessor_id, successor_id, dep_type, lag_days')
      .in('predecessor_id', activityIds)

    const { data: holidayRows } = await supabase.from('work_calendar').select('holiday_date')
    const holidays = (holidayRows ?? []).map((h: { holiday_date: string }) => new Date(h.holiday_date))

    const projectStart = new Date(location.project_start_date)

    const cpmActivities: CpmActivity[] = activities.map((a) => ({
      id: a.id,
      duration: computeDurasiHK(a.tanggal_mulai_rencana, a.tanggal_selesai_rencana, holidays),
      dateLocked: a.date_locked,
      lockedStartDate: a.date_locked ? new Date(a.tanggal_mulai_rencana) : null,
    }))

    const cpmDependencies: CpmDependency[] = (depRows ?? []).map(
      (d: { predecessor_id: string; successor_id: string; dep_type: 'FS' | 'SS' | 'FF' | 'SF'; lag_days: number }) => ({
        predecessorId: d.predecessor_id,
        successorId: d.successor_id,
        type: d.dep_type,
        lagDays: d.lag_days,
      })
    )

    const result = runCpm(cpmActivities, cpmDependencies, projectStart, holidays)

    if (result.hasCycle) {
      // hasCycle here means a cycle already exists in stored data — cycle
      // creation is gated upstream at POST /api/dependencies, so this is a
      // pre-existing inconsistency, not a rejection of the caller's own
      // request (which already succeeded before this ran). Log and move on.
      await insertAuditLog({
        userId: actor.id,
        userEmail: actor.email,
        userName: actor.full_name,
        action: 'RECALCULATE',
        entityType: 'locations',
        entityId: locationId,
        entityDescription: 'CPM recalculate gagal: siklus terdeteksi pada data dependensi yang sudah tersimpan',
      })
      return { updatedActivities: [], criticalPath: [], hasCycle: true, cycleIds: result.cycleIds }
    }

    const updateResults = await Promise.all(
      activities.map(async (activity) => {
        const node = result.nodes.get(activity.id)
        if (!node) return null

        const updates: Record<string, unknown> = {
          is_on_critical_path: node.isCritical,
          updated_by: actor.id,
          updated_at: new Date().toISOString(),
        }

        let mulai = activity.tanggal_mulai_rencana
        let selesai = activity.tanggal_selesai_rencana
        let shifted = false

        if (!activity.date_locked) {
          mulai = format(cpmStartToDate(node.earliestStart, projectStart, holidays), 'yyyy-MM-dd')
          selesai = format(cpmFinishToDate(node.earliestFinish, projectStart, holidays), 'yyyy-MM-dd')
          shifted = mulai !== activity.tanggal_mulai_rencana || selesai !== activity.tanggal_selesai_rencana
          updates.tanggal_mulai_rencana = mulai
          updates.tanggal_selesai_rencana = selesai
        }

        const { error } = await supabase.from('activities').update(updates).eq('id', activity.id)
        if (error) return null
        return { id: activity.id, tanggal_mulai_rencana: mulai, tanggal_selesai_rencana: selesai, is_on_critical_path: node.isCritical, shifted }
      })
    )

    const updatedActivities: UpdatedActivity[] = []
    let shiftedCount = 0
    for (const r of updateResults) {
      if (!r) continue
      updatedActivities.push({
        id: r.id,
        tanggal_mulai_rencana: r.tanggal_mulai_rencana,
        tanggal_selesai_rencana: r.tanggal_selesai_rencana,
        is_on_critical_path: r.is_on_critical_path,
      })
      if (r.shifted) shiftedCount++
    }

    await insertAuditLog({
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.full_name,
      action: 'RECALCULATE',
      entityType: 'locations',
      entityId: locationId,
      entityDescription: `CPM recalculate: ${shiftedCount} kegiatan disesuaikan, ${result.criticalPath.length} pada jalur kritis`,
    })

    return { updatedActivities, criticalPath: result.criticalPath, hasCycle: false, cycleIds: [] }
  }

  export async function runCpmForAllActiveLocations(supabase: SupabaseClient, actor: Actor): Promise<void> {
    const { data: locations } = await supabase.from('locations').select('id').eq('is_active', true)
    for (const location of (locations ?? []) as Array<{ id: string }>) {
      await runCpmForLocation(supabase, location.id, actor)
    }
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds. Also run `npm test` — expected unaffected (no new test files, all prior tests still pass).

- [ ] **Step 3: Commit**

  ```bash
  git add lib/cpm-runner.ts
  git commit -m "feat: add DB-aware runCpmForLocation wrapper"
  ```

---

## Task 9: Wire Activities Routes

**Files:**
- Modify: `app/api/activities/[id]/route.ts`
- Modify: `app/api/phases/[id]/activities/route.ts`

**Interfaces:**
- Consumes: `getActivityLocationId`, `extractLocationId`, `runCpmForLocation` from `lib/cpm-runner.ts` (Task 8)

- [ ] **Step 1: Wire `PATCH /api/activities/[id]`**

  Add the import at the top of `app/api/activities/[id]/route.ts`:
  ```typescript
  import { getActivityLocationId, runCpmForLocation } from '@/lib/cpm-runner'
  ```

  Replace:
  ```typescript
      // TODO Week 4: trigger CPM via runCpmForLocation(locationId) if dates changed
  ```
  with:
  ```typescript
      const datesChanged =
        parsed.data.tanggal_mulai_rencana !== undefined || parsed.data.tanggal_selesai_rencana !== undefined
      if (datesChanged) {
        const locationId = await getActivityLocationId(supabase, params.id)
        if (locationId) {
          await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
        }
      }
  ```

- [ ] **Step 2: Wire `DELETE /api/activities/[id]`**

  In the same file, change the `current` select in the `DELETE` handler from:
  ```typescript
      const { data: current } = await supabase
        .from('activities')
        .select('id, kegiatan, phase_id')
        .eq('id', params.id)
        .single()
      if (!current) return notFound()
  ```
  to:
  ```typescript
      const { data: current } = await supabase
        .from('activities')
        .select('id, kegiatan, phase_id, phases(location_id)')
        .eq('id', params.id)
        .single()
      if (!current) return notFound()
  ```

  Next, add the location extraction right before the `delete()` call — change:
  ```typescript
      const { error } = await supabase.from('activities').delete().eq('id', params.id)
      if (error) return serverError()
  ```
  to:
  ```typescript
      const locationId = extractLocationId(current.phases as { location_id: string } | { location_id: string }[] | null)

      const { error } = await supabase.from('activities').delete().eq('id', params.id)
      if (error) return serverError()
  ```

  Then replace:
  ```typescript
      // TODO Week 4: trigger CPM via runCpmForLocation(locationId)
  ```
  with:
  ```typescript
      if (locationId) {
        await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
      }
  ```

  Update the import line from Step 1 to also bring in `extractLocationId`:
  ```typescript
  import { extractLocationId, getActivityLocationId, runCpmForLocation } from '@/lib/cpm-runner'
  ```

- [ ] **Step 3: Wire `POST /api/phases/[id]/activities`**

  Add the import at the top of `app/api/phases/[id]/activities/route.ts`:
  ```typescript
  import { runCpmForLocation } from '@/lib/cpm-runner'
  ```

  Replace:
  ```typescript
      // TODO Week 4: trigger CPM via runCpmForLocation(locationId)
  ```
  with:
  ```typescript
      const { data: phase } = await supabase.from('phases').select('location_id').eq('id', params.id).single()
      if (phase) {
        await runCpmForLocation(supabase, phase.location_id, { id: user.id, email: profile.email, full_name: profile.full_name })
      }
  ```

- [ ] **Step 4: Verify build**

  Run: `npm run build`
  Expected: succeeds

  Run: `npm test`
  Expected: unaffected, all still pass

- [ ] **Step 5: Commit**

  ```bash
  git add app/api/activities/[id]/route.ts "app/api/phases/[id]/activities/route.ts"
  git commit -m "feat: trigger CPM recalculate from activity create/update/delete"
  ```

---

## Task 10: Wire Dependencies Routes (Cycle Pre-Check + Recalculate)

**Files:**
- Modify: `app/api/dependencies/route.ts`
- Modify: `app/api/dependencies/[id]/route.ts`

**Interfaces:**
- Consumes: `getActivityLocationId`, `runCpmForLocation` from `lib/cpm-runner.ts`; `detectCycle`, `type CpmDependency`, `type DepType` from `lib/cpm.ts`

- [ ] **Step 1: Wire `POST /api/dependencies` — same-location validation + cycle pre-check + recalculate**

  Add imports at the top of `app/api/dependencies/route.ts`:
  ```typescript
  import { getActivityLocationId, runCpmForLocation } from '@/lib/cpm-runner'
  import { detectCycle, type CpmDependency, type DepType } from '@/lib/cpm'
  ```

  Replace:
  ```typescript
      // TODO Week 4: detect cycles before insert using DFS on full dependency graph

      const { data: dep, error } = await supabase
        .from('activity_dependencies')
        .insert({ ...parsed.data, created_by: user.id })
        .select('id, predecessor_id, successor_id, dep_type, lag_days')
        .single()

      if (error) {
        const msg = error.message.includes('unique') ? 'Dependensi ini sudah ada' : 'Gagal membuat dependensi'
        return NextResponse.json({ data: null, error: { code: 'CREATE_ERROR', message: msg } }, { status: 400 })
      }

      // TODO Week 4: trigger CPM via runCpmForLocation(locationId)
  ```
  with:
  ```typescript
      const predecessorLocationId = await getActivityLocationId(supabase, parsed.data.predecessor_id)
      const successorLocationId = await getActivityLocationId(supabase, parsed.data.successor_id)
      if (!predecessorLocationId || !successorLocationId) {
        return NextResponse.json(
          { data: null, error: { code: 'VALIDATION_ERROR', message: 'Kegiatan predecessor atau successor tidak ditemukan' } },
          { status: 400 }
        )
      }
      if (predecessorLocationId !== successorLocationId) {
        return NextResponse.json(
          { data: null, error: { code: 'VALIDATION_ERROR', message: 'Predecessor dan successor harus berada di lokasi yang sama' } },
          { status: 400 }
        )
      }
      const locationId = predecessorLocationId

      const { data: phaseRows } = await supabase.from('phases').select('id').eq('location_id', locationId)
      const phaseIds = (phaseRows ?? []).map((p: { id: string }) => p.id)
      const { data: activityRows } = await supabase.from('activities').select('id').in('phase_id', phaseIds)
      const activityIds = (activityRows ?? []).map((a: { id: string }) => a.id)
      const { data: existingDepRows } = await supabase
        .from('activity_dependencies')
        .select('predecessor_id, successor_id, dep_type, lag_days')
        .in('predecessor_id', activityIds)

      const hypotheticalDeps: CpmDependency[] = [
        ...(existingDepRows ?? []).map((d: { predecessor_id: string; successor_id: string; dep_type: DepType; lag_days: number }) => ({
          predecessorId: d.predecessor_id,
          successorId: d.successor_id,
          type: d.dep_type,
          lagDays: d.lag_days,
        })),
        {
          predecessorId: parsed.data.predecessor_id,
          successorId: parsed.data.successor_id,
          type: parsed.data.dep_type,
          lagDays: parsed.data.lag_days,
        },
      ]
      const cycleCheck = detectCycle(activityIds, hypotheticalDeps)
      if (cycleCheck.hasCycle) {
        return NextResponse.json(
          {
            data: null,
            error: {
              code: 'CYCLE_DETECTED',
              message: 'Dependensi ini akan menciptakan siklus (circular dependency)',
              cycleIds: cycleCheck.cycleIds,
            },
          },
          { status: 422 }
        )
      }

      const { data: dep, error } = await supabase
        .from('activity_dependencies')
        .insert({ ...parsed.data, created_by: user.id })
        .select('id, predecessor_id, successor_id, dep_type, lag_days')
        .single()

      if (error) {
        const msg = error.message.includes('unique') ? 'Dependensi ini sudah ada' : 'Gagal membuat dependensi'
        return NextResponse.json({ data: null, error: { code: 'CREATE_ERROR', message: msg } }, { status: 400 })
      }

      await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
  ```

- [ ] **Step 2: Wire `PATCH /api/dependencies/[id]` and `DELETE /api/dependencies/[id]`**

  Add the import at the top of `app/api/dependencies/[id]/route.ts`:
  ```typescript
  import { getActivityLocationId, runCpmForLocation } from '@/lib/cpm-runner'
  ```

  In the `PATCH` handler, replace:
  ```typescript
      // TODO Week 4: trigger CPM via runCpmForLocation(locationId)
  ```
  with:
  ```typescript
      const locationId = await getActivityLocationId(supabase, current.predecessor_id)
      if (locationId) {
        await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
      }
  ```

  In the `DELETE` handler, replace:
  ```typescript
      // TODO Week 4: trigger CPM via runCpmForLocation(locationId)
  ```
  with:
  ```typescript
      const locationId = await getActivityLocationId(supabase, current.predecessor_id)
      if (locationId) {
        await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
      }
  ```

  (Both handlers already fetch `current` via `.select('*')` before this point, so `current.predecessor_id` is available in both.)

- [ ] **Step 3: Verify build**

  Run: `npm run build`
  Expected: succeeds

  Run: `npm test`
  Expected: unaffected, all still pass

- [ ] **Step 4: Commit**

  ```bash
  git add app/api/dependencies/route.ts "app/api/dependencies/[id]/route.ts"
  git commit -m "feat: gate dependency creation on cycle detection, trigger CPM on dependency changes"
  ```

---

## Task 11: Wire Manual Recalculate Endpoint

**Files:**
- Modify: `app/api/locations/[locationId]/recalculate/route.ts`

**Interfaces:**
- Consumes: `runCpmForLocation` from `lib/cpm-runner.ts`
- Produces: this endpoint's response shape changes from the Week 2 stub — `{ data: { updatedCount, criticalPath }, error: null }` on success (unchanged shape, now with real values), `422 CYCLE_DETECTED` on a pre-existing cycle

- [ ] **Step 1: Replace the stub**

  Replace the entire contents of `app/api/locations/[locationId]/recalculate/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
  import { runCpmForLocation } from '@/lib/cpm-runner'

  export async function POST(_request: NextRequest, { params }: { params: { locationId: string } }) {
    try {
      const { user, profile, supabase } = await getSession()
      if (!user || !profile) return unauthorized()
      if (!isAdmin(profile.role)) return forbidden()

      const result = await runCpmForLocation(supabase, params.locationId, {
        id: user.id,
        email: profile.email,
        full_name: profile.full_name,
      })

      if (result.hasCycle) {
        return NextResponse.json(
          {
            data: null,
            error: {
              code: 'CYCLE_DETECTED',
              message: 'Tidak dapat menghitung CPM: siklus terdeteksi pada data dependensi',
              cycleIds: result.cycleIds,
            },
          },
          { status: 422 }
        )
      }

      return NextResponse.json({
        data: { updatedCount: result.updatedActivities.length, criticalPath: result.criticalPath },
        error: null,
      })
    } catch {
      return serverError()
    }
  }
  ```

  Note: `insertAuditLog` is no longer imported or called directly in this file — `runCpmForLocation` already inserts one `RECALCULATE` audit entry with the real summary. The old stub's own audit call is removed to avoid double-logging.

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add "app/api/locations/[locationId]/recalculate/route.ts"
  git commit -m "feat: implement manual CPM recalculate endpoint, replacing the Week 2 stub"
  ```

---

## Task 12: Wire Work Calendar Routes (All Active Locations)

**Files:**
- Modify: `app/api/work-calendar/route.ts`
- Modify: `app/api/work-calendar/[id]/route.ts`

**Interfaces:**
- Consumes: `runCpmForAllActiveLocations` from `lib/cpm-runner.ts`

- [ ] **Step 1: Wire `POST /api/work-calendar`**

  Add the import at the top of `app/api/work-calendar/route.ts`:
  ```typescript
  import { runCpmForAllActiveLocations } from '@/lib/cpm-runner'
  ```

  Replace:
  ```typescript
      // TODO Week 4: trigger CPM recalculate for ALL active locations after calendar change
  ```
  with:
  ```typescript
      await runCpmForAllActiveLocations(supabase, { id: user.id, email: profile.email, full_name: profile.full_name })
  ```

- [ ] **Step 2: Wire `DELETE /api/work-calendar/[id]`**

  Add the import at the top of `app/api/work-calendar/[id]/route.ts`:
  ```typescript
  import { runCpmForAllActiveLocations } from '@/lib/cpm-runner'
  ```

  Replace:
  ```typescript
      // TODO Week 4: trigger CPM recalculate for ALL active locations after calendar change
  ```
  with:
  ```typescript
      await runCpmForAllActiveLocations(supabase, { id: user.id, email: profile.email, full_name: profile.full_name })
  ```

- [ ] **Step 3: Verify build**

  Run: `npm run build`
  Expected: succeeds

  Run: `npm test`
  Expected: unaffected, all still pass

- [ ] **Step 4: Commit**

  ```bash
  git add app/api/work-calendar/route.ts "app/api/work-calendar/[id]/route.ts"
  git commit -m "feat: trigger CPM recalculate for all active locations on holiday changes"
  ```

---

## Task 13: Manual curl-Based E2E Verification

**Files:** none (verification only)

Following the same approach that caught a real routing bug in Week 3: drive the running app with authenticated `curl` rather than relying on diff review alone.

- [ ] **Step 1: Start the app**

  ```bash
  npm run dev
  ```
  (no `supabase start` needed — `.env.local` points at Supabase Cloud)

- [ ] **Step 2: Log in and capture a session cookie**

  ```bash
  curl -s -c /tmp/cpm-cookies.txt -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@perumnas.co.id","password":"Admin123!"}'
  ```
  Expected: `200`, profile with `"role":"admin"`.

- [ ] **Step 3: Create a fresh test location** (isolates this week's testing from any existing data)

  ```bash
  curl -s -b /tmp/cpm-cookies.txt -X POST http://localhost:3000/api/locations \
    -H "Content-Type: application/json" \
    -d '{"name":"CPM Test","code":"CPMTEST","project_start_date":"2026-07-01"}'
  ```
  Expected: `201`, note the returned `id` as `LOCATION_ID`.

- [ ] **Step 4: Fetch two activities to test dependencies on**

  ```bash
  curl -s -b /tmp/cpm-cookies.txt "http://localhost:3000/api/locations/LOCATION_ID/phases"
  ```
  Note the F1 phase's first two activity IDs as `ACT_A` and `ACT_B`, and their original `tanggal_mulai_rencana`/`tanggal_selesai_rencana`.

- [ ] **Step 5: Create an FS dependency between them and confirm the successor's dates shift**

  ```bash
  curl -s -b /tmp/cpm-cookies.txt -X POST http://localhost:3000/api/dependencies \
    -H "Content-Type: application/json" \
    -d '{"predecessor_id":"ACT_A","successor_id":"ACT_B","dep_type":"FS","lag_days":0}'
  ```
  Expected: `201`. Then re-fetch phases (Step 4's command) and confirm `ACT_B`'s `tanggal_mulai_rencana` now equals `ACT_A`'s `tanggal_selesai_rencana` (or later, working-day-adjusted) — the FS constraint took effect.

- [ ] **Step 6: Attempt to create a cycle and confirm it's rejected**

  ```bash
  curl -s -b /tmp/cpm-cookies.txt -X POST http://localhost:3000/api/dependencies \
    -H "Content-Type: application/json" \
    -d '{"predecessor_id":"ACT_B","successor_id":"ACT_A","dep_type":"FS","lag_days":0}'
  ```
  Expected: `422`, `error.code == "CYCLE_DETECTED"`, `error.cycleIds` containing both `ACT_A` and `ACT_B`. Confirm via Step 4's re-fetch that no second dependency was actually created.

- [ ] **Step 7: Edit an activity's dates directly and confirm the successor recalculates**

  ```bash
  curl -s -b /tmp/cpm-cookies.txt -X PATCH "http://localhost:3000/api/activities/ACT_A" \
    -H "Content-Type: application/json" \
    -d '{"tanggal_mulai_rencana":"2026-07-15","tanggal_selesai_rencana":"2026-07-20"}'
  ```
  Expected: `200`. Re-fetch phases and confirm `ACT_B` (the FS successor) shifted to start on/after `2026-07-20`.

- [ ] **Step 8: Lock an activity and confirm it stops shifting**

  ```bash
  curl -s -b /tmp/cpm-cookies.txt -X PATCH "http://localhost:3000/api/activities/ACT_B/lock"
  ```
  Then repeat Step 7 with a different date range for `ACT_A`. Re-fetch phases and confirm `ACT_B`'s dates did NOT change this time (still locked to its prior value), while `ACT_B.is_on_critical_path` may still have updated.

- [ ] **Step 9: Test the manual recalculate endpoint**

  ```bash
  curl -s -b /tmp/cpm-cookies.txt -X POST "http://localhost:3000/api/locations/LOCATION_ID/recalculate"
  ```
  Expected: `200`, `data.updatedCount` and `data.criticalPath` populated with real values (not the old stub's `0`/`[]`).

- [ ] **Step 10: Test a work-calendar change cascades**

  ```bash
  curl -s -b /tmp/cpm-cookies.txt -X POST http://localhost:3000/api/work-calendar \
    -H "Content-Type: application/json" \
    -d '{"holiday_date":"2026-07-16","name":"Test Holiday"}'
  ```
  Expected: `201`. Re-fetch phases for `LOCATION_ID` and confirm at least one unlocked activity's dates shifted to account for the new holiday (if `2026-07-16` fell within any unlocked activity's working-day span). Delete the test holiday afterward:
  ```bash
  curl -s -b /tmp/cpm-cookies.txt -X DELETE "http://localhost:3000/api/work-calendar/HOLIDAY_ID"
  ```

- [ ] **Step 11: Confirm `DELETE` still enforces `HAS_SUCCESSORS` and now also triggers CPM**

  ```bash
  curl -s -b /tmp/cpm-cookies.txt -X DELETE "http://localhost:3000/api/activities/ACT_A"
  ```
  Expected: `409 HAS_SUCCESSORS` (since the FS dependency to `ACT_B` still exists — this is pre-existing Week 2/3 behavior, confirms it still works after this week's changes touched the same file).

- [ ] **Step 12: Update the SDD progress ledger**

  Append to `.superpowers/sdd/progress.md`:
  ```markdown

  ## Week 4
  # Plan: docs/superpowers/plans/2026-07-02-minggu4-cpm-engine.md
  ```
  (task-by-task COMPLETE lines get appended here during execution, matching the Week 1-3 format)

- [ ] **Step 13: Final commit**

  ```bash
  git add .superpowers/sdd/progress.md
  git commit -m "chore: Week 4 CPM engine curl-verified — cycle detection, forward/backward pass, locked dates, manual recalculate, work-calendar cascade all confirmed live"
  ```
