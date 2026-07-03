# Minggu 5 — Dependensi UI: Design

**Status:** Approved
**PRD ref:** §8.7 UI — Manajemen Dependensi per Activity; §16 Estimasi Milestone (Minggu 5)

## Goal

Let admins manage per-activity dependencies (predecessor/successor, type, lag) from a panel
opened off the existing "Dep" badge in `ActivityTable`, with cycle rejection surfaced as an
error instead of a silent failure, and a notification when a mutation causes CPM to shift
other activities' dates. Explicitly out of scope: Gantt arrows (PRD §8.6, Week 6), baseline
tracking (Week 7).

## Context / What already exists

- `ActivityRow.tsx` already renders a static `<Badge>{depCount}</Badge>` in the "Dep" column
  — not clickable, no panel behind it.
- `app/api/dependencies/route.ts` (POST) and `app/api/dependencies/[id]/route.ts`
  (PATCH/DELETE) are fully wired to `runCpmForLocation` and cycle detection (Week 4) but
  **discard the CPM result** — responses are unchanged single-entity payloads.
- `app/api/activities/[id]/route.ts` (PATCH/DELETE) — same situation: calls
  `runCpmForLocation` after a date-affecting change, discards the result.
- `lib/cpm-runner.ts`'s `runCpmForLocation` already computes a per-activity `shifted` boolean
  internally (used only to build the audit log description) but does not return it.
- `app/(app)/dashboard/[locationCode]/[faseSlug]/page.tsx` already queries every dependency
  row for the whole location (`id, predecessor_id, successor_id, dep_type, lag_days`,
  filtered by `predecessor_id in allActivityIds`) — today only to build a `depCounts` map.
  This same query already has everything needed for the panel's predecessor/successor lists.
- `GET /api/locations/[locationId]/phases` returns every phase with nested activities
  (id, kegiatan, ...) — not used for this feature, since the phase page's own query already
  covers what's needed; no new endpoint required.
- No `components/ui/tabs.tsx` exists yet in this project.
- Established component pattern: a self-contained trigger+dialog client component
  (`DeleteActivityDialog`, `AddActivityDialog`) that owns its own fetch/mutation and reports
  results to `ActivityTable` via a callback prop; `ActivityTable` owns all row state.

## Response contract change: CPM result now surfaces to the client

Every mutation route that calls `runCpmForLocation` restructures its `data` payload from a
bare entity to `{ <entity-key>, cpm }`, where:

```typescript
type CpmSummary = {
  shiftedCount: number
  hasCycle: boolean
  criticalPath: string[]
  updatedActivities: Array<{
    id: string
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    is_on_critical_path: boolean
  }>
} | null
```

`updatedActivities` is exactly `runCpmForLocation`'s existing return field — routes pass it
through as-is, no extra serialization work.

`cpm` is `null` when the route didn't run CPM at all (e.g. a `PATCH /api/activities/[id]`
that only changed `catatan`, not dates). This mirrors the shape precedent already set by
`POST /api/locations/[locationId]/recalculate`, whose `data` is `{ updatedCount,
criticalPath }` rather than an entity — per-endpoint `data` shape is already established as
purpose-specific, not a fixed entity echo.

| Route | Old `data` | New `data` |
|---|---|---|
| `PATCH /api/activities/[id]` | `Activity` | `{ activity: Activity, cpm: CpmSummary }` |
| `DELETE /api/activities/[id]` | `{ id }` | `{ id, cpm: CpmSummary }` |
| `POST /api/dependencies` | `Dependency` | `{ dependency: Dependency, cpm: CpmSummary }` |
| `PATCH /api/dependencies/[id]` | `Dependency` | `{ dependency: Dependency, cpm: CpmSummary }` |
| `DELETE /api/dependencies/[id]` | `{ id }` | `{ id, cpm: CpmSummary }` |

`POST /api/phases/[id]/activities` (create) is **not** changed — a newly created activity has
no dependencies yet, so `runCpmForLocation` after an insert never shifts anything; restructuring
that response would add churn with no observable behavior to surface.

`lib/cpm-runner.ts`'s `CpmRunResult` gains a `shiftedCount: number` field (the count of
activities whose `shifted` flag was true, already computed inline — just also returned instead
of only feeding the audit log description). This is additive; the one existing consumer
(`POST /api/locations/[locationId]/recalculate`, which reads `.updatedActivities.length` and
`.criticalPath`) is unaffected.

## `DependencyPanel.tsx` (new)

Self-contained trigger+dialog, same lifecycle pattern as `DeleteActivityDialog`:

```typescript
interface DependencyPanelProps {
  activity: { id: string; kegiatan: string }
  dependencies: Dependency[]        // ALL deps in the location, from ActivityTable state
  locationActivities: LocationActivitySummary[]  // id, kegiatan, phase_code — for the dropdown
  isAdmin: boolean
  onDependencyAdded: (dep: Dependency, cpm: CpmSummary) => void
  onDependencyDeleted: (depId: string, cpm: CpmSummary) => void
}
```

- Renders the "N dep" badge itself (`dependencies.filter(d => d.predecessor_id === activity.id
  || d.successor_id === activity.id).length`) as the `DialogTrigger`.
- Two tabs (shadcn `Tabs`, added via `npx shadcn@latest add tabs`):
  - **Predecessor** — deps where `successor_id === activity.id`; each row shows the
    predecessor activity's name (resolved via `locationActivities`), type, lag, and (admin
    only) a delete button.
  - **Successor** — deps where `predecessor_id === activity.id`; same shape, opposite role.
