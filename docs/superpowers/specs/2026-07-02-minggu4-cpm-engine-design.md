# Minggu 4 — CPM Engine: Design

**Status:** Approved
**PRD ref:** §8 CPM Engine — Algoritma & Logika; §16 Estimasi Milestone (Minggu 4)

## Goal

Implement the Critical Path Method engine as a pure TypeScript module, wire it into every
mutation that can affect a location's schedule (activity dates, dependencies, work calendar),
and add the first automated test suite in this project (Vitest) covering the algorithm's
correctness. Backend/API only — no UI changes this week.

## Context / What already exists

- `lib/calendar.ts` (Week 2) already exports `addWorkingDays(startDate, days, holidays)` and
  `workingDaysBetween(start, end, holidays)`, matching PRD §8.4 exactly.
- `locations.project_start_date` (Week 1 schema) is the CPM epoch (day 0).
- `activities.date_locked`, `activities.is_on_critical_path` (Week 1 schema) already exist —
  no migration needed.
- Ten `// TODO Week 4` markers already exist across the Week 2 API routes, precisely
  identifying every trigger point:
  - `app/api/activities/[id]/route.ts` (PATCH — date change; DELETE)
  - `app/api/phases/[id]/activities/route.ts` (POST — create)
  - `app/api/dependencies/route.ts` (POST — includes a cycle-detection TODO)
  - `app/api/dependencies/[id]/route.ts` (PATCH, DELETE)
  - `app/api/work-calendar/route.ts`, `app/api/work-calendar/[id]/route.ts` (POST/DELETE)
  - `app/api/locations/[locationId]/recalculate/route.ts` — currently a stub returning
    `{ data: { updatedCount: 0, criticalPath: [] }, error: null }`
- `lib/activity-helpers.ts` (Week 3) has `computeDurasiHK(mulai, selesai, holidays)` — the
  exact working-day duration formula CPM needs for `CpmActivity.duration`.
- No automated test runner exists anywhere in the project yet (Weeks 1-3 used `npm run
  build` + manual/curl verification as the convention).

## `lib/cpm.ts` — pure algorithm

No DB queries inside this file, per PRD's explicit directive ("Tidak ada query DB di dalam
fungsi CPM — data dependensi dan aktivitas sudah diambil sebelum dipanggil").

Types, verbatim from PRD §8.1:

```typescript
export type DepType = 'FS' | 'SS' | 'FF' | 'SF'

export interface CpmActivity {
  id: string
  duration: number          // working days
  dateLocked: boolean
}

export interface CpmDependency {
  predecessorId: string
  successorId: string
  type: DepType
  lagDays: number            // can be negative (lead time)
}

export interface CpmNode extends CpmActivity {
  earliestStart: number      // day N from project epoch, 0-based
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
```

Functions:

- `detectCycle(activityIds: string[], dependencies: CpmDependency[]): { hasCycle: boolean;
  cycleIds: string[] }` — DFS-based back-edge detection. Exported standalone (not just
  internal to `runCpm`) so `POST /api/dependencies` can pre-check a hypothetical dependency
  set before ever writing to the DB.
- `runCpm(activities: CpmActivity[], dependencies: CpmDependency[], projectStart: Date,
  holidays: Date[]): CpmResult` — PRD §8.3 steps 1-6: calls `detectCycle` first (returns
  immediately with `hasCycle: true` and no further computation if found); Kahn's topological
  sort; forward pass computing ES/EF per dependency type + lag (locked activities keep their
  existing ES/EF, computed via `workingDaysBetween(projectStart, existingDate, holidays)`);
  backward pass computing LS/LF (`projectFinish = max(EF)` across all activities); float
  (`LS - ES`) and `isCritical = (totalFloat === 0)`; critical path assembled by walking nodes
  with `isCritical === true` from a start node to a finish node.

## Small refactor: relocate `computeDurasiHK`

Move `computeDurasiHK` from `lib/activity-helpers.ts` to `lib/calendar.ts` — both the Week 3
UI's "Durasi (HK)" column and this week's CPM duration input need the identical formula, and
`lib/calendar.ts` is the already-established shared home for working-day math (imported by
both client and server code today). `lib/activity-helpers.ts` re-exports it (or the one
import site, `ActivityRow.tsx`, updates directly — decided at plan time) so no behavior
changes for Week 3 code.

## `lib/cpm-runner.ts` (new) — DB-aware wrapper

```typescript
export async function runCpmForLocation(
  supabase: SupabaseClient,
  locationId: string
): Promise<{ updatedActivities: Activity[]; criticalPath: string[]; hasCycle: boolean }>
```

