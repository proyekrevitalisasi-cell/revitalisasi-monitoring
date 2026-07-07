# Minggu 14 — QA & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the concrete QA/tech-debt backlog flagged by reviewers across Weeks 4-13 — DB/security hygiene, two untested core-logic files, three duplicated-label/date sites, one save-revert parity gap, two accessibility gaps, and two measure-first PRD performance risks — with zero new features and zero schema changes beyond an already-written migration.

**Architecture:** No new subsystems. Every task either (a) extracts existing inline logic into a new `lib/*.ts` pure-function file with Vitest coverage, (b) fixes one named, already-reproduced bug in an existing component, or (c) runs a read-only/cleanup verification pass against the live Supabase Cloud project via curl. Tasks are independent of each other except Task 4 depends on nothing but touches the same file area as Task 6/7 only in the sense of both editing dashboard-adjacent code — there is no ordering dependency between any two tasks; they can be done in any order, but the numbering below is a sensible one.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest, curl (+ Node one-liners for JSON extraction, no `jq`/`ts-node` available in this environment), Supabase Cloud (no local Docker).

## Global Constraints

- No new npm packages. No new API routes. No schema/migration changes beyond the already-written `supabase/migrations/005_fix_profiles_update_rls.sql`.
- Vitest only picks up `lib/**/*.test.ts` (see `vitest.config.ts`) — any new pure-logic test file must live under `lib/`, not `components/`.
- Seeded credentials (already used by every prior week's manual verification): `superadmin@perumnas.co.id` / `SuperAdmin123!`, `admin@perumnas.co.id` / `Admin123!`, `viewer@perumnas.co.id` / `Viewer123!`.
- Dev server assumed running at `http://localhost:3000` (`npm run dev`) for every curl-based task.
- Any scratch file created for verification (cookie jars, throwaway JSON dumps) is **not committed** — matches every prior week's precedent (`task-N-*.js` scripts were never checked in).
- Every code-touching task ends with `npm test` passing and a commit. Verification-only tasks (1, 2, 11, 12) touch no tracked files and end with a documented observation instead of a commit.
- `npm run build` and `npm run lint` must stay clean at the end of the whole plan (same bar as every prior week).

---

### Task 1: Migration 005 — verify and hand off

**Files:**
- Read only: `supabase/migrations/005_fix_profiles_update_rls.sql`, `supabase/migrations/002_rls_policies.sql`

**Interfaces:** None — this task produces no code artifact other tasks depend on.

- [ ] **Step 1: Confirm the migration still matches the live policy it replaces**

Open both files and confirm: `005`'s `DROP POLICY IF EXISTS "profiles_update"` + `CREATE POLICY "profiles_update"` block is the only policy touched, and its `USING`/`WITH CHECK` bodies (`get_my_role() = 'super_admin' OR (get_my_role() = 'admin' AND role = 'viewer')`) are byte-identical to each other, mirroring every other writable-table policy's explicit-USING-and-WITH-CHECK convention in `002_rls_policies.sql`. No other policy in `002` should need the same fix (grep `002_rls_policies.sql` for `FOR UPDATE` blocks and confirm every other one already has both clauses).

- [ ] **Step 2: Hand off to the user**

This migration is defense-in-depth only — `app/api/users/[id]/route.ts` already bypasses the broken RLS via `createAdminClient()`, so nothing is functionally blocked. State clearly to the user: "Migration 005 verified consistent, ready to run. Apply via Supabase Dashboard → SQL Editor when convenient (same as migrations 003/004)." Do not attempt to apply it via any automated tool — this project has no `supabase link` to the live cloud project in this environment, and it is a security-relevant change to a shared database.

No commit — no tracked file changes in this task.

---

### Task 2: Deactivate leftover test locations

**Files:** None created/modified — uses the existing `DELETE /api/locations/{id}` route (`app/api/locations/[locationId]/route.ts`, already soft-deletes via `is_active = false`).

**Interfaces:** None.

- [ ] **Step 1: Log in as super_admin and save the session cookie**

```bash
curl -s -c /tmp/w14-cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@perumnas.co.id","password":"SuperAdmin123!"}'
```

Expected: JSON body with `"error":null`.

- [ ] **Step 2: Find the ids of the 5 leftover locations**

```bash
curl -s -b /tmp/w14-cookies.txt http://localhost:3000/api/locations > /tmp/w14-locations.json
node -pe "
const rows = JSON.parse(require('fs').readFileSync('/tmp/w14-locations.json','utf8')).data;
const targets = ['CPMTEST','T5DEP','T11FIXA','T11FIXB','TEST'];
JSON.stringify(rows.filter(r => targets.includes(r.code)).map(r => ({code:r.code, id:r.id})))
"
```

Expected: a JSON array of `{code, id}` pairs — could be fewer than 5 entries if some were already cleaned up manually; that's fine.

- [ ] **Step 3: Deactivate each one found**

For each `id` printed in Step 2:

```bash
curl -s -b /tmp/w14-cookies.txt -X DELETE "http://localhost:3000/api/locations/<id>"
```

Expected per call: `{"data":{...},"error":null}`.

- [ ] **Step 4: Verify via a final sweep**

```bash
curl -s -b /tmp/w14-cookies.txt http://localhost:3000/api/locations | node -pe "
JSON.parse(require('fs').readFileSync(0,'utf8')).data.map(r => r.code)
"
```

Expected: none of `CPMTEST`, `T5DEP`, `T11FIXA`, `T11FIXB`, `TEST` appear in the printed list (the route already filters `is_active = true`, so a deactivated location simply disappears).

No commit — no tracked file changes in this task.

---

### Task 3: Extract `computeActivityCpmUpdate` from `lib/cpm-runner.ts` + Vitest coverage

**Files:**
- Modify: `lib/cpm-runner.ts`
- Create: `lib/cpm-runner.test.ts`

**Interfaces:**
- Produces: `computeActivityCpmUpdate(activity: CpmUpdateInput, node: CpmNode, projectStart: Date, holidays: Date[]): CpmUpdateResult`, where:
  ```ts
  export interface CpmUpdateInput {
    id: string
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    date_locked: boolean
    is_on_critical_path: boolean
    total_float_days: number
  }
  export interface CpmUpdateResult {
    updates: Record<string, unknown>
    mulai: string
    selesai: string
    shifted: boolean
    changed: boolean
  }
  ```
  `updates` never contains `updated_at`/`updated_by` — the caller (`runCpmForLocation`) adds those two keys itself only when `changed` is true, exactly as today.

- [ ] **Step 1: Write the failing tests**

Create `lib/cpm-runner.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeActivityCpmUpdate, type CpmUpdateInput } from './cpm-runner'
import type { CpmNode } from './cpm'

const projectStart = new Date('2026-07-01')
const holidays: Date[] = []

function makeActivity(overrides: Partial<CpmUpdateInput> = {}): CpmUpdateInput {
  return {
    id: 'a1',
    tanggal_mulai_rencana: '2026-07-01',
    tanggal_selesai_rencana: '2026-07-03',
    date_locked: false,
    is_on_critical_path: false,
    total_float_days: 0,
    ...overrides,
  }
}

function makeNode(overrides: Partial<CpmNode> = {}): CpmNode {
  return {
    id: 'a1',
    duration: 2,
    dateLocked: false,
    lockedStartDate: null,
    earliestStart: 0,
    earliestFinish: 2,
    latestStart: 0,
    latestFinish: 2,
    totalFloat: 0,
    isCritical: false,
    ...overrides,
  }
}

describe('computeActivityCpmUpdate', () => {
  it('marks changed=true and includes new dates when an unlocked activity shifts', () => {
    const activity = makeActivity({ tanggal_mulai_rencana: '2026-07-05', tanggal_selesai_rencana: '2026-07-07' })
    const node = makeNode({ earliestStart: 0, earliestFinish: 2 })
    const result = computeActivityCpmUpdate(activity, node, projectStart, holidays)
    expect(result.shifted).toBe(true)
    expect(result.changed).toBe(true)
    expect(result.mulai).toBe('2026-07-01')
    expect(result.updates.tanggal_mulai_rencana).toBe('2026-07-01')
  })

  it('marks changed=false and omits updated_at/updated_by-relevant fields when nothing about the activity changed', () => {
    const activity = makeActivity({ is_on_critical_path: false, total_float_days: 0 })
    const node = makeNode({ earliestStart: 0, earliestFinish: 2, isCritical: false, totalFloat: 0 })
    const result = computeActivityCpmUpdate(activity, node, projectStart, holidays)
    expect(result.shifted).toBe(false)
    expect(result.changed).toBe(false)
    expect(result.updates).not.toHaveProperty('updated_at')
    expect(result.updates).not.toHaveProperty('updated_by')
  })

  it('marks changed=true on a critical-path flip alone, with no date shift', () => {
    const activity = makeActivity({ date_locked: true, is_on_critical_path: false, total_float_days: 0 })
    const node = makeNode({ isCritical: true, totalFloat: 0 })
    const result = computeActivityCpmUpdate(activity, node, projectStart, holidays)
    expect(result.shifted).toBe(false)
    expect(result.changed).toBe(true)
    expect(result.updates).not.toHaveProperty('tanggal_mulai_rencana')
  })

  it('never includes date fields in updates when the activity is date_locked', () => {
    const activity = makeActivity({ date_locked: true })
    const node = makeNode({ earliestStart: 5, earliestFinish: 7 })
    const result = computeActivityCpmUpdate(activity, node, projectStart, holidays)
    expect(result.updates).not.toHaveProperty('tanggal_mulai_rencana')
    expect(result.updates).not.toHaveProperty('tanggal_selesai_rencana')
    expect(result.updates.is_on_critical_path).toBe(false)
    expect(result.updates.total_float_days).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- cpm-runner.test.ts`
Expected: FAIL — `computeActivityCpmUpdate` is not exported from `./cpm-runner`.

- [ ] **Step 3: Extract the function in `lib/cpm-runner.ts`**

At the top of `lib/cpm-runner.ts`, change the import line to also pull in `CpmNode`:

```ts
import { runCpm, cpmStartToDate, cpmFinishToDate, type CpmActivity, type CpmDependency, type CpmNode } from '@/lib/cpm'
```

Add the new exported types and function (place after the `UpdatedActivity`/`CpmRunResult` interfaces, before `extractLocationId`):

```ts
export interface CpmUpdateInput {
  id: string
  tanggal_mulai_rencana: string
  tanggal_selesai_rencana: string
  date_locked: boolean
  is_on_critical_path: boolean
  total_float_days: number
}

export interface CpmUpdateResult {
  updates: Record<string, unknown>
  mulai: string
  selesai: string
  shifted: boolean
  changed: boolean
}

export function computeActivityCpmUpdate(
  activity: CpmUpdateInput,
  node: CpmNode,
  projectStart: Date,
  holidays: Date[]
): CpmUpdateResult {
  let mulai = activity.tanggal_mulai_rencana
  let selesai = activity.tanggal_selesai_rencana
  let shifted = false

  if (!activity.date_locked) {
    mulai = format(cpmStartToDate(node.earliestStart, projectStart, holidays), 'yyyy-MM-dd')
    selesai = format(cpmFinishToDate(node.earliestFinish, projectStart, holidays), 'yyyy-MM-dd')
    shifted = mulai !== activity.tanggal_mulai_rencana || selesai !== activity.tanggal_selesai_rencana
  }

  const updates: Record<string, unknown> = {
    is_on_critical_path: node.isCritical,
    total_float_days: node.totalFloat,
  }
  if (!activity.date_locked) {
    updates.tanggal_mulai_rencana = mulai
    updates.tanggal_selesai_rencana = selesai
  }

  const changed =
    shifted ||
    activity.is_on_critical_path !== node.isCritical ||
    activity.total_float_days !== node.totalFloat

  return { updates, mulai, selesai, shifted, changed }
}
```

Now replace the body of the `activities.map(async (activity) => { ... })` block inside `runCpmForLocation` (currently computing `mulai`/`selesai`/`shifted`/`updates`/`changed` inline) with a call to the extracted function:

```ts
  const updateResults = await Promise.all(
    activities.map(async (activity) => {
      const node = result.nodes.get(activity.id)
      if (!node) return null

      const { updates, mulai, selesai, shifted, changed } = computeActivityCpmUpdate(
        activity,
        node,
        projectStart,
        holidays
      )
      if (changed) {
        updates.updated_by = actor.id
        updates.updated_at = new Date().toISOString()
      }

      const { error } = await supabase.from('activities').update(updates).eq('id', activity.id)
      if (error) return null
      return { id: activity.id, tanggal_mulai_rencana: mulai, tanggal_selesai_rencana: selesai, is_on_critical_path: node.isCritical, shifted }
    })
  )
```

Delete the old inline `let mulai/selesai/shifted`, the old `updates` object construction, and the old `changed` computation (with its comment) that this replaces — the comment explaining the "changed" gating rationale can move to sit above the new `computeActivityCpmUpdate` function instead, so the reasoning isn't lost:

```ts
// Only bump updated_at/updated_by when this activity's CPM-derived state
// actually changed. Every holiday/dependency/activity edit anywhere re-runs
// CPM for the WHOLE location, which previously stamped updated_at on every
// activity unconditionally -- including already-`selesai` ones nothing
// happened to. Weekly Summary's "Selesai Minggu Ini" panel reads updated_at
// as "completed this week," so an unrelated admin action could silently
// make long-completed activities elsewhere look freshly done. `changed`
// here is what the caller (runCpmForLocation) checks before stamping.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- cpm-runner.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Run the full suite and build**

Run: `npm test` — expect all tests passing (83 existing + 4 new = 87).
Run: `npm run build` — expect clean.

- [ ] **Step 6: Commit**

```bash
git add lib/cpm-runner.ts lib/cpm-runner.test.ts
git commit -m "test: extract computeActivityCpmUpdate from cpm-runner and add Vitest coverage"
```

---

### Task 4: Extract `lib/raci-utils.ts` from `RaciClient.tsx` + Vitest coverage

**Files:**
- Create: `lib/raci-utils.ts`
- Create: `lib/raci-utils.test.ts`
- Modify: `components/raci/RaciClient.tsx`

**Interfaces:**
- Produces:
  - `applyRaciCellChange(locations: RaciLocation[], phaseId: string, stakeholderId: string, role: RaciRole | null): RaciLocation[]`
  - `swapStakeholderOrder(stakeholders: Stakeholder[], stakeholderId: string, direction: 'up' | 'down'): { stakeholders: Stakeholder[]; swapped: [Stakeholder, Stakeholder] } | null` (returns `null` at a top/bottom boundary or unknown id — a genuine no-op)

- [ ] **Step 1: Write the failing tests**

Create `lib/raci-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyRaciCellChange, swapStakeholderOrder } from './raci-utils'
import type { RaciLocation, Stakeholder } from './types'

