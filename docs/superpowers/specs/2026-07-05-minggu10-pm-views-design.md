# Minggu 10 — PM Views: Design

**Status:** Approved
**Date:** 2026-07-05

## Context

Weeks 1–9 delivered Fondasi, Data Layer, Fase CRUD, CPM Engine, Dependensi UI, Gantt 3 Lapis,
Baseline & Kritis, Dashboard, and Risk Register. Per `PRD_Dashboard_Revitalisasi_Perumnas_v2.md`
§16, Minggu 10 = **PM Views**: Workload heatmap, Weekly Summary + copy WA, Kalender Kerja.

Backend state going in:
- `work_calendar` table + RLS (Week 1/2), `GET/POST /api/work-calendar`, `DELETE
  /api/work-calendar/[id]` (Week 2/4) — fully working, POST/DELETE already trigger
  `runCpmForAllActiveLocations`.
- `GET /api/locations/[locationId]/weekly-summary` (Week 2) — fully working, already computes all
  4 panels (selesai/mulai/terlambat/ditunda) and generates the WhatsApp-formatted text
  server-side. Never had a UI page built for it. Currently hardcodes "this week" (`today = new
  Date()`), no way to navigate to another week.
- No dedicated API for Workload View — it's a read-only cross-location aggregation, same shape as
  the Week 8 landing page's `locations → phases → activities` query.
- `components/layout/Sidebar.tsx` already has nav links for `/workload` (global section, all
  roles) and `/work-calendar` (admin-only conditional block, alongside not-yet-built `/audit-log`
  and `/users`) — both currently 404 since no pages exist yet. No link exists yet for
  weekly-summary.

This week is therefore mostly UI, plus one small, backward-compatible API extension (weekly-summary
week navigation) and one Sidebar addition (weekly-summary link).

## Scope decisions (from brainstorming)

1. **Workload "active in week N"**: an activity counts in a given week's cell if its
   `[tanggal_mulai_rencana, tanggal_selesai_rencana]` range overlaps that week's Mon–Fri window,
   AND its status is not `selesai` (`belum_mulai`/`sedang_berjalan`/`ditunda` all count — the PIC
   still has it on their plate).
2. **Kalender Kerja years**: the 12-month grid is navigable to any year (Prev/Next arrows), showing
   whatever `work_calendar` rows exist for that year (likely empty outside 2026–2027). The "Import
   Libur Nasional [Tahun]" button only offers 2026 or 2027 as choices, since that's the only
   canonical national-holiday data available (mirrored from `supabase/seed.sql`).
3. **Weekly Summary Sidebar link**: add one this week, in the per-location nav block alongside
   Timeline/Risk Register/KK Consent.

## Routes & data fetching

### `/workload` (new page, all roles)

Server component. Query (mirrors `app/(app)/page.tsx`'s exact shape):
```ts
const { data: locationRows } = await supabase
  .from('locations')
  .select(`
    id, code, name,
    phases ( phase_code,
      activities ( id, kegiatan, pic, status, progress_pct, tanggal_mulai_rencana, tanggal_selesai_rencana )
    )
  `)
  .eq('is_active', true)
  .order('display_order')
```
Flattens into a flat `WorkloadActivity[]` (each activity plus `locationCode`, `locationName`,
`phaseCode`), passed to a client component along with the distinct list of locations (for the
Fase/lokasi filter dropdowns).

### `/work-calendar` (new page, admin/super_admin only)

Server component. First true whole-page role gate in this codebase (every prior week only gated
individual actions/fields, never an entire page) — resolve `isAdmin` via `getSession()`, call
`notFound()` if the signed-in user isn't admin/super_admin, matching the codebase's existing
convention of using `notFound()` for anything inaccessible (invalid location codes, invalid
phases). The Sidebar link is already conditionally hidden for non-admins, but that's UX only — the
page itself must enforce it, same as every write endpoint already does server-side.

Fetches all `work_calendar` rows (`GET /api/work-calendar`, unchanged) and passes them to a client
component.

### `/dashboard/[locationCode]/weekly-summary` (new page, all roles)

Server component resolves the location, then the page's client component fetches
`GET /api/locations/[locationId]/weekly-summary?weekOffset=N` client-side (starts at `N=0`,
"Minggu Sebelumnya"/"Minggu Berikutnya" buttons adjust `N`), re-fetching on navigation — mirrors
how `KkConsentForm` and other client components already own their own fetch/state cycle.

**Small API extension** (`app/api/locations/[locationId]/weekly-summary/route.ts`): add an optional
`weekOffset` query param (default `0`, parsed as an integer). The existing `monday`/`sunday`/
`nextMonday`/`nextSunday` calculations shift by `7 * weekOffset` days before everything else runs
unchanged — no other logic in the route changes. This is additive and backward-compatible: calling
the route with no query param behaves exactly as it does today.

## New lib modules

### `lib/workload-metrics.ts` (Vitest-tested)

```ts
export interface WeekColumn {
  start: string  // ISO date, Monday
  end: string    // ISO date, Friday
  label: string  // e.g. "6–10 Jul"
}

export function computeWeekColumns(referenceDate: Date, weeksAhead: number): WeekColumn[]

export interface PicWorkloadRow {
  pic: string
  activeCount: number       // all non-selesai activities for this PIC, any time
  nextStart: string | null  // earliest tanggal_mulai_rencana >= today among non-selesai;
                            // falls back to earliest non-selesai overall if none are upcoming;
                            // null only if the PIC has zero non-selesai activities
  avgProgress: number       // computeProgressPct() over ALL this PIC's activities (lib/dashboard-metrics.ts, Week 8, unchanged) — selesai activities pull the average up, matching that function's existing semantics
  weekCounts: number[]      // one count per WeekColumn, using the "active in week N" rule above
}

export function buildPicWorkload(
  activities: Array<{ pic: string; status: ActivityStatus; progress_pct: number; tanggal_mulai_rencana: string; tanggal_selesai_rencana: string }>,
  weekColumns: WeekColumn[],
  today: Date
): PicWorkloadRow[]

export function getActivitiesInCell(
  activities: Array<{ pic: string; status: ActivityStatus; tanggal_mulai_rencana: string; tanggal_selesai_rencana: string }>,
  pic: string,
  weekColumn: WeekColumn
): typeof activities  // same filter as buildPicWorkload's per-cell count, exposed for the click-to-popover detail list

export type WorkloadBand = 'low' | 'medium' | 'high'
export function getWorkloadBand(count: number): WorkloadBand  // low: 0-1, medium: 2-3, high: 4+
export function getWorkloadBandClasses(count: number): string // same 3-color convention as lib/risk-utils.ts (green/amber/red)
```

Vitest coverage: `computeWeekColumns` (correct Monday-start windows, correct count), the band
boundaries (1/2 and 3/4), and `buildPicWorkload`'s active/overlap/status filtering logic with a
handful of hand-traced fixture activities.

### `lib/national-holidays.ts` (static data, no test — same precedent as `PHASE_COLORS` in
`components/gantt/gantt-constants.ts`, a plain constant with no logic to test)

