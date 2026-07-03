# Minggu 6 — Gantt 3 Lapis: Design

**Status:** Approved
**PRD ref:** §10.5 Halaman Timeline / Gantt Chart; §8.6 UI — Visualisasi Dependensi di Gantt; §16 Estimasi Milestone (Minggu 6)

## Goal

Build the Timeline/Gantt page at `/dashboard/[locationCode]/timeline`: a custom-built (no
charting library), read-only visualization of every activity across all 4 phases as a 3-layer
bar (baseline/rencana/realisasi), with SVG dependency arrows, critical-path highlighting,
milestone markers, month/week view toggle, and three independent show/hide toggles. Full PRD
§10.5 scope in one week — no feature deferral.

## Context / What already exists

- The sidebar (`components/layout/Sidebar.tsx:116`) already links to
  `/dashboard/${currentCode}/timeline` — built in Week 1, unused until now (404s today).
- `[locationCode]/layout.tsx` wraps every child route (including the new timeline page) in
  `<PhaseTabs>` — this is pre-existing, unconditional behavior; the timeline page inherits it
  like every other page under this layout.
- **Baseline backend already fully works**, built in Week 2 and never wired to any UI:
  `POST /api/locations/[locationId]/baselines` (creates a baseline + snapshots every current
  activity into `baseline_activities`), `PATCH /api/baselines/[id]/activate`,
  `GET /api/locations/[locationId]/baselines`. No UI anywhere calls these yet — that's Week 7's
  job. This week's Gantt page queries `baselines`/`baseline_activities` directly and renders
  whatever it finds (nothing, today, for every existing location) — no stub, no hardcoded
  "baseline disabled" flag. The moment Week 7 ships a "Simpan Baseline" button, this same page
  starts showing 3 layers with zero changes.
- `activities` (Week 1 schema) has `is_on_critical_path` and `date_locked` but **no float/slack
  column** — CPM (`lib/cpm.ts`'s `CpmNode.totalFloat`) computes float in memory every run but
  `lib/cpm-runner.ts` only ever persists `is_on_critical_path`, discarding the float value.
- No charting/Gantt library exists in `package.json` — every other view in this project
  (`ActivityTable`, dialogs, etc.) is hand-built with Tailwind + shadcn/ui primitives.
- `components/ui/tooltip.tsx` does not exist yet (same situation Tabs was in before Week 5).
- This page is **read-only** — PRD marks it "Semua" (all roles), and nothing in §10.5 implies
  editing (no drag-to-resize, no inline fields). No `isAdmin` gating, no auto-save, no client
  mutation state — a simpler shape than `ActivityTable`.
- No seeded location has anywhere near the 60-activity scale PRD flags as a Gantt perf risk —
  virtualization is explicitly deferred until it's a real problem.

## Migration: persist CPM float

`supabase/migrations/004_activities_total_float_days.sql`:

```sql
ALTER TABLE public.activities
  ADD COLUMN total_float_days INTEGER NOT NULL DEFAULT 0;
```

No backfill needed — existing rows show `0` (a faithful "unknown/uncalculated yet" default) until
the next CPM run populates real values, the same graceful-staleness pattern `is_on_critical_path`
already went through before Week 4's first recalculation.

`lib/cpm-runner.ts`: in `runCpmForLocation`'s per-activity `updates` object, add
`total_float_days: node.totalFloat` alongside the existing `is_on_critical_path: node.isCritical`
line. No other file changes — this field isn't part of `CpmSummary`/`UpdatedActivity` (Week 5's
live-shift types), since the Gantt page reads directly from the DB on each page load rather than
consuming a mutation response.

## Data flow

`app/(app)/dashboard/[locationCode]/timeline/page.tsx` (server component) fetches, in one pass:

- The location (id, code, name).
- Every phase for this location with its activities nested (id, phase_id, kegiatan, pic,
  tanggal_mulai_rencana, tanggal_selesai_rencana, tanggal_mulai_realisasi,
  tanggal_selesai_realisasi, status, is_milestone, is_on_critical_path, date_locked,
  total_float_days, display_order) — same shape Week 3/5's phase-page queries already use,
  just across all 4 phases at once instead of one.
- Every dependency among those activities (id, predecessor_id, successor_id, dep_type,
  lag_days) — same query shape as Week 5's `page.tsx`.
- The active baseline for this location (`baselines` where `is_active = true`) and, if one
  exists, its `baseline_activities` rows (activity_id, kegiatan, tanggal_mulai_rencana,
  tanggal_selesai_rencana, is_milestone).
- `work_calendar` holidays — needed for the tooltip's working-day deviation number (see below),
  same query shape already used by `[faseSlug]/page.tsx`.

All of this is passed as props into `GanttChart` (client component). There is no client-side
fetch, no mutation, and no re-fetch on this page — a full reload is how the user sees fresh data,
identical in spirit to how `[faseSlug]/page.tsx` re-fetches on navigation.

## Component breakdown

New directory `components/gantt/`:

- **`GanttChart.tsx`** — top-level client container. Owns UI state only: view granularity
  (`'bulan' | 'minggu'`), three boolean toggles (show baseline / show dependency arrows / show
  critical-path highlight), and the currently-hovered bar or arrow (drives the tooltip). Computes
  the overall date range and day-width scale via `lib/gantt-layout.ts`, renders `GanttControls`,
  a frozen name column down the left, a horizontally-scrollable timeline body on the right built
  from `GanttRow`s, and a `GanttArrows` SVG overlay positioned across that same body.
- **`GanttControls.tsx`** — the toggle bar: a Bulan/Minggu segmented control (reuses Week 5's
  `Tabs` primitive) plus three independent toggle checkboxes for baseline, dependency arrows, and
  critical-path highlight. Also renders the phase color legend (F1–F4 swatch + name) required
  whenever ≥2 categorical colors are on screen — the dataviz skill's accessibility rule that
  identity must never rely on color alone.
- **`GanttRow.tsx`** — one row: the frozen name cell (kegiatan, PIC, plus a 🔴 prefix when
  `is_on_critical_path` — reusing `ActivityRow`'s existing critical-path convention so identity
  isn't color-only there either) plus a timeline lane. If
  `is_milestone`, renders a single `GanttMilestone` at the rencana date only — baseline/realisasi
  for a milestone activity still feed `computeDateRange` and the tooltip's deviation number, but
  don't render as a second marker this week (PRD doesn't specify a baseline-vs-rencana milestone
  visual, and one point per row keeps the row unambiguous). Non-milestone rows render up to three
  `GanttBar`s (baseline only if the toggle is on AND a snapshot exists for this activity;
  realisasi only if both realisasi dates are non-null).
- **`GanttBar.tsx`** — one absolutely-positioned bar (`left`/`width` from `dateToOffset`). Layer
  determines base styling (baseline = thin gray, behind; rencana = phase color, full opacity;
  realisasi = same phase hue at reduced brightness); `is_on_critical_path` overrides the rencana
  bar's color to the reserved critical-status red regardless of phase. See "Visual design" below
  for the resolved, validated values (this app has no dark mode wired up — `darkMode: ["class"]`
  is configured in Tailwind but nothing toggles it anywhere in the app — so this is light-mode
  only).
- **`GanttMilestone.tsx`** — a ♦ diamond at a single point, anchored to `tanggal_mulai_rencana`
  (milestones render as a point per PRD, not a bar with duration).
- **`GanttArrows.tsx`** — one SVG overlay. For every dependency, draws a path between the anchor
  points defined by `lib/gantt-layout.ts`'s `dependencyAnchor(depType)` (see below), colored gray
  by default and red when both the predecessor and successor are on the critical path. Hidden
  entirely when the "show dependency arrows" toggle is off.