function makeLocations(): RaciLocation[] {
  return [
    {
      id: 'loc1', code: 'TA', name: 'Tebet A',
      phases: [
        { id: 'p1', phase_code: 'F1', name: 'Fase 1', display_order: 1, raci_entries: [{ stakeholder_id: 's1', role: 'R' }] },
        { id: 'p2', phase_code: 'F2', name: 'Fase 2', display_order: 2, raci_entries: [] },
      ],
    },
  ]
}

describe('applyRaciCellChange', () => {
  it('adds a new entry to an empty cell', () => {
    const result = applyRaciCellChange(makeLocations(), 'p2', 's2', 'A')
    expect(result[0].phases[1].raci_entries).toEqual([{ stakeholder_id: 's2', role: 'A' }])
  })

  it('replaces an existing entry for the same stakeholder', () => {
    const result = applyRaciCellChange(makeLocations(), 'p1', 's1', 'C')
    expect(result[0].phases[0].raci_entries).toEqual([{ stakeholder_id: 's1', role: 'C' }])
  })

  it('clears an entry when role is null', () => {
    const result = applyRaciCellChange(makeLocations(), 'p1', 's1', null)
    expect(result[0].phases[0].raci_entries).toEqual([])
  })

  it('does not touch a different phase', () => {
    const result = applyRaciCellChange(makeLocations(), 'p2', 's2', 'A')
    expect(result[0].phases[0].raci_entries).toEqual([{ stakeholder_id: 's1', role: 'R' }])
  })
})

