# Minggu 8 — Dashboard: Design

**Status:** Approved
**PRD ref:** §10.3 Dashboard Lintas-Lokasi (Landing Page); §10.4 Dashboard Per-Lokasi; §10.8
Halaman Persetujuan Warga / KK; §9.13 KK Consent API; §16 Estimasi Milestone (Minggu 8)

## Goal

Build three pages that together make up "Dashboard": the cross-location landing page at `/`
(currently a Week-1 stub showing only a bare location grid), the per-location summary dashboard
at `/dashboard/[locationCode]` (currently just a redirect to `fase-1`, never implemented), and a
new KK Consent tracker page at `/dashboard/[locationCode]/kk-consent` (its API has existed unused
since Week 2). No schema or API changes — every number these pages show already exists in
`locations`, `phases`, `activities`, and `kk_consent`; this week is aggregation and UI only.

## Context / What already exists

- **`app/(app)/page.tsx`** is a Week-1 placeholder: a plain grid of location name/code/description
  cards linking to `/dashboard/{code}`, plus a stale "Minggu 1 selesai" banner. It queries
  `locations` directly (no nested phases/activities). This week replaces its body entirely; the
  route itself is unchanged.
- **`app/(app)/dashboard/[locationCode]/page.tsx`** currently does one thing:
  `redirect(`/dashboard/${params.locationCode}/fase-1`)`. The Sidebar's own "Ringkasan" nav link
  (`components/layout/Sidebar.tsx:115`) already points at the bare `/dashboard/{code}` URL with
  `exact` matching — it was wired up in Week 1 in anticipation of this week's real page, and today
  every click on it silently redirects away. This week replaces the redirect with real content.
- **KK Consent backend has been fully working, unused, since Week 2:**
  `GET /api/locations/[locationId]/kk-consent` (all roles) and
  `PATCH /api/locations/[locationId]/kk-consent` (Admin/SA — accepts `target_kk`, `setuju`,
  `menolak`, `catatan`, all optional) — `app/api/locations/[locationId]/kk-consent/route.ts`. Every
  location gets a `kk_consent` row on creation with `target_kk = 0` (`app/api/locations/route.ts:73-79`).
  `belum_dihubungi` is a DB `GENERATED ALWAYS AS (target_kk - setuju - menolak) STORED` column —
  never computed client-side. `lib/validations.ts:162-167` already has `updateKkConsentSchema`.
  The Sidebar already links to `/dashboard/{code}/kk-consent` (`Sidebar.tsx:122`) — 404s today.
- **`[locationCode]/layout.tsx`** wraps every child route (dashboard, timeline, kk-consent, fase-N)
  in `<PhaseTabs>` unconditionally, pre-existing behavior since Week 1 — the new dashboard and
  kk-consent pages inherit it with no tab active, the same situation the Timeline page has been in
  since Week 6 (documented there as acceptable, not a regression to fix).
- No existing pure-logic module aggregates activities into percentages/counts — this is new this
  week, `lib/dashboard-metrics.ts`, following the Week 4/6 convention of pure `lib/` functions with
  Vitest coverage (`lib/cpm.ts`, `lib/calendar.ts`, `lib/gantt-layout.ts`).
- Reusable pieces already built for the Fase table, applicable here unchanged:
  `hooks/useDebouncedCallback.ts` and `components/activities/SaveStatusBadge.tsx` (generic despite
  its folder name — no activity-specific logic in either file).
- `ActivityStatus` (`lib/types.ts`) is `'belum_mulai' | 'sedang_berjalan' | 'selesai' | 'ditunda'`.
  `is_on_critical_path` and `total_float_days` exist on every activity since Weeks 4/6.

## `lib/dashboard-metrics.ts` — pure aggregation functions

New module, tested with Vitest:

```typescript
interface ActivityForMetrics {
  status: ActivityStatus
  progress_pct: number
  is_on_critical_path: boolean
}

export function computeProgressPct(activities: Pick<ActivityForMetrics, 'progress_pct'>[]): number
// Average progress_pct, rounded to the nearest integer. Returns 0 for an empty array
// (a phase/location with no activities yet shows 0%, not NaN).

export interface StatusCounts {
  critical: number
  ditunda: number
  selesai: number
  total: number
}

export function computeStatusCounts(activities: ActivityForMetrics[]): StatusCounts
// critical = count where is_on_critical_path; ditunda = count where status === 'ditunda';
// selesai = count where status === 'selesai'; total = activities.length.

interface ActivityForAttention {
  status: ActivityStatus
  tanggal_selesai_rencana: string
}

export function isNeedsAttention(activity: ActivityForAttention, today: Date): boolean
// PRD's exact rule: status === 'ditunda' OR (parseISO(tanggal_selesai_rencana) < today
// AND status !== 'selesai'). `today` is an explicit parameter (never `new Date()` internally)
// so tests are deterministic, matching this project's existing convention of injecting reference
// dates into pure date logic (e.g. lib/calendar.ts's holiday-aware functions).

export function computeOverdueDays(tanggalSelesaiRencana: string, today: Date): number
// Plain calendar days late: differenceInCalendarDays(today, parseISO(tanggalSelesaiRencana)).
// Not working-day-aware (unlike lib/calendar.ts's workingDaysBetween) — this is a severity
// ranking number for a UI list, not a schedule computation, so calendar days is the simpler,
// correct choice here. Can be negative (not yet due) or zero.

interface ActivityForFinishDate {
  tanggal_selesai_rencana: string
}

export function computeProjectFinishDate(activities: ActivityForFinishDate[]): string | null
// max(tanggal_selesai_rencana) across all activities (ISO date strings compare correctly
// lexicographically). Returns null for an empty array — the Kartu Jalur Kritis renders "–"
// instead of a bogus date for a location with zero activities.
```

## Page 1 — `/` Cross-Location Landing

`app/(app)/page.tsx` (server component) queries every active location with its phases and
activities in one pass — the same nested-select shape `app/api/locations/route.ts` already uses
for its own (unrelated, API-only) cross-location summary, but with more fields, since this page
also needs to build the issues panel: `kegiatan, pic, tanggal_selesai_rencana, status,
progress_pct, is_on_critical_path` per activity, plus each phase's `phase_code` and each location's
`name, code, description`.

New `components/dashboard/` directory:

- **`LocationSummaryCard.tsx`** — one location: name + code header, `computeProgressPct` across
  all its activities as a big progress bar + %, 4 small phase badges (phase color from
  `components/gantt/gantt-constants.ts`'s existing `PHASE_COLORS` — reused, not redefined — plus
  that phase's own `computeProgressPct`), then `computeStatusCounts` rendered as three numbers
  (🔴 kritis / 🟡 ditunda / ✅ selesai of total), linking to `/dashboard/{code}`.
- **`ComparativeTable.tsx`** — one row per location, one column per F1–F4, each cell
  `computeProgressPct` for that location's activities in that phase.
- **`ActivityIssueTable.tsx`** — shared between this page and Page 2 (see below): renders a list
  of activities where `isNeedsAttention` is true, each row showing kegiatan/PIC/tanggal
  selesai rencana/`computeOverdueDays` (as "N hari" when positive, "Ditunda" badge when the
  activity's own status is `ditunda` and not yet overdue), sorted by `computeOverdueDays`
  descending. Takes an optional `showLocation: boolean` prop — `true` on this page (adds a
  lokasi/fase column), `false` on Page 2 (already scoped to one location).

## Page 2 — `/dashboard/[locationCode]` Per-Location Summary

`app/(app)/dashboard/[locationCode]/page.tsx` replaces its current single-line redirect body.
Fetches the location, its 4 phases with activities (same shape `[faseSlug]/page.tsx` already
uses, just across all 4 at once — same pattern the Timeline page already established), and its
`kk_consent` row. Layout follows PRD §10.4's own component order:

1. Header + breadcrumb (location name — `[locationCode]/layout.tsx` already renders this above
   every child page, so this page's own content starts below it, same as `[faseSlug]`/timeline).
2. **Kartu Progres Keseluruhan** — `computeProgressPct` across every activity at this location, as
   one large number + progress bar.
3. **4 Kartu Fase** — per phase: `name`, `pic_utama`, "`selesai`/`total`" (from
   `computeStatusCounts`), `computeProgressPct`, and a ditunda-count badge if `> 0`.
4. **`CriticalPathCard.tsx`** — `computeStatusCounts(...).critical` and
   `computeProjectFinishDate(...)` (or "–" if null) across every activity at this location.
5. **Kegiatan Mendatang** — the next 5 activities with `status !== 'selesai'`, sorted by
   `tanggal_mulai_rencana` ascending. This is a plain inline filter/sort in the page component
   (not a `lib/` function) — it has no branching logic worth unit-testing independently, unlike
   `isNeedsAttention`'s multi-condition rule.
6. **Perlu Perhatian** — `ActivityIssueTable` with `showLocation={false}`, scoped to this
   location's activities.
7. **KK Consent Summary** — `KkConsentSummaryBar.tsx` (read-only mini version: progress bar of
   `setuju / target_kk` with a marker at the 60% `threshold_pct`, and a "Lihat detail →" link to
   Page 3), rendered **only when `target_kk > 0`** — every location gets a `kk_consent` row at
   creation with `target_kk = 0` by default (Week 1), and PRD's "jika lokasi ini punya data" means
   an admin has actually started entering real numbers, not merely that the row exists.

## Page 3 — `/dashboard/[locationCode]/kk-consent` KK Consent Tracker

New `app/(app)/dashboard/[locationCode]/kk-consent/page.tsx` (server component): fetches the
location and its `kk_consent` row (`GET`-equivalent direct query, same pattern every other page
uses rather than calling its own API route), passes `isAdmin` down the same way `[faseSlug]/page.tsx`
does (`getSession()` + `isAdmin(profile.role)`).

New `components/kk-consent/KkConsentForm.tsx` (client component):

- Header: location name + "Sesuai UU No. 20/2011 Pasal 65 Ayat (2)" (PRD's own required legal
  citation).
- Admin: three debounced auto-save number inputs (Target KK, Setuju, Menolak — same
  uncontrolled-input-plus-`onChange`-debounce shape as `ActivityRow.tsx`'s number fields, reusing
  `useDebouncedCallback` at 600ms and `SaveStatusBadge` for save-state feedback, both imported
  as-is with no modification) and a debounced Catatan `Textarea`. `PATCH
  /api/locations/[locationId]/kk-consent` already accepts a partial body (all fields optional per
  `updateKkConsentSchema`), so each field's own change is sent independently, same pattern as
  `ActivityRow`'s per-field PATCH calls.
- A read-only "Belum Dihubungi" figure — always `target_kk - setuju - menolak` — is the DB's own
  generated column, displayed as-is after each save response, never computed in the client.
- A progress bar: `setuju / target_kk` (0% if `target_kk` is 0, avoiding a divide-by-zero), with a
  visible marker line at `threshold_pct` (60), colored to reflect whether the current percentage
  has crossed that threshold (a reserved status color, not a new palette — reusing the same
  critical-red-only-for-status convention established in Weeks 6-7's dataviz-validated palette:
  green at/above threshold, amber below).
- Viewer: the same numbers and bar rendered as plain read-only text/divs, no inputs — matching the
  existing Admin/Viewer split convention in `ActivityRow.tsx`.

## Testing

`lib/dashboard-metrics.ts`: Vitest coverage for `computeProgressPct` (empty array → 0, single
activity, multiple activities, non-integer average rounds correctly), `computeStatusCounts` (mix
of statuses and critical flags, empty array → all zeros), `isNeedsAttention` (ditunda-but-not-late,
late-but-not-ditunda-and-not-selesai, late-but-selesai → false, not-late-and-not-ditunda → false),
`computeOverdueDays` (late → positive, on-time → zero, not-yet-due → negative), and
`computeProjectFinishDate` (single activity, multiple activities picks the max, empty array →
null).

No automated tests for the rendering components (`LocationSummaryCard`, `ComparativeTable`,
`ActivityIssueTable`, `CriticalPathCard`, `KkConsentSummaryBar`, `KkConsentForm`) — consistent with
this project's convention that only pure `lib/` logic gets unit tests. Manual verification is a
real-browser Playwright pass (the approach established in Weeks 5-7): confirm the landing page's
cards/table/issues-panel render correct numbers for a location with a known mix of
critical/ditunda/selesai activities across phases; confirm `/dashboard/[locationCode]` no longer
redirects and shows all 7 sections with the KK Consent summary correctly hidden for a location at
`target_kk = 0` and shown once an admin has entered a nonzero target; confirm the KK Consent page's
auto-save round-trips correctly and the 60% threshold marker/coloring responds to input changes;
confirm Viewer sees read-only content everywhere with no inputs.

## Out of scope (explicitly deferred)

- `/raci`, `/pelaporan`, `/workload`, `/work-calendar`, `/audit-log`, `/users` — all already linked
  from the Sidebar (Week 1) but belong to Weeks 10-12 per the milestone table; none of these routes
  are touched this week.
- Risk Register (`/dashboard/[locationCode]/risks`, also already Sidebar-linked) — Week 9.
- Any change to CPM, Gantt, baseline, or dependency logic — fully done through Week 7.
- Pagination or filtering on the cross-location issues panel — PRD doesn't call for it; revisit
  only if a real deployment's issue count makes an unfiltered list unwieldy.