- **`GanttTooltip.tsx`** — shared tooltip content, rendered via a new shadcn `Tooltip` primitive
  (`npx shadcn@latest add tooltip`, same pattern as adding `Tabs` in Week 5). Bar tooltip: nama,
  PIC, tanggal rencana (mulai–selesai), tanggal baseline + deviasi (only shown when a baseline
  snapshot exists for this activity; computed with `lib/gantt-layout.ts`'s new
  `computeDeviationDays` — see below — so a positive number means the plan slipped later than
  baseline, negative means it moved earlier), tanggal realisasi (if present), status, float
  (`total_float_days`, e.g. "5 hari" or "Kritis" when 0). Arrow tooltip: dependency type + lag.

Each component receives plain data plus the shared day-width scale as props; only `GanttChart`
holds state, and children communicate hover events back up via callbacks — the same
parent-owns-state, children-report-events shape already used by `ActivityTable`.

## `lib/gantt-layout.ts` — pure timeline math

New module, tested with Vitest (this project's established pattern for pure logic, per Week 4's
`lib/cpm.ts`/`lib/calendar.ts` and unlike Week 5, which added no tests because it had no new pure
functions):

```typescript
export interface DateRange {
  start: Date
  end: Date
}

export function computeDateRange(
  activities: Array<{
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    tanggal_mulai_realisasi: string | null
    tanggal_selesai_realisasi: string | null
  }>,
  baselineActivities: Array<{ tanggal_mulai_rencana: string; tanggal_selesai_rencana: string }>
): DateRange

export function dateToOffset(date: Date, rangeStart: Date, dayWidth: number): number

/**
 * Signed working-day difference between a baseline date and the current
 * (rencana) date. Positive = slipped later than baseline, negative = moved
 * earlier. lib/calendar.ts's workingDaysBetween(start, end, holidays) only
 * counts forward and returns 0 when start >= end, so it cannot represent
 * "earlier than baseline" on its own — this wraps it with a direction check.
 */
export function computeDeviationDays(baselineDate: Date, actualDate: Date, holidays: Date[]): number

export type GanttDepType = 'FS' | 'SS' | 'FF' | 'SF'

export function dependencyAnchor(depType: GanttDepType): {
  predecessorEdge: 'start' | 'finish'
  successorEdge: 'start' | 'finish'
}
```

`computeDateRange` takes the min/max across every activity's rencana dates, non-null realisasi
dates, and (when present) baseline dates, padded a few days on each side so bars never touch the
timeline's edge. `dateToOffset` converts an absolute date to a pixel x-position given the range's
start and a `dayWidth` constant — `GanttChart` picks `dayWidth` based on the Bulan/Minggu toggle
(a small compressed value for Bulan, a larger expanded value for Minggu; exact pixel values
finalized during implementation).

`dependencyAnchor` maps each of the 4 dependency types to which edge of each bar the arrow
connects — not spelled out in the PRD beyond "draw an arrow from predecessor to successor", so
this is the explicit rule this feature implements:

| Type | Predecessor edge | Successor edge |
|---|---|---|
| FS | finish | start |
| SS | start | start |
| FF | finish | finish |
| SF | start | finish |

## Visual design (dataviz skill, validated)

Ran the dataviz skill's procedure and its `validate_palette.js` before committing to any hex
value (categorical six-checks: lightness band, chroma floor, CVD separation, contrast — see
`docs/superpowers/specs/` history for the exact command). Resolved palette, light-mode only
(this app has no active dark mode):