Steps: fetch the location's `project_start_date`; fetch all activities across all phases for
the location; fetch all dependencies among those activities; fetch `work_calendar` holidays;
convert activities/dependencies to `CpmActivity`/`CpmDependency` (duration via the relocated
`computeDurasiHK`); call `runCpm`; if `hasCycle`, return immediately without writing anything
(callers decide how to surface this — see per-route behavior below); otherwise convert each
node's `earliestStart`/`earliestFinish` back to calendar dates via `addWorkingDays`, batch
`UPDATE` activities setting `tanggal_mulai_rencana`, `tanggal_selesai_rencana`, and
`is_on_critical_path` for every activity (skipping the date fields — but still updating
`is_on_critical_path` — for `date_locked` activities, since critical-path membership can
change even when a locked activity's own dates don't), and insert one audit log entry
(`action: 'RECALCULATE'`, `entityType: 'locations'`, `entityId: locationId`, description
summarizing how many activities' dates changed).

`hasCycle: true` should only ever reach `runCpmForLocation`'s callers through the manual
recalculate endpoint's defensive check — cycle creation is gated upstream at `POST
/api/dependencies` via `detectCycle`, and no other trigger changes the dependency graph's
edges. For every other caller (PATCH/POST/DELETE activities, PATCH/DELETE dependencies,
work-calendar changes), `runCpmForLocation` returning `hasCycle: true` indicates a
pre-existing data inconsistency, not a request-level error to reject: skip the DB update,
log it via the existing audit log helper, and let the handler's own response proceed
unaffected (the mutation the caller actually asked for already succeeded before CPM ran).

## Wiring — response contract stays backward-compatible

Per the confirmed scope (backend/API only, no UI changes), every existing endpoint's response
shape is unchanged from Week 2/3. CPM runs as an additional, awaited step before the handler
responds (must be awaited — not fire-and-forget — so the DB is consistent by the time the
response returns, and so `POST /api/dependencies` can reject a cycle-creating request before
ever inserting it). The shifted sibling activities and updated critical-path flags land in the
DB and the audit log; no endpoint's JSON payload changes to surface them, except the
recalculate endpoint below, whose entire purpose is exposing the CPM result.

| Trigger | Behavior |
|---|---|
| `PATCH /api/activities/[id]` | After a successful update, if any `tanggal_mulai_rencana`/`tanggal_selesai_rencana` field was in the request body, call `runCpmForLocation`. Response unchanged (still the single updated activity). |
| `POST /api/phases/[id]/activities` | After create, call `runCpmForLocation`. Response unchanged. |
| `DELETE /api/activities/[id]` | After delete, call `runCpmForLocation`. Response unchanged. |
| `POST /api/dependencies` | Before inserting: fetch existing dependencies for the location, append the hypothetical new one, call `detectCycle`. If it would cycle, return `422` with `{ data: null, error: { code: 'CYCLE_DETECTED', message: ..., cycleIds } }` and do NOT insert. Otherwise insert, then call `runCpmForLocation`. Response unchanged on success. |
| `PATCH /api/dependencies/[id]` | Changing `dep_type`/`lag_days` cannot introduce a cycle (graph edges unchanged) — no pre-check needed. After update, call `runCpmForLocation`. |
| `DELETE /api/dependencies/[id]` | Removing an edge cannot introduce a cycle. After delete, call `runCpmForLocation`. |
| `POST /api/locations/[locationId]/recalculate` | Replaces the Week 2 stub. Calls `runCpmForLocation` directly (admin-triggered manual recalc — no prior mutation to gate). Returns `{ data: { updatedCount, criticalPath }, error: null }`, matching the stub's already-established shape. If `hasCycle`, return `422` with `cycleIds` (existing cycles shouldn't normally exist since creation is gated, but the endpoint must handle it defensively). |
| `POST`/`DELETE /api/work-calendar` | After the holiday change, fetch all active locations and call `runCpmForLocation` for each, sequentially (small number of locations today; PRD's per-location performance target of <200ms for 60 activities/80 deps makes serial processing acceptable). Response unchanged. |

## Testing — Vitest, scoped to pure logic only

New devDependency: `vitest`. No `jsdom` environment needed (no React/DOM under test this
week — only `lib/cpm.ts` and `lib/calendar.ts`). `package.json` gains a `"test": "vitest
run"` script; `npm run build` remains the pre-commit gate for everything else, matching
established convention.

Coverage for `lib/cpm.ts`:
- Each dependency type (FS, SS, FF, SF) in isolation, including positive and negative lag
- A `date_locked` activity: its own ES/EF stay fixed; its successor's ES still shifts
  correctly off the locked date
- Cycle detection: a direct two-node cycle, a longer indirect cycle, and a valid DAG that
  must NOT be flagged
- Critical path identification across: a single linear chain, multiple parallel chains with
  different total durations (only the longest chain is critical), and float calculation for
  non-critical activities
- Performance smoke test: 60 activities / 80 dependencies completes in under 200ms (PRD's
  stated target), run as a single timed assertion, not a benchmark suite

Coverage for `lib/calendar.ts` (existing code, not yet tested): `addWorkingDays` skipping
weekends and holidays (including negative/backward offsets), `workingDaysBetween` inclusive
counting, and the relocated `computeDurasiHK`.

## Out of scope (explicitly deferred)

- UI wiring: `ActivityTable.tsx` consuming shifted-activity data or showing the "N kegiatan
  disesuaikan" toast/banner (PRD §10.6) — deferred to a later week once the response
  contract for surfacing shifts to the client is designed
- Dependency management UI (panel to add/view/remove dependencies per activity) — Week 5
- Gantt chart rendering of the critical path — Week 6
- Baseline snapshot / deviation tracking — Week 7

## Testing (manual, for the API surface)

Since UI isn't touched, verification is via `npm run build` (type-check) per task, plus a
final curl-based pass exercising: a PATCH that shifts a successor's dates, a POST dependency
that would create a cycle (expect 422), a valid dependency creation that shifts dates, the
manual recalculate endpoint, and a work-calendar change cascading across multiple seeded
locations — mirroring the curl-based verification approach that caught a real bug in Week 3.
