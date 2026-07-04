# Minggu 7 — Baseline & Kritis: Design

**Status:** Approved
**PRD ref:** §9.8 Baselines API; §10.5 Halaman Timeline / Gantt Chart; §10.6 Halaman Fase (kolom
Baseline Mulai / Deviasi); §4 Pengguna & Hierarki Peran; §16 Estimasi Milestone (Minggu 7)

## Goal

Close out the two pieces of "Baseline & Kritis" not already covered by Week 6: a UI to save,
list, and activate baselines (backend has existed unused since Week 2), and real values for the
Fase table's "Baseline Mulai" / "Deviasi (hari)" columns (currently hardcoded `–`). Critical-path
highlighting itself — red Gantt bars, red arrows, the 🔴 "Kritis" badge in `ActivityRow` — already
shipped in Week 6 and needs no new work.

## Context / What already exists

- **Baseline backend, fully working since Week 2, zero UI:**
  `GET /api/locations/[locationId]/baselines` (list, all roles), `POST` (Admin/SA — creates a
  baseline, deactivates any prior active one, snapshots every current activity into
  `baseline_activities`), `PATCH /api/baselines/[id]/activate` (Admin/SA — deactivates the rest,
  activates this one), `DELETE /api/baselines/[id]` (SA only — out of scope this week, see below).
  All three routes already write audit log entries (`BASELINE_SAVE` / `UPDATE`).
- `lib/validations.ts` already has `createBaselineSchema` (`name: min(2)`, `description: optional`).
- `lib/gantt-layout.ts`'s `computeDeviationDays(baselineDate, actualDate, holidays)` (Week 6,
  tested) already implements exactly the PRD's "Rencana - Baseline dalam hari kerja" rule,
  including the earlier-than-baseline (negative) case. No new pure-logic function needed for the
  Deviasi column — this is a straight reuse.
- `app/(app)/dashboard/[locationCode]/timeline/page.tsx` already queries the active baseline and
  its `baseline_activities` and passes them into `GanttChart` for the baseline bar layer. It does
  **not** currently call `getSession()`/`isAdmin()` at all (the page is marked "Semua" — read-only
  for everyone) — this week adds that check solely to gate the new "Kelola Baseline" button.
- `components/activities/ActivityRow.tsx` lines 197-198 render `<TableCell className="text-gray-300">–</TableCell>`
  twice — these are the Baseline Mulai and Deviasi cells, stubbed since Week 6 explicitly deferred
  them. `ActivityTable.tsx`'s header row already has `Baseline Mulai` / `Deviasi` columns (lines
  232-233) waiting for data.
- `[faseSlug]/page.tsx` fetches `holidays` already (used for `Durasi (HK)`); the same array can
  feed `computeDeviationDays`.
- Established Dialog pattern to follow: `components/activities/DependencyPanel.tsx` — a
  shadcn `Dialog` opened from a small trigger button, `isAdmin`-gated content, local `open`/form
  state, calls the API directly with `fetch`, reports results back up via callback props.
- `GanttChart.tsx` is the only client component with access to `baselineActivities` on the
  Timeline page today; it renders `GanttControls` and owns no server data itself — everything is
  server-fetched once in `page.tsx` and passed down as props. There is deliberately no client
  mutation/re-fetch state on this page (Week 6 spec) — a full reload is how the Timeline page
  shows fresh data, same as `[faseSlug]/page.tsx`.

## Baseline management UI

**New component `components/gantt/BaselinePanel.tsx`** (client), same shape as `DependencyPanel`:

- Props: `locationId: string`, `baselines: Baseline[]`, `isAdmin: boolean`.
- Not rendered at all when `!isAdmin` (matches `AddActivityDialog`/`DeleteActivityDialog`'s
  existing convention of omitting Admin-only controls entirely for Viewers, not just disabling
  them) — Viewers get no "Kelola Baseline" button.