| Role | Value | Notes |
|---|---|---|
| F1 rencana | `#2a78d6` (blue) | Categorical slot 1 |
| F2 rencana | `#1baf7a` (aqua) | Categorical slot 2 — sub-3:1 text contrast; relief = the frozen name column's text label + tooltip, never color-only |
| F3 rencana | `#eda100` (yellow) | Categorical slot 3 — same relief as F2 |
| F4 rencana | `#008300` (green) | Categorical slot 4 |
| Realisasi (any phase) | same phase hex, `filter: brightness(0.65)` | A darker shade of the *same* hue, not a new color and not a hatch texture — the dataviz skill treats texture as an opt-in accessibility/print channel, never a default decoration, so "warna gelap" from the PRD's mockup is implemented as shade, not the mockup's literal hatch pattern |
| Baseline | `#c3c2b7` | Documented "Baseline / axis" chrome role |
| Critical path (rencana bar override) | `#d03b3b` | Reserved status-critical red; always paired with text (🔴 prefix in the name cell, explicit "Jalur Kritis" line in the tooltip) — never color-alone |
| Gridlines (day/month separators) | `#e1e0d9` | Hairline, 1px, solid |
| Current-month column wash | `#f0efec` | |
| Weekend column wash (Minggu view) | `#f9f9f7` | |
| Primary / secondary / muted text | `#0b0b0b` / `#52514e` / `#898781` | |

The 4-hue categorical subset (blue/aqua/yellow/green, in that fixed order) passes all hard checks;
aqua and yellow WARN on contrast against the light surface, which obligates a relief channel —
satisfied here because phase identity is never color-only (the frozen name column and tooltip
always carry the activity's phase in text).

**Bar marks:** each of the up-to-3 stacked layers in a row is an 8px-tall bar, 2px gap between
stacked layers, 4px rounded corners on both ends (Gantt bars have no zero-baseline to anchor
square against, unlike a column chart, so both ends round). No borders — the 2px surface gap is
what separates layers, per the skill's mark spec. Each bar's hover hit-target is padded taller
than its painted 8px so thin bars stay easy to hit, and a hovered bar lifts slightly (brightness
increase) to show it responded, in addition to opening its tooltip.

## Month/week chrome

`GanttChart` derives two more presentational details from the same date range, not exposed as
separate `lib/gantt-layout.ts` functions (they're display-only grouping, not math another
component needs): a header row grouping days into calendar months (current month shaded darker,
per PRD), and, in Minggu view only, a lighter strip shading weekend columns.

## Testing

`lib/gantt-layout.ts`: Vitest coverage for `computeDateRange` (no realisasi present, no baseline
present, single activity, multiple activities with realisasi extending past rencana),
`dateToOffset` (both dayWidth scales, a date before rangeStart), `computeDeviationDays` (rencana
later than baseline → positive, rencana earlier than baseline → negative, exactly equal → zero,
and a case spanning a holiday to confirm it's excluded from the count), and `dependencyAnchor`
(all 4 types, exact edge pairs from the table above).

No automated tests for the rendering components (`GanttChart`, `GanttRow`, `GanttBar`, etc.) —
consistent with this project's convention that only pure `lib/` logic gets unit tests. Manual
verification is a real-browser Playwright pass (the approach that worked well in Week 5's Task 7,
using Playwright's `chromium` module directly since `chromium-cli` isn't available in this
environment): confirm bars render at correct relative positions for a set of activities with
known dates, toggles correctly show/hide their respective layers, a critical-path activity's
rencana bar renders red, hovering a bar/arrow shows the right tooltip content, milestones render
as diamonds rather than bars, and — once a baseline exists (create one via curl against the
already-working `POST /api/locations/[locationId]/baselines` during verification, since there's
no UI for it yet) — the baseline layer and its tooltip deviation number appear correctly.

## Out of scope (explicitly deferred)

- Any UI to save/activate/delete a baseline (button, dialog, list) — Week 7
- The Fase table's separate "Baseline Mulai" / "Deviasi (hari)" columns (§10.6, `ActivityRow.tsx`,
  currently stubbed as "–") — Week 7
- Row virtualization for large activity counts — revisit only if a real location approaches the
  PRD's flagged ~60-activity risk threshold
- Drag-to-resize or any other bar-level editing — not in PRD §10.5, editing stays on the Fase
  table