- Admin-only inline "+ Tambah Predecessor" / "+ Tambah Successor" form: a `Select` populated
  from `locationActivities` (excluding `activity.id` itself and any activity already related
  in that direction), a dep-type `Select` (FS/SS/FF/SF), a numeric lag input (can be
  negative), and a submit button.
- Submit → `POST /api/dependencies` with `predecessor_id`/`successor_id` set according to
  which tab is active. On success, calls `onDependencyAdded(dependency, cpm)` and clears the
  form. On `422 CYCLE_DETECTED`, `toast.error(error.message)` and leaves the form open with
  nothing added (PRD: "Jika menimbulkan siklus → tampilkan error, jangan simpan").
- Row delete → `DELETE /api/dependencies/[id]`, then `onDependencyDeleted(id, cpm)`.
- Viewers (`isAdmin: false`) get the same dialog with both tabs but no add form and no delete
  buttons — read-only, per confirmed scope.

## `ActivityTable.tsx` changes

- Prop `depCounts: Record<string, number>` is replaced by `dependencies: Dependency[]` and a
  new `locationActivities: LocationActivitySummary[]`. Both become local state (`useState`,
  seeded from props) so mutations update instantly without a refetch — same pattern already
  used for `activities`.
- New shared handler, used by all three mutation paths (`flushSave`, `DeleteActivityDialog`'s
  `onDeleted`, `DependencyPanel`'s two callbacks):
  ```typescript
  function applyCpmResult(cpm: CpmSummary) {
    if (!cpm) return
    setActivities((prev) =>
      prev.map((a) => {
        const match = cpm.updatedActivities.find((u) => u.id === a.id)
        return match ? { ...a, ...match } : a
      })
    )
    if (cpm.shiftedCount > 0) {
      toast.info(`${cpm.shiftedCount} kegiatan ikut disesuaikan jadwalnya`)
    }
  }
  ```
  `updatedActivities` covers every activity in the *location*, not just the current phase —
  entries for activities outside the current phase simply find no match in `prev` and are
  ignored. No extra network round-trip needed; the toast fires regardless of whether any
  shifted activity is currently visible, so the admin is aware even if the shift landed on
  another phase's page.
- `handleFieldChange`/`flushSave` updates to unwrap `json.data.activity` (was `json.data`)
  and pass `json.data.cpm` through the shared shift-handling path above.
- `handleDeleted` (from `DeleteActivityDialog`) updates to unwrap `json.data.id` +
  `json.data.cpm`, and also prunes any `dependencies` entries referencing the deleted
  activity (they're cascade-deleted server-side already; this just keeps client state
  consistent without a refetch).
- `onDependencyAdded`/`onDependencyDeleted` update the `dependencies` state array directly
  (append/filter) and route `cpm` through the same shift-handling path.

## `DeleteActivityDialog.tsx` / `ActivityRow.tsx` changes

- `DeleteActivityDialog`: response unwrap changes from `json.data` to `json.data.id`;
  `onDeleted` signature gains a second `cpm: CpmSummary` argument.
- `ActivityRow`: replace the static `<Badge>{depCount}</Badge>` cell with
  `<DependencyPanel activity={...} dependencies={dependencies} locationActivities={...}
  isAdmin={isAdmin} onDependencyAdded={...} onDependencyDeleted={...} />`. `depCount` prop is
  removed (now computed inside `DependencyPanel` from the shared `dependencies` array).

## `page.tsx` (phase page, server component) changes

- The existing `allActivityIds` query is extended to also select `kegiatan, phase_id` and a
  joined `phases(phase_code)`, producing `locationActivities: { id, kegiatan, phaseCode
  }[]` passed to `ActivityTable` (used to label dropdown options like "F2 — Sosialisasi
  Warga" and to resolve names in the predecessor/successor lists).
- `depCounts` computation is removed; the raw `dependencies` query result is passed straight
  through to `ActivityTable` instead.

## `lib/types.ts` additions

```typescript
export interface Dependency {
  id: string
  predecessor_id: string
  successor_id: string
  dep_type: 'FS' | 'SS' | 'FF' | 'SF'
  lag_days: number
}

export interface LocationActivitySummary {
  id: string
  kegiatan: string
  phaseCode: string
}
```

## Error handling

- Cycle rejection (`422 CYCLE_DETECTED`) — `toast.error`, form stays open, nothing added
  (existing API behavior from Week 4; this week only adds the client-side handling).
- Duplicate dependency (`400 CREATE_ERROR`, "Dependensi ini sudah ada") — same `toast.error`
  pattern, already returned by the API today.
- Any other mutation failure — existing `toast.error(err.message ?? fallback)` pattern used
  everywhere else in this codebase.

## Testing

Consistent with Weeks 1–3 (no automated tests for API routes/UI) and Week 4 (Vitest scoped to
pure `lib/` logic only) — this week adds no new pure functions, so no new Vitest coverage.
Verification is a manual E2E pass:

- Open the panel from a viewer session — confirm read-only (no add form, no delete buttons).
- Add a predecessor and a successor as admin — confirm badge counts update on both activities
  without a page reload.
- Attempt a dependency that would create a cycle — confirm `422` toast, nothing persisted.
- Attempt a duplicate dependency — confirm the existing "sudah ada" toast.
- Delete a dependency — confirm badge counts update.
- Edit a date on an activity that has a dependent successor — confirm the shift toast appears
  and the successor's row (if in the same phase) reflects its new dates without a manual
  reload.
- Delete an activity that has a predecessor relationship (no successors, so deletion is
  allowed) — confirm dependent state cleans up correctly.