```ts
export interface NationalHoliday {
  holiday_date: string
  name: string
}

export const NATIONAL_HOLIDAYS: Record<2026 | 2027, NationalHoliday[]> = {
  2026: [ /* copied verbatim from supabase/seed.sql's 2026 block */ ],
  2027: [ /* copied verbatim from supabase/seed.sql's 2027 block */ ],
}
```

## Components

### `components/workload/` (new directory)

- `WorkloadClient.tsx` — owns Fase/lokasi/date-range filter state, computes the filtered activity
  list, calls `computeWeekColumns`/`buildPicWorkload`, renders the PIC cards row and
  `WorkloadHeatmap`.
- `WorkloadHeatmap.tsx` — presentational table: rows = PIC, columns = the 12 `WeekColumn`s, each
  cell colored via `getWorkloadBandClasses`, click opens a Dialog (not a new Popover primitive —
  matches this project's existing click-for-detail convention, e.g. `DependencyPanel`) listing
  that cell's activities via `getActivitiesInCell`.

### `components/work-calendar/` (new directory)

- `WorkCalendarClient.tsx` — owns the selected year, the holiday list (local state seeded from
  server props), add/import modal state.
- `YearCalendarGrid.tsx` — presentational 12-month grid for the selected year (built with
  `date-fns`'s `eachMonthOfInterval`/`eachDayOfInterval`, no new date-picker library — same
  "custom-built over a library" precedent as Week 6's Gantt), holidays rendered red with their
  name, click a holiday day → `DeleteHolidayDialog` (mirrors `DeleteRiskDialog`'s shape exactly).
- `AddHolidayModal.tsx` — date + name fields → `POST /api/work-calendar`.
- `ImportNationalHolidaysButton.tsx` — year select (2026/2027 only) → loops `NATIONAL_HOLIDAYS[year]`,
  POSTs each, catches the existing route's "Tanggal sudah ada" 400 per-holiday and treats it as a
  skip (not a failure), toasts a single summary ("N ditambahkan, M sudah ada").

### `components/weekly-summary/` (new directory)

- `WeeklySummaryClient.tsx` — fetches the API (client-side, with `weekOffset` state), renders the
  4 panels, the monospace WhatsApp-text box, and a "Salin Teks WhatsApp" button
  (`navigator.clipboard.writeText`, toast on success/failure), plus Prev/Next week buttons.

## Error handling

Same established convention throughout: `{ data, error }` contract, `toast.error(...)` on failure,
no state corruption on a failed request. `ImportNationalHolidaysButton`'s per-holiday "already
exists" case is explicitly not an error path (see above).

## Out of scope

- No changes to the CPM engine itself — `work_calendar` POST/DELETE already trigger
  `runCpmForAllActiveLocations` (Week 2), unchanged this week.
- No new API route for Workload View — direct Supabase query in the server component, same as the
  Week 8 landing page.
- No schema/RLS/migration changes.
- No email/WhatsApp *send* integration — copy-to-clipboard only, per PRD §10.12's own scope.
- No holiday data beyond 2026/2027 — years without canonical data show an empty grid with no
  import option, not an error.

## Testing plan

- Vitest: `lib/workload-metrics.test.ts` (week-column generation, band boundaries, active/overlap
  filtering with fixture activities).
- Manual/Playwright E2E (final task, per established pattern): verify Workload cards/heatmap
  render correctly across locations/filters, cell click shows the right activities, Kalender Kerja
  add/delete/import all work and correctly trigger a CPM recalculation banner, Weekly Summary
  navigates weeks correctly and the copied clipboard text matches the on-screen WhatsApp box, and
  a Viewer is correctly blocked (`notFound()`) from `/work-calendar` while everything else renders
  identically to admin.