function makeStakeholders(): Stakeholder[] {
  return [
    { id: 's1', code: 'A', name: 'Alpha', group_name: 'Internal', display_order: 1 },
    { id: 's2', code: 'B', name: 'Bravo', group_name: 'Internal', display_order: 2 },
    { id: 's3', code: 'C', name: 'Charlie', group_name: 'Internal', display_order: 3 },
  ]
}

describe('swapStakeholderOrder', () => {
  it('swaps a middle row up', () => {
    const result = swapStakeholderOrder(makeStakeholders(), 's2', 'up')
    expect(result).not.toBeNull()
    expect(result!.stakeholders.map((s) => s.id)).toEqual(['s2', 's1', 's3'])
    expect(result!.stakeholders.find((s) => s.id === 's2')!.display_order).toBe(1)
    expect(result!.stakeholders.find((s) => s.id === 's1')!.display_order).toBe(2)
  })

  it('swaps a middle row down', () => {
    const result = swapStakeholderOrder(makeStakeholders(), 's2', 'down')
    expect(result!.stakeholders.map((s) => s.id)).toEqual(['s1', 's3', 's2'])
  })

  it('returns null at the top boundary', () => {
    expect(swapStakeholderOrder(makeStakeholders(), 's1', 'up')).toBeNull()
  })

  it('returns null at the bottom boundary', () => {
    expect(swapStakeholderOrder(makeStakeholders(), 's3', 'down')).toBeNull()
  })

  it('returns null for an unknown stakeholder id', () => {
    expect(swapStakeholderOrder(makeStakeholders(), 'unknown', 'up')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- raci-utils.test.ts`
Expected: FAIL — cannot find module `./raci-utils`.

- [ ] **Step 3: Create `lib/raci-utils.ts`**

```ts
import type { RaciLocation, RaciRole, Stakeholder } from './types'

export function applyRaciCellChange(
  locations: RaciLocation[],
  phaseId: string,
  stakeholderId: string,
  role: RaciRole | null
): RaciLocation[] {
  return locations.map((loc) => ({
    ...loc,
    phases: loc.phases.map((phase) => {
      if (phase.id !== phaseId) return phase
      const withoutEntry = phase.raci_entries.filter((e) => e.stakeholder_id !== stakeholderId)
      return {
        ...phase,
        raci_entries: role ? [...withoutEntry, { stakeholder_id: stakeholderId, role }] : withoutEntry,
      }
    }),
  }))
}

export interface StakeholderSwapResult {
  stakeholders: Stakeholder[]
  swapped: [Stakeholder, Stakeholder]
}

export function swapStakeholderOrder(
  stakeholders: Stakeholder[],
  stakeholderId: string,
  direction: 'up' | 'down'
): StakeholderSwapResult | null {
  const index = stakeholders.findIndex((s) => s.id === stakeholderId)
  const neighborIndex = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || neighborIndex < 0 || neighborIndex >= stakeholders.length) return null

  const current = stakeholders[index]
  const neighbor = stakeholders[neighborIndex]
  const swappedCurrent = { ...current, display_order: neighbor.display_order }
  const swappedNeighbor = { ...neighbor, display_order: current.display_order }

  const result = [...stakeholders]
  result[index] = swappedNeighbor
  result[neighborIndex] = swappedCurrent
  result.sort((a, b) => a.display_order - b.display_order)

  return { stakeholders: result, swapped: [swappedCurrent, swappedNeighbor] }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- raci-utils.test.ts`
Expected: PASS, 9/9.

- [ ] **Step 5: Wire `RaciClient.tsx` to use the extracted functions**

In `components/raci/RaciClient.tsx`, add the import:

```ts
import { applyRaciCellChange, swapStakeholderOrder } from '@/lib/raci-utils'
```

Replace `handleCellChanged`:

```ts
function handleCellChanged(phaseId: string, stakeholderId: string, role: RaciRole | null) {
  setLocationsState((prev) => applyRaciCellChange(prev, phaseId, stakeholderId, role))
}
```

Replace `handleReorder`:

```ts
async function handleReorder(stakeholderId: string, direction: 'up' | 'down') {
  const previous = stakeholders
  const result = swapStakeholderOrder(stakeholders, stakeholderId, direction)
  if (!result) return
  setStakeholders(result.stakeholders)

  const [swappedCurrent, swappedNeighbor] = result.swapped
  try {
    const [res1, res2] = await Promise.all([
      fetch(`/api/stakeholders/${swappedCurrent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: swappedCurrent.display_order }),
      }),
      fetch(`/api/stakeholders/${swappedNeighbor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: swappedNeighbor.display_order }),
      }),
    ])
    const [json1, json2] = await Promise.all([res1.json(), res2.json()])
    if (!res1.ok || json1.error || !res2.ok || json2.error) {
      throw new Error(json1.error?.message ?? json2.error?.message ?? 'Gagal menukar urutan')
    }
  } catch (err) {
    setStakeholders(previous)
    toast.error(err instanceof Error ? err.message : 'Gagal menukar urutan')
  }
}
```

This is behaviorally identical to the original: `swappedCurrent.display_order` equals the neighbor's old order and `swappedNeighbor.display_order` equals the current row's old order, same as the inline swap did.

- [ ] **Step 6: Run the full suite and build**

Run: `npm test` — expect all passing (87 + 9 = 96).
Run: `npm run build` — expect clean.

- [ ] **Step 7: Commit**

```bash
git add lib/raci-utils.ts lib/raci-utils.test.ts components/raci/RaciClient.tsx
git commit -m "test: extract RaciClient's reorder/cell-change logic into lib/raci-utils.ts"
```

---

### Task 5: Extract `lib/risk-labels.ts`

**Files:**
- Create: `lib/risk-labels.ts`
- Modify: `components/risks/RiskFormModal.tsx`
- Modify: `components/risks/RiskTable.tsx`
- Modify: `components/risks/RiskRegisterClient.tsx`

**Interfaces:**
- Produces: `RISK_CATEGORY_OPTIONS`, `RISK_STATUS_OPTIONS` (each `Array<{ value; label }>`), `RISK_CATEGORY_LABELS`, `RISK_STATUS_LABELS` (each `Record<value, label>`), all from `lib/risk-labels.ts`.

- [ ] **Step 1: Create `lib/risk-labels.ts`**

```ts
import type { RiskCategory, RiskStatus } from '@/lib/types'

export const RISK_CATEGORY_OPTIONS: Array<{ value: RiskCategory; label: string }> = [
  { value: 'teknis', label: 'Teknis' },
  { value: 'hukum', label: 'Hukum' },
  { value: 'keuangan', label: 'Keuangan' },
  { value: 'sosial', label: 'Sosial' },
  { value: 'lingkungan', label: 'Lingkungan' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const RISK_STATUS_OPTIONS: Array<{ value: RiskStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'closed', label: 'Closed' },
]

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = Object.fromEntries(
  RISK_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<RiskCategory, string>

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = Object.fromEntries(
  RISK_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<RiskStatus, string>
```

No dedicated test file — this is static data with no branching logic, matching the accepted precedent of `getScoreBandClasses` in `lib/risk-utils.ts` having no direct test either.

- [ ] **Step 2: Consume in `RiskFormModal.tsx`**

Replace the import block to add:

```ts
import { RISK_CATEGORY_OPTIONS, RISK_STATUS_OPTIONS } from '@/lib/risk-labels'
```

Delete the local `const CATEGORIES: Array<...> = [...]` and `const STATUSES: Array<...> = [...]` declarations. Replace every `CATEGORIES.map(...)` with `RISK_CATEGORY_OPTIONS.map(...)` and every `STATUSES.map(...)` with `RISK_STATUS_OPTIONS.map(...)` (one occurrence each, inside the Kategori and Status `<Select>` blocks).

- [ ] **Step 3: Consume in `RiskTable.tsx`**

Replace the import block to add:

```ts
import { RISK_CATEGORY_LABELS, RISK_STATUS_LABELS } from '@/lib/risk-labels'
```

Delete the local `const CATEGORY_LABELS: Record<...> = {...}` and `const STATUS_LABELS: Record<...> = {...}` declarations. Replace `CATEGORY_LABELS[risk.category]` with `RISK_CATEGORY_LABELS[risk.category]` and `STATUS_LABELS[risk.status]` with `RISK_STATUS_LABELS[risk.status]`.

- [ ] **Step 4: Consume in `RiskRegisterClient.tsx`**

Replace the import block to add:

```ts
import { RISK_CATEGORY_OPTIONS, RISK_STATUS_OPTIONS } from '@/lib/risk-labels'
```

Delete the local `const CATEGORY_OPTIONS` and `const STATUS_OPTIONS` declarations. Replace `CATEGORY_OPTIONS.map(...)` with `RISK_CATEGORY_OPTIONS.map(...)` and `STATUS_OPTIONS.map(...)` with `RISK_STATUS_OPTIONS.map(...)`.

- [ ] **Step 5: Run the full suite, build, and lint**

Run: `npm test` — expect unchanged (96/96, no new tests this task).
Run: `npm run build` — expect clean.
Run: `npm run lint` — expect clean (confirms no unused imports left behind from the deleted local consts).

- [ ] **Step 6: Commit**

```bash
git add lib/risk-labels.ts components/risks/RiskFormModal.tsx components/risks/RiskTable.tsx components/risks/RiskRegisterClient.tsx
git commit -m "refactor: extract lib/risk-labels.ts to de-duplicate risk category/status option lists"
```

---

### Task 6: `buildActivityIssueRows` dedup + `isNeedsAttention` intent comment

**Files:**
- Modify: `lib/dashboard-metrics.ts`
- Modify: `lib/dashboard-metrics.test.ts`
- Modify: `app/(app)/page.tsx`
- Modify: `app/(app)/dashboard/[locationCode]/page.tsx`

**Interfaces:**
- Produces: `buildActivityIssueRows(phaseGroups, today, locationMeta?)` returning an array shaped like `ActivityIssueRow` (structurally compatible with `components/dashboard/ActivityIssueTable.tsx`'s exported type — not imported directly, to avoid a `lib/` → `components/` import direction).

- [ ] **Step 1: Write the failing test**

Add to `lib/dashboard-metrics.test.ts` (append a new `describe` block, keep existing ones untouched):

```ts
describe('buildActivityIssueRows', () => {
  const today = new Date('2026-07-10')

  it('filters to only needs-attention activities, sorted most-overdue-first', () => {
    const phaseGroups = [
      {
        phase_code: 'F1',
        activities: [
          { id: 'a1', kegiatan: 'Kegiatan A', pic: 'Budi', status: 'sedang_berjalan' as const, tanggal_selesai_rencana: '2026-07-01' },
          { id: 'a2', kegiatan: 'Kegiatan B', pic: 'Sari', status: 'selesai' as const, tanggal_selesai_rencana: '2026-07-05' },
          { id: 'a3', kegiatan: 'Kegiatan C', pic: 'Budi', status: 'ditunda' as const, tanggal_selesai_rencana: '2026-08-01' },
        ],
      },
    ]
    const rows = buildActivityIssueRows(phaseGroups, today)
    expect(rows.map((r) => r.activityId)).toEqual(['a1', 'a3'])
    expect(rows[0].overdueDays).toBe(9)
    expect(rows[0].phaseCode).toBe('F1')
  })

  it('attaches locationName/locationCode when locationMeta is given', () => {
    const phaseGroups = [
      {
        phase_code: 'F1',
        activities: [
          { id: 'a1', kegiatan: 'Kegiatan A', pic: 'Budi', status: 'ditunda' as const, tanggal_selesai_rencana: '2026-08-01' },
        ],
      },
    ]
    const rows = buildActivityIssueRows(phaseGroups, today, { locationName: 'Tebet A', locationCode: 'TA' })
    expect(rows[0].locationName).toBe('Tebet A')
    expect(rows[0].locationCode).toBe('TA')
  })

  it('omits locationName/locationCode when locationMeta is not given', () => {
    const phaseGroups = [
      {
        phase_code: 'F1',
        activities: [
          { id: 'a1', kegiatan: 'Kegiatan A', pic: 'Budi', status: 'ditunda' as const, tanggal_selesai_rencana: '2026-08-01' },
        ],
      },
    ]
    const rows = buildActivityIssueRows(phaseGroups, today)
    expect(rows[0].locationName).toBeUndefined()
    expect(rows[0].locationCode).toBeUndefined()
  })
})
```

Update the import line at the top of `lib/dashboard-metrics.test.ts` to include `buildActivityIssueRows`:

```ts
import {
  computeProgressPct,
  computeStatusCounts,
  isNeedsAttention,
  computeOverdueDays,
  computeProjectFinishDate,
  buildActivityIssueRows,
} from './dashboard-metrics'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- dashboard-metrics.test.ts`
Expected: FAIL — `buildActivityIssueRows` is not exported from `./dashboard-metrics`.

- [ ] **Step 3: Add `buildActivityIssueRows` to `lib/dashboard-metrics.ts`**

Append at the end of the file:

```ts
export function buildActivityIssueRows(
  phaseGroups: Array<{
    phase_code: string
    activities: Array<{
      id: string
      kegiatan: string
      pic: string
      status: ActivityStatus
      tanggal_selesai_rencana: string
    }>
  }>,
  today: Date,
  locationMeta?: { locationName: string; locationCode: string }
) {
  return phaseGroups
    .flatMap((phase) =>
      phase.activities
        .filter((a) => isNeedsAttention(a, today))
        .map((a) => ({
          activityId: a.id,
          kegiatan: a.kegiatan,
          pic: a.pic,
          phaseCode: phase.phase_code,
          tanggalSelesaiRencana: a.tanggal_selesai_rencana,
          status: a.status,
          overdueDays: computeOverdueDays(a.tanggal_selesai_rencana, today),
          ...(locationMeta ?? {}),
        }))
    )
    .sort((a, b) => b.overdueDays - a.overdueDays)
}
```

Also add the intent-documenting comment directly above `isNeedsAttention`, so the same-day-due edge case (confirmed intentional this week) doesn't get re-flagged as a bug later:

```ts
// Same-day-due activities are treated as needing attention as soon as any
// time passes past midnight (this compares against a live `today` Date, not
// a start-of-day-normalized one). Confirmed intentional -- an activity due
// "today" should already show up as needing attention, not wait until the
// day is over.
export function isNeedsAttention(
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- dashboard-metrics.test.ts`
Expected: PASS, all existing + 3 new.

- [ ] **Step 5: Consume in `app/(app)/page.tsx`**

Change the import line:

```ts
import { buildActivityIssueRows } from '@/lib/dashboard-metrics'
```

(replacing `import { isNeedsAttention, computeOverdueDays } from '@/lib/dashboard-metrics'`)

Replace the `issues` construction:

```ts
  const issues = locations
    .flatMap((location) =>
      buildActivityIssueRows(location.phases, today, {
        locationName: location.name,
        locationCode: location.code,
      })
    )
    .sort((a, b) => b.overdueDays - a.overdueDays)
```

(the outer `.sort` re-sorts the combined cross-location array globally, exactly matching the original behavior — each location's own internal sort from `buildActivityIssueRows` is superseded by this final sort.)

- [ ] **Step 6: Consume in `app/(app)/dashboard/[locationCode]/page.tsx`**

Change the import line:

```ts
import {
  computeProgressPct,
  computeStatusCounts,
  computeProjectFinishDate,
  buildActivityIssueRows,
} from '@/lib/dashboard-metrics'
```

(dropping `isNeedsAttention, computeOverdueDays`, adding `buildActivityIssueRows`)

Replace the `issues` construction:

```ts
  const issues = buildActivityIssueRows(phases, today)
```

- [ ] **Step 7: Run the full suite, build, and lint**

Run: `npm test` — expect all passing (96 + 3 = 99).
Run: `npm run build` — expect clean, both `/` and `/dashboard/[locationCode]` routes generate.
Run: `npm run lint` — expect clean.

- [ ] **Step 8: Commit**

```bash
git add lib/dashboard-metrics.ts lib/dashboard-metrics.test.ts "app/(app)/page.tsx" "app/(app)/dashboard/[locationCode]/page.tsx"
git commit -m "refactor: extract buildActivityIssueRows to de-duplicate dashboard issue-row logic"
```

---

### Task 7: `lib/date-format.ts` — consistent id-ID date rendering

**Files:**
- Create: `lib/date-format.ts`
- Modify: `components/activities/ActivityRow.tsx`
- Modify: `components/dashboard/ActivityIssueTable.tsx`
- Modify: `components/dashboard/UpcomingActivitiesPanel.tsx`
- Modify: `components/dashboard/CriticalPathCard.tsx`
- Modify: `components/gantt/BaselinePanel.tsx`

**Interfaces:**
- Produces: `formatDateID(iso: string): string`

- [ ] **Step 1: Create `lib/date-format.ts`**

```ts
export function formatDateID(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
```

This is a direct extraction of the exact `toLocaleDateString` options already used in `BaselinePanel.tsx` — no formatting change, just a shared source.

- [ ] **Step 2: Apply in `ActivityRow.tsx`**

Add the import:

```ts
import { formatDateID } from '@/lib/date-format'
```

Change the Baseline Mulai cell:

```tsx
<TableCell className="text-gray-500">{baseline ? formatDateID(baseline.tanggal_mulai_rencana) : '–'}</TableCell>
```

(was `{baseline?.tanggal_mulai_rencana ?? '–'}`)

- [ ] **Step 3: Apply in `ActivityIssueTable.tsx`**

Add the import:

```ts
import { formatDateID } from '@/lib/date-format'
```

Change the date cell:

```tsx
<TableCell className="text-gray-500">{formatDateID(issue.tanggalSelesaiRencana)}</TableCell>
```

(was `{issue.tanggalSelesaiRencana}`)

- [ ] **Step 4: Apply in `UpcomingActivitiesPanel.tsx`**

Add the import:

```ts
import { formatDateID } from '@/lib/date-format'
```

Change the rendered line:

```tsx
<span className="text-gray-500">
  {activity.pic} · {formatDateID(activity.tanggalMulaiRencana)}
</span>
```

- [ ] **Step 5: Apply in `CriticalPathCard.tsx`**

Add the import:

```ts
import { formatDateID } from '@/lib/date-format'
```

Change the finish-date line:

```tsx
<div className="text-sm font-medium text-gray-900">{finishDate ? formatDateID(finishDate) : '–'}</div>
```

(was `{finishDate ?? '–'}`)

- [ ] **Step 6: Apply in `BaselinePanel.tsx`**

Add the import:

```ts
import { formatDateID } from '@/lib/date-format'
```

Replace the inline `toLocaleDateString` call:

```tsx
<p className="text-xs text-gray-500">{formatDateID(b.created_at)}</p>
```

(was the 5-line `new Date(b.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })`)

- [ ] **Step 7: Run the full suite, build, and lint**

Run: `npm test` — expect unchanged (99/99, no logic changed, purely a rendering call swap).
Run: `npm run build` — expect clean.
Run: `npm run lint` — expect clean.

- [ ] **Step 8: Commit**

```bash
git add lib/date-format.ts components/activities/ActivityRow.tsx components/dashboard/ActivityIssueTable.tsx components/dashboard/UpcomingActivitiesPanel.tsx components/dashboard/CriticalPathCard.tsx components/gantt/BaselinePanel.tsx
git commit -m "refactor: extract lib/date-format.ts and apply id-ID formatting to remaining raw-ISO-date spots"
```

---

### Task 8: `KkConsentForm` — revert to last-saved snapshot on failed save

**Files:**
- Modify: `components/kk-consent/KkConsentForm.tsx`

**Interfaces:** None new — internal fix only, matching `ActivityTable.tsx`'s existing `savedSnapshots` pattern.

- [ ] **Step 1: Add the snapshot ref**

In `components/kk-consent/KkConsentForm.tsx`, after the existing `pendingChanges` ref declaration, add:

```ts
  const savedSnapshot = useRef<KkConsent>(initialData)
```

- [ ] **Step 2: Update `flushSave` to record and revert to the snapshot**

Replace the `flushSave` callback body:

```ts
  const flushSave = useCallback(async () => {
    const changes = pendingChanges.current
    if (Object.keys(changes).length === 0) return
    pendingChanges.current = {}
    setStatus('saving')
    try {
      const res = await fetch(`/api/locations/${locationId}/kk-consent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menyimpan')
      }
      savedSnapshot.current = json.data as KkConsent
      setData(json.data as KkConsent)
      setStatus('saved')
    } catch (err) {
      setData(savedSnapshot.current)
      setStatus('error')
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan')
    }
  }, [locationId, setStatus])
```

(the two additions are `savedSnapshot.current = json.data as KkConsent` on success, and `setData(savedSnapshot.current)` on failure)

- [ ] **Step 3: Manual verification (no automated test exists for this component — none did before this task either)**

This is a UI-behavior fix with no existing Vitest coverage for `KkConsentForm` (matches the rest of this component's test posture). Correctness is verified in Task 13's Playwright pass: edit a field, force a failed save (e.g. by stopping the network briefly or PATCHing an invalid value server-side-rejected), and confirm the input visibly reverts to the last-saved value rather than staying at the failed one.

- [ ] **Step 4: Run the full suite, build, and lint**

Run: `npm test` — expect unchanged (99/99).
Run: `npm run build` — expect clean.
Run: `npm run lint` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add components/kk-consent/KkConsentForm.tsx
git commit -m "fix: revert KkConsentForm to last-saved snapshot on failed save"
```

---

### Task 9: `YearCalendarGrid` — keyboard-focusable holiday cells

**Files:**
- Modify: `components/work-calendar/YearCalendarGrid.tsx`

**Interfaces:** None new.

- [ ] **Step 1: Add the `KeyboardEvent` import**

At the top of `components/work-calendar/YearCalendarGrid.tsx`, add:

```ts
import type { KeyboardEvent } from 'react'
```

- [ ] **Step 2: Make the holiday cell keyboard-focusable and keyboard-activatable**

Replace the `cell` construction inside the `days.map((day) => { ... })` block:

```tsx
                const cell = (
                  <div
                    className={cn(
                      'text-center text-xs rounded p-1',
                      holiday ? 'bg-red-100 text-red-700 font-medium cursor-pointer' : 'text-gray-700'
                    )}
                    title={holiday?.name}
                    {...(holiday
                      ? {
                          tabIndex: 0,
                          role: 'button' as const,
                          onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.currentTarget.click()
                            }
                          },
                        }
                      : {})}
                  >
                    {format(day, 'd')}
                  </div>
                )
```

Non-holiday cells are unchanged (no `tabIndex`, nothing to activate). Holiday cells are wrapped by `<DeleteHolidayDialog>` via `DialogTrigger asChild` — Radix attaches its `onClick` handler onto this `<div>`, so `e.currentTarget.click()` on Enter/Space fires that same handler, opening the delete-confirmation dialog exactly as a mouse click would.

- [ ] **Step 3: Run the full suite, build, and lint**

Run: `npm test` — expect unchanged (99/99, no lib logic touched).
Run: `npm run build` — expect clean.
Run: `npm run lint` — expect clean.

- [ ] **Step 4: Commit**

```bash
git add components/work-calendar/YearCalendarGrid.tsx
git commit -m "fix: make holiday day-cells keyboard-focusable and keyboard-activatable"
```

---

### Task 10: `GanttArrows` — critical-colored arrowheads + keyboard-reachable tooltip

**Files:**
- Modify: `components/gantt/GanttArrows.tsx`

**Interfaces:** None new.

- [ ] **Step 1: Replace the single hardcoded-gray marker with two color-matched markers**

Replace the `<defs>` block:

```tsx
        <defs>
          <marker id="gantt-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={BASELINE_COLOR} />
          </marker>
          <marker id="gantt-arrowhead-critical" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={CRITICAL_COLOR} />
          </marker>
        </defs>
```

(was a single `#gantt-arrowhead` marker hardcoded to `fill="#898781"` — a third, unrelated gray that matched neither `BASELINE_COLOR` (`#c3c2b7`) nor `CRITICAL_COLOR` (`#d03b3b`), the two colors the line itself is actually drawn in)

- [ ] **Step 2: Pick the marker per-arrow based on `isCritical`**

In the visible (second) `<path>` inside the `arrows.map(...)` block, change `markerEnd`:

```tsx
            <path
              d={pathD}
              fill="none"
              stroke={isCritical ? CRITICAL_COLOR : BASELINE_COLOR}
              strokeWidth={1.5}
              markerEnd={isCritical ? 'url(#gantt-arrowhead-critical)' : 'url(#gantt-arrowhead)'}
              className="pointer-events-none"
            />
```

- [ ] **Step 3: Make the hover hit-target keyboard-reachable**

In the invisible (first) `<path>` inside the same block, add `tabIndex` and focus/blur handlers mirroring the existing mouse handlers:

```tsx
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={10}
              tabIndex={0}
              onMouseEnter={() => setHoveredDepId(dep.id)}
              onMouseLeave={() => setHoveredDepId((current) => (current === dep.id ? null : current))}
              onFocus={() => setHoveredDepId(dep.id)}
              onBlur={() => setHoveredDepId((current) => (current === dep.id ? null : current))}
            />
```

- [ ] **Step 4: Run the full suite, build, and lint**

Run: `npm test` — expect unchanged (99/99, no lib logic touched).
Run: `npm run build` — expect clean.
Run: `npm run lint` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add components/gantt/GanttArrows.tsx
git commit -m "fix: match Gantt arrowhead color to line criticality and make arrow hover keyboard-reachable"
```

---

### Task 11: CPM benchmark for >200 activities (measure, document, no speculative code change)

**Files:** None modified — read/write only against a disposable location via existing routes.

**Interfaces:** None.

- [ ] **Step 1: Log in and create a disposable benchmark location**

```bash
curl -s -c /tmp/w14-cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@perumnas.co.id","password":"SuperAdmin123!"}' > /dev/null

LOCATION_ID=$(curl -s -b /tmp/w14-cookies.txt -X POST http://localhost:3000/api/locations \
  -H "Content-Type: application/json" \
  -d '{"name":"Benchmark CPM Week14","code":"T14BENCH","project_start_date":"2026-07-01"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.id")
echo "Location: $LOCATION_ID"
```

Expected: a UUID printed for `$LOCATION_ID`. This also creates the standard 4-phase/~27-activity template, which counts toward the total.

- [ ] **Step 2: Get a phase id to attach synthetic activities to**

```bash
PHASE_ID=$(curl -s -b /tmp/w14-cookies.txt "http://localhost:3000/api/locations/$LOCATION_ID/phases" \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data[0].id")
echo "Phase: $PHASE_ID"
```

- [ ] **Step 3: Create 200 synthetic activities**

```bash
ACT_IDS=()
for i in $(seq 1 200); do
  ID=$(curl -s -b /tmp/w14-cookies.txt -X POST "http://localhost:3000/api/phases/$PHASE_ID/activities" \
    -H "Content-Type: application/json" \
    -d "{\"kegiatan\":\"Bench $i\",\"pic\":\"Bench\",\"tanggal_mulai_rencana\":\"2026-07-01\",\"tanggal_selesai_rencana\":\"2026-07-03\"}" \
    | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.id")
  ACT_IDS+=("$ID")
done
echo "Created ${#ACT_IDS[@]} activities"
```

Expected: `Created 200 activities`, bringing the location's total to ~227 (template's ~27 + these 200), comfortably over the PRD's ">200" threshold.

- [ ] **Step 4: Chain them into one linear FS dependency graph (worst case for CPM's forward/backward pass)**

```bash
for i in $(seq 0 198); do
  curl -s -b /tmp/w14-cookies.txt -X POST http://localhost:3000/api/dependencies \
    -H "Content-Type: application/json" \
    -d "{\"predecessor_id\":\"${ACT_IDS[$i]}\",\"successor_id\":\"${ACT_IDS[$((i+1))]}\",\"dep_type\":\"FS\",\"lag_days\":0}" \
    > /dev/null
done
echo "Dependencies created"
```

Expected: `Dependencies created`. This step itself may take a couple of minutes (each dependency POST triggers its own CPM recalculation over the growing graph) — that setup cost is not what's being measured.

- [ ] **Step 5: Time the recalculate call itself**

```bash
time curl -s -b /tmp/w14-cookies.txt -X POST "http://localhost:3000/api/locations/$LOCATION_ID/recalculate"
```

Expected: a JSON response with `updatedCount` around 227, plus bash's `real`/`user`/`sys` timing lines.

- [ ] **Step 6: Clean up**

```bash
curl -s -b /tmp/w14-cookies.txt -X DELETE "http://localhost:3000/api/locations/$LOCATION_ID"
```

- [ ] **Step 7: Document the result**

Record the measured `real` time in the plan's execution notes / progress ledger: if it's comfortably fast (sub-few-seconds, expected given the algorithm is in-memory, not query-per-node), close the PRD risk with the measured number and take no further action. If it is genuinely slow, do not attempt an optimization inside this task — flag it as a follow-up recommendation for a future week instead (matches this project's established practice of not fixing unscoped problems mid-task).

No commit — no tracked file changes in this task.

---

### Task 12: Gantt virtualization threshold check (measure, document, no speculative code change)

**Files:** None modified — read-only query.

**Interfaces:** None.

- [ ] **Step 1: Query every active location's real activity count**

```bash
curl -s -b /tmp/w14-cookies.txt http://localhost:3000/api/locations | node -pe "
const rows = JSON.parse(require('fs').readFileSync(0,'utf8')).data;
JSON.stringify(
  rows
    .map(r => ({ code: r.code, activityCount: r.phases.flatMap(p => p.activities).length }))
    .sort((a, b) => b.activityCount - a.activityCount)
)
"
```

Expected: a JSON array of `{code, activityCount}` sorted descending.

- [ ] **Step 2: Document the result**

If no active location's count approaches 60 (the PRD's flagged threshold for Gantt SVG-arrow slowness), document "not yet triggered — real usage stays well under the threshold, defer virtualization until it does" and take no further action. If some location already does approach or exceed 60, do a real Playwright render-time check on that location's `/dashboard/[locationCode]/timeline` page before deciding whether virtualization needs to be built this week — do not build it speculatively without that data point.

No commit — no tracked file changes in this task.

---

### Task 13: Final whole-feature verification

**Files:** None modified (unless the Playwright pass surfaces a real bug in one of Tasks 3-10's changes, in which case fix it in the relevant file and note the deviation, matching this project's established review discipline).

**Interfaces:** None.

- [ ] **Step 1: Full automated check**

```bash
npm test
npm run build
npm run lint
npx tsc --noEmit
```

Expected: all four clean. Test count should be 99/99 (83 baseline + 4 cpm-runner + 9 raci-utils + 3 buildActivityIssueRows).

- [ ] **Step 2: Real-browser Playwright pass over every UI-facing fix from this week**

Using the existing `tests/e2e` fixtures/helpers (`newRoleContext`, `getSharedLocation`, the file-by-file execution procedure documented in `tests/e2e/README.md` — do NOT run the combined `npm run test:e2e` across multiple files in one command, per Week 13's documented session-staleness finding), manually drive and confirm, as `admin@perumnas.co.id`:

1. **Risk Register** (`/dashboard/{code}/risks`): Kategori/Status dropdowns in both the filter bar and the create/edit modal still populate the same 6 categories / 3 statuses as before (Task 5 didn't change the data, only its source).
2. **RACI** (`/raci`): cell set/clear still persists via `PATCH`, and the ▲▼ reorder still swaps two rows' `display_order` correctly across a reload (Task 4 didn't change behavior, only its implementation).
3. **Dashboard date rendering**: the landing page's Isu Lintas-Lokasi table, a per-location dashboard's Jalur Kritis card and Kegiatan Mendatang panel, and the Timeline page's Baseline Mulai column and "Kelola Baseline" list all now render dates as e.g. "7 Jul 2026" instead of a raw `2026-07-07` (Task 7).
4. **KK Consent** (`/dashboard/{code}/kk-consent`): trigger a failed save (e.g. via devtools offline toggle mid-edit) and confirm the field visibly reverts to its last-saved value rather than staying at the failed one (Task 8).
5. **Kalender Kerja** (`/work-calendar`, admin/SA only): Tab to a holiday-marked day-cell and confirm it receives visible focus, then press Enter and confirm the delete-confirmation dialog opens (Task 9).
6. **Timeline/Gantt** (`/dashboard/{code}/timeline`): confirm a critical-path dependency arrow now renders its arrowhead in the critical-red color (not gray), and confirm Tab-focusing an arrow's hit-area shows its tooltip the same way hovering does (Task 10).

Zero new console errors expected across the whole pass, matching every prior week's bar.

- [ ] **Step 3: Record results**

Add a `## Week 14` entry to `.superpowers/sdd/progress.md` summarizing: which tasks were done, the CPM benchmark's measured `real` time (Task 11), the max real activity count found (Task 12) and whether virtualization was deemed necessary, and confirmation that the 5 leftover test locations (Task 2) and migration 005's status (Task 1, still pending manual user action) are noted.

- [ ] **Step 4: Commit (only if Step 2 required a fix)**

```bash
git add -A
git commit -m "test: Week 14 whole-feature Playwright verification pass"
```

If Step 2 found no bugs, this step is skipped — nothing to commit for a clean verification pass, matching the precedent of prior weeks' verification-only final tasks.

---

## Self-Review Notes

- **Spec coverage:** Section 1 (migration 005, test-location cleanup) → Tasks 1-2. Section 2 (cpm-runner, RaciClient tests) → Tasks 3-4. Section 3 (risk-labels, dashboard-metrics, date-format, isNeedsAttention comment, KkConsentForm, a11y odds and ends) → Tasks 5-10. Section 4 (CPM benchmark, Gantt virtualization measurement) → Tasks 11-12. Testing bar from the spec → Task 13. No spec item is uncovered.
- **Dropped from spec, with reason:** the spec's "Workload heatmap sticky PIC column dark-mode variant" item is **not** a task here — checked live and confirmed this app has no `ThemeProvider`, no dark-mode toggle, and zero `dark:` Tailwind classes anywhere in the codebase (`darkMode: ["class"]` in `tailwind.config.ts` is unused shadcn scaffold default). Dark mode is unreachable in this app today, so styling one component for it would be a no-op fix, not real polish. Flagged here instead of silently dropped.
- **Placeholder scan:** no TBD/TODO; every code step shows the actual diff/new file content.
- **Type consistency:** `computeActivityCpmUpdate`'s `CpmUpdateResult.changed` (Task 3) is what `runCpmForLocation` checks before adding `updated_by`/`updated_at` — same name used in both the extracted function and its caller. `swapStakeholderOrder`'s `StakeholderSwapResult.swapped` tuple (Task 4) is consumed by the exact two variable names (`swappedCurrent`, `swappedNeighbor`) in `RaciClient.tsx`'s rewritten `handleReorder`. `buildActivityIssueRows` (Task 6) is consumed identically by both page files with no signature drift.