- Trigger: a `Button` labeled "Kelola Baseline", opens a `Dialog`.
- Dialog content, top to bottom:
  1. A small form — `Input` for name (required, min 2 chars, client-side check mirrors
     `createBaselineSchema`), `Textarea` for description (optional) — with a "Simpan Baseline"
     submit button. On submit: `POST /api/locations/${locationId}/baselines`. Success → toast
     "Baseline disimpan", close dialog, `router.refresh()`. Failure → toast the error message,
     dialog stays open (same error-handling shape as `DependencyPanel`'s add-dependency flow).
  2. A divider, then a list of existing baselines (the `baselines` prop, already ordered
     newest-first by the GET route) — each row shows name, `created_at` (formatted `id-ID`
     locale, matching the Gantt month labels' existing `toLocaleDateString('id-ID', ...)` use),
     and either a "Aktif" `Badge` (the currently active one) or a small "Aktifkan" button (the
     rest). Clicking "Aktifkan" → `PATCH /api/baselines/${id}/activate`. Success → toast
     "Baseline diaktifkan", `router.refresh()`. No confirmation dialog — activating is
     non-destructive and reversible (activating a different baseline back undoes it), unlike
     delete.
- No delete action in this component — `DELETE /api/baselines/[id]` stays API-only/SA-only this
  week (PRD milestone wording for Week 7 is "simpan/aktivasi", not delete; revisit if a real need
  comes up).

**`TimelinePage` changes:**

- Add `getSession()` + `isAdmin(profile.role)` (same two-line pattern already used in
  `[faseSlug]/page.tsx`), pass the result to `GanttChart` as `isAdmin`.
- Broaden the existing single-active-baseline query into two: keep the `is_active = true` lookup
  for the Gantt's baseline bar (unchanged), and add a second `GET`-equivalent query — all
  baselines for this location, `select('id, name, description, is_active, created_at')`, ordered
  `created_at desc` — passed to `GanttChart` as `baselines: Baseline[]`.
- Pass `location.id` through as `locationId` for `BaselinePanel`'s API calls.

**`GanttChart.tsx` changes:** accept the three new props (`isAdmin`, `baselines`, `locationId`),
render `<BaselinePanel locationId={locationId} baselines={baselines} isAdmin={isAdmin} />` next to
`GanttControls` (a simple flex row above the chart body, not inside `GanttControls` itself —
`GanttControls` is display toggles + legend, a separate concern from baseline mutation).

**New type in `lib/types.ts`:**

```typescript
export interface Baseline {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}
```

## "Baseline Mulai" / "Deviasi (hari)" columns

**`[faseSlug]/page.tsx` changes:** after the existing phase/activities fetch, look up the
location's active baseline and its `baseline_activities` filtered to this phase's activity ids
(same two-query shape `TimelinePage` already uses, just scoped to one phase instead of all four).
Pass the resulting `BaselineActivitySnapshot[]` down through `ActivityTable` → `ActivityRow` as a
new `baselineActivities` prop (plain array in, each row does its own `Map` lookup by
`activity_id` — consistent with how `dependencies` is already passed as a flat array and filtered
per-row rather than pre-grouped by the parent).

**`ActivityRow.tsx` changes:** replace the two stub cells (lines 197-198) with:

- **Baseline Mulai:** `baseline?.tanggal_mulai_rencana ?? '–'`, styled `text-gray-500` (read-only
  gray, per PRD "abu-abu" — matches the existing `Durasi (HK)` cell's muted-gray convention right
  next to it, not the lighter `text-gray-300` used for true empty-stub placeholders).
- **Deviasi (hari):** when a baseline snapshot exists for this activity, compute
  `computeDeviationDays(new Date(baseline.tanggal_mulai_rencana), new Date(activity.tanggal_mulai_rencana), holidayDates)`
  (`holidayDates` is already computed at the top of the component for `Durasi (HK)`) and render it
  as a signed integer string (`+3`, `-2`, `0` — an explicit `+` prefix on positive values since a
  bare "3" reads ambiguously here, whereas negative already carries its own sign). No color
  coding — PRD doesn't call for it, and this project's convention (per Week 6's dataviz-skill
  pass) is to reserve red exclusively for critical-path status, not schedule slippage. When no
  baseline snapshot exists for this activity (no baseline saved yet, or the activity was created
  after the last save), render `–`, same as the Baseline Mulai cell.

This recomputes automatically whenever `activity.tanggal_mulai_rencana` changes (edited by the
user or shifted by a CPM cascade) because `ActivityRow` re-renders from the `activities` state
`ActivityTable` already owns — no new state, no extra fetch.

## Testing

No new pure-logic functions are introduced (`computeDeviationDays` already has full Week 6 Vitest
coverage), so no new Vitest tests this week. Manual verification via a real-browser Playwright
pass, continuing this project's established pattern (Week 5 Task 7, Week 6 Task 11):

- As Admin: open "Kelola Baseline" on the Timeline page, save a new baseline, confirm it appears
  in the list marked "Aktif" and the Gantt's baseline bar layer now renders for every activity.
- Confirm the Fase table's Baseline Mulai / Deviasi columns populate for those same activities,
  with Deviasi reading `0` (just-saved baseline matches current dates exactly).
- Edit an activity's `tanggal_mulai_rencana` on the Fase table; confirm Deviasi updates to a
  signed non-zero value without a page reload, while Baseline Mulai stays fixed at the snapshot
  date.
- Save a second baseline, then use "Aktifkan" on the first (now-inactive) one from the list;
  confirm the Gantt baseline layer and the Fase table's Baseline Mulai column both revert to the
  first baseline's snapshot dates after refresh.
- As Viewer: confirm "Kelola Baseline" is entirely absent from the Timeline page, and the Fase
  table's Baseline Mulai / Deviasi cells render as plain read-only text (no inputs), consistent
  with every other Viewer-mode column.
- Confirm an activity added after a baseline was saved shows `–`/`–` for both columns until the
  next baseline save.

## Out of scope (explicitly deferred)

- Delete-baseline UI (`DELETE /api/baselines/[id]`, SA-only) — stays API-only.
- Any per-location "Kartu Jalur Kritis" summary card — belongs to PRD §10.4's per-location
  landing dashboard, which doesn't exist yet (`/dashboard/[locationCode]` currently just redirects
  to `fase-1`); that's Week 8+ scope per the milestone table.
- Any change to critical-path computation, highlighting, or the CPM engine itself — fully done in
  Weeks 4 and 6.
