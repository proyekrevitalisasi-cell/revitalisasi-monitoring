# Minggu 6: Gantt 3 Lapis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read-only Timeline/Gantt page at `/dashboard/[locationCode]/timeline`: a
custom-built (no charting library) visualization of every activity as a 3-layer bar
(baseline/rencana/realisasi), with SVG dependency arrows, critical-path highlighting, milestone
markers, a Bulan/Minggu view toggle, and three independent show/hide toggles.

**Architecture:** A pure timeline-math module (`lib/gantt-layout.ts`) computes date ranges,
pixel offsets, deviation days, and dependency arrow anchor points — unit-tested with Vitest. A
new `components/gantt/` directory holds presentational components (`GanttChart` owns UI state;
`GanttRow`/`GanttBar`/`GanttMilestone`/`GanttArrows`/`GanttTooltip`/`GanttControls` are pure
consumers of props). The page itself is a server component that fetches everything in one pass —
there is no client mutation on this page at all.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase JS v2 · shadcn/ui (adding
`Tooltip` this week) · date-fns v3

## Global Constraints

- `npm run build` must pass before every commit; `npm test` must keep passing (31 existing tests
  from Week 4 plus this week's new `lib/gantt-layout.test.ts` cases — none of Week 4's own test
  files change)
- TypeScript strict — no implicit `any`
- This page is read-only — no `isAdmin` gating, no auto-save, no client mutation state
- Light mode only — this app has `darkMode: ["class"]` configured in Tailwind but nothing
  toggles it anywhere; do not add dark-mode variants
- Resolved visual palette (from the dataviz skill, already validated — do not substitute other
  values): F1 `#2a78d6`, F2 `#1baf7a`, F3 `#eda100`, F4 `#008300`, baseline `#c3c2b7`, critical
  `#d03b3b`, realisasi = same phase hex at `filter: brightness(0.65)` (not a hatch texture)
- Bar marks: 8px tall, 2px gap between stacked layers, 4px rounded corners on both ends, no
  borders
- Every git commit message follows the existing convention: `feat:`/`fix:` prefix, one line
- Spec: `docs/superpowers/specs/2026-07-03-minggu6-gantt-design.md`

---

## Task 1: Persist CPM Float — Migration + `cpm-runner.ts` + Types

**Files:**
- Create: `supabase/migrations/004_activities_total_float_days.sql`
- Modify: `lib/cpm-runner.ts`
- Modify: `lib/types.ts`
- Modify: `app/(app)/dashboard/[locationCode]/[faseSlug]/page.tsx`
- Modify: `app/api/locations/[locationId]/phases/route.ts`

**Interfaces:**
- Produces: `Activity.total_float_days: number` (new field on the existing type);
  `BaselineActivitySnapshot` type — both consumed by every later task that touches activity or
  baseline data

- [ ] **Step 1: Create the migration**

  Create `supabase/migrations/004_activities_total_float_days.sql`:
  ```sql
  -- 004_activities_total_float_days.sql
  -- CPM (lib/cpm.ts's CpmNode.totalFloat) computes float in memory on every
  -- run but lib/cpm-runner.ts only ever persisted is_on_critical_path,
  -- discarding the float value. The Week 6 Gantt tooltip needs the actual
  -- number, not just the boolean.

  ALTER TABLE public.activities
    ADD COLUMN total_float_days INTEGER NOT NULL DEFAULT 0;
  ```

  No backfill — existing rows show `0` until the next CPM run populates real values, the same
  staleness `is_on_critical_path` went through before Week 4's first recalculation.

- [ ] **Step 2: Apply the migration to Supabase Cloud**

  This project has no local Supabase (`.env.local` points at Supabase Cloud). Apply the
  migration the same way migration 003 was applied: open the Supabase Dashboard → SQL Editor for
  this project, paste the contents of `supabase/migrations/004_activities_total_float_days.sql`,
  and run it. Confirm success (no error, `activities` now has a `total_float_days` column) before
  continuing.

- [ ] **Step 3: Persist float in `lib/cpm-runner.ts`**

  Find this block inside `runCpmForLocation`'s `updateResults` map:
  ```typescript
        const updates: Record<string, unknown> = {
          is_on_critical_path: node.isCritical,
          updated_by: actor.id,
          updated_at: new Date().toISOString(),
        }
  ```
  Change to:
  ```typescript
        const updates: Record<string, unknown> = {
          is_on_critical_path: node.isCritical,
          total_float_days: node.totalFloat,
          updated_by: actor.id,
          updated_at: new Date().toISOString(),
        }
  ```

- [ ] **Step 4: Add `total_float_days` to the `Activity` type**

  In `lib/types.ts`, change:
  ```typescript
  export interface Activity {
    id: string
    phase_id: string
    display_order: number
    kegiatan: string
    pic: string
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    tanggal_mulai_realisasi: string | null
    tanggal_selesai_realisasi: string | null
    status: ActivityStatus
    progress_pct: number
    catatan: string | null
    is_milestone: boolean
    is_on_critical_path: boolean
    date_locked: boolean
    created_at: string
    updated_at: string
  }
  ```
  to:
  ```typescript
  export interface Activity {
    id: string
    phase_id: string
    display_order: number
    kegiatan: string
    pic: string
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    tanggal_mulai_realisasi: string | null
    tanggal_selesai_realisasi: string | null
    status: ActivityStatus
    progress_pct: number
    catatan: string | null
    is_milestone: boolean
    is_on_critical_path: boolean
    date_locked: boolean
    total_float_days: number
    created_at: string
    updated_at: string
  }
  ```

- [ ] **Step 5: Add `BaselineActivitySnapshot` to `lib/types.ts`**

  Append to the end of `lib/types.ts`:
  ```typescript
  export interface BaselineActivitySnapshot {
    activity_id: string
    kegiatan: string
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    is_milestone: boolean
  }
  ```

- [ ] **Step 6: Update every query that selects `Activity` fields to also select `total_float_days`**

  Exactly two files have a Supabase `.select(...)` that names `is_on_critical_path` as an
  explicit column (verified by grepping `is_on_critical_path` across the repo and checking each
  hit — routes using `select('*')`, like `app/api/phases/[id]/activities/route.ts` and the PATCH
  handler in `app/api/activities/[id]/route.ts`, already get the new column for free and need no
  change; `app/api/locations/route.ts` selects a different, deliberately minimal
  `status, progress_pct, is_on_critical_path` subset for the cross-location summary and should
  stay as-is — it has no use for float):

  In `app/(app)/dashboard/[locationCode]/[faseSlug]/page.tsx`, change:
  ```typescript
        status, progress_pct, catatan, is_milestone, is_on_critical_path,
        date_locked, created_at, updated_at
  ```
  to:
  ```typescript
        status, progress_pct, catatan, is_milestone, is_on_critical_path,
        date_locked, total_float_days, created_at, updated_at
  ```

  In `app/api/locations/[locationId]/phases/route.ts`, change:
  ```typescript
          status, progress_pct, catatan, is_milestone, is_on_critical_path,
          date_locked, created_at, updated_at
  ```
  to:
  ```typescript
          status, progress_pct, catatan, is_milestone, is_on_critical_path,
          date_locked, total_float_days, created_at, updated_at
  ```

- [ ] **Step 7: Verify build and tests**

  Run: `npm run build`
  Expected: succeeds

  Run: `npm test`
  Expected: 31 passed (unchanged — `lib/cpm-runner.ts` has no automated tests, consistent with
  every other DB-touching file; `lib/cpm.ts`/`lib/calendar.ts` are untouched)

- [ ] **Step 8: Commit**

  ```bash
  git add supabase/migrations/004_activities_total_float_days.sql lib/cpm-runner.ts lib/types.ts "app/(app)/dashboard/[locationCode]/[faseSlug]/page.tsx" app/api/locations/"[locationId]"/phases/route.ts
  git commit -m "feat: persist CPM float as activities.total_float_days"
  ```

---

## Task 2: `lib/gantt-layout.ts` — Pure Timeline Math

**Files:**
- Create: `lib/gantt-layout.ts`
- Create: `lib/gantt-layout.test.ts`

**Interfaces:**
- Consumes: `workingDaysBetween` from `lib/calendar.ts` (Week 2)
- Produces: `DateRange`, `computeDateRange`, `dateToOffset`, `computeDeviationDays`,
  `GanttDepType`, `dependencyAnchor` — consumed by every `components/gantt/*` task below

- [ ] **Step 1: Write the failing tests**

  Create `lib/gantt-layout.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import { computeDateRange, dateToOffset, computeDeviationDays, dependencyAnchor } from './gantt-layout'

  describe('computeDateRange', () => {
    it('pads 3 days before the earliest and after the latest rencana date when no realisasi/baseline exist', () => {
      const activities = [
        {
          tanggal_mulai_rencana: '2026-07-01',
          tanggal_selesai_rencana: '2026-07-10',
          tanggal_mulai_realisasi: null,
          tanggal_selesai_realisasi: null,
        },
      ]
      const result = computeDateRange(activities, [])
      expect(result.start.toISOString().slice(0, 10)).toBe('2026-06-28')
      expect(result.end.toISOString().slice(0, 10)).toBe('2026-07-13')
    })

    it('extends the range when realisasi dates go past the rencana range', () => {
      const activities = [
        {
          tanggal_mulai_rencana: '2026-07-01',
          tanggal_selesai_rencana: '2026-07-10',
          tanggal_mulai_realisasi: '2026-07-02',
          tanggal_selesai_realisasi: '2026-07-15',
        },
      ]
      const result = computeDateRange(activities, [])
      expect(result.end.toISOString().slice(0, 10)).toBe('2026-07-18')
    })

    it('extends the range to cover baseline dates when a baseline exists', () => {
      const activities = [
        {
          tanggal_mulai_rencana: '2026-07-05',
          tanggal_selesai_rencana: '2026-07-10',
          tanggal_mulai_realisasi: null,
          tanggal_selesai_realisasi: null,
        },
      ]
      const baseline = [{ tanggal_mulai_rencana: '2026-06-20', tanggal_selesai_rencana: '2026-07-08' }]
      const result = computeDateRange(activities, baseline)
      expect(result.start.toISOString().slice(0, 10)).toBe('2026-06-17')
    })

    it('returns a small window around today when there are no activities at all', () => {
      const result = computeDateRange([], [])
      const diffDays = (result.end.getTime() - result.start.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBe(6)
    })
  })

  describe('dateToOffset', () => {
    it('returns 0 for the range start itself', () => {
      const start = new Date('2026-07-01')
      expect(dateToOffset(start, start, 24)).toBe(0)
    })

    it('scales linearly by dayWidth', () => {
      const start = new Date('2026-07-01')
      const date = new Date('2026-07-11') // 10 days later
      expect(dateToOffset(date, start, 4)).toBe(40)
      expect(dateToOffset(date, start, 24)).toBe(240)
    })

    it('returns a negative offset for a date before the range start', () => {
      const start = new Date('2026-07-10')
      const date = new Date('2026-07-05')
      expect(dateToOffset(date, start, 10)).toBe(-50)
    })
  })

  describe('computeDeviationDays', () => {
    it('returns 0 when the dates are identical', () => {
      const d = new Date('2026-07-01')
      expect(computeDeviationDays(d, d, [])).toBe(0)
    })

    it('returns a positive count when the actual date is later than baseline (slipped)', () => {
      const baseline = new Date('2026-07-01') // Wednesday
      const actual = new Date('2026-07-07') // Thu,Fri,Mon,Tue = 4 working days
      expect(computeDeviationDays(baseline, actual, [])).toBe(4)
    })

    it('returns a negative count when the actual date is earlier than baseline (ahead of schedule)', () => {
      const baseline = new Date('2026-07-07')
      const actual = new Date('2026-07-01')
      expect(computeDeviationDays(baseline, actual, [])).toBe(-4)
    })

    it('excludes holidays from the count', () => {
      const baseline = new Date('2026-07-01')
      const actual = new Date('2026-07-07')
      const holiday = new Date('2026-07-03') // Friday, inside the span
      expect(computeDeviationDays(baseline, actual, [holiday])).toBe(3)
    })
  })

  describe('dependencyAnchor', () => {
    it('FS: predecessor finish to successor start', () => {
      expect(dependencyAnchor('FS')).toEqual({ predecessorEdge: 'finish', successorEdge: 'start' })
    })
    it('SS: predecessor start to successor start', () => {
      expect(dependencyAnchor('SS')).toEqual({ predecessorEdge: 'start', successorEdge: 'start' })
    })
    it('FF: predecessor finish to successor finish', () => {
      expect(dependencyAnchor('FF')).toEqual({ predecessorEdge: 'finish', successorEdge: 'finish' })
    })
    it('SF: predecessor start to successor finish', () => {
      expect(dependencyAnchor('SF')).toEqual({ predecessorEdge: 'start', successorEdge: 'finish' })
    })
  })
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npm test`
  Expected: FAIL — `lib/gantt-layout.ts` doesn't exist yet ("Cannot find module './gantt-layout'")

- [ ] **Step 3: Create `lib/gantt-layout.ts`**

  ```typescript
  import { addDays, subDays } from 'date-fns'
  import { workingDaysBetween } from '@/lib/calendar'

  const RANGE_PADDING_DAYS = 3

  export interface DateRange {
    start: Date
    end: Date
  }

  interface ActivityDateFields {
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    tanggal_mulai_realisasi: string | null
    tanggal_selesai_realisasi: string | null
  }

  interface BaselineDateFields {
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
  }

  export function computeDateRange(
    activities: ActivityDateFields[],
    baselineActivities: BaselineDateFields[]
  ): DateRange {
    const dates: Date[] = []
    for (const a of activities) {
      dates.push(new Date(a.tanggal_mulai_rencana))
      dates.push(new Date(a.tanggal_selesai_rencana))
      if (a.tanggal_mulai_realisasi) dates.push(new Date(a.tanggal_mulai_realisasi))
      if (a.tanggal_selesai_realisasi) dates.push(new Date(a.tanggal_selesai_realisasi))
    }
    for (const b of baselineActivities) {
      dates.push(new Date(b.tanggal_mulai_rencana))
      dates.push(new Date(b.tanggal_selesai_rencana))
    }

    if (dates.length === 0) {
      const today = new Date()
      return { start: subDays(today, RANGE_PADDING_DAYS), end: addDays(today, RANGE_PADDING_DAYS) }
    }

    const min = new Date(Math.min(...dates.map((d) => d.getTime())))
    const max = new Date(Math.max(...dates.map((d) => d.getTime())))
    return { start: subDays(min, RANGE_PADDING_DAYS), end: addDays(max, RANGE_PADDING_DAYS) }
  }

  export function dateToOffset(date: Date, rangeStart: Date, dayWidth: number): number {
    const diffMs = date.getTime() - rangeStart.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays * dayWidth
  }

  /**
   * Signed working-day difference between a baseline date and the current
   * (rencana) date. Positive = slipped later than baseline, negative = moved
   * earlier. lib/calendar.ts's workingDaysBetween(start, end, holidays) only
   * counts forward and returns 0 when start >= end, so it cannot represent
   * "earlier than baseline" on its own — this wraps it with a direction check.
   */
  export function computeDeviationDays(baselineDate: Date, actualDate: Date, holidays: Date[]): number {
    if (actualDate.getTime() === baselineDate.getTime()) return 0
    if (actualDate.getTime() > baselineDate.getTime()) {
      return workingDaysBetween(baselineDate, actualDate, holidays)
    }
    return -workingDaysBetween(actualDate, baselineDate, holidays)
  }

  export type GanttDepType = 'FS' | 'SS' | 'FF' | 'SF'

  export function dependencyAnchor(depType: GanttDepType): {
    predecessorEdge: 'start' | 'finish'
    successorEdge: 'start' | 'finish'
  } {
    switch (depType) {
      case 'FS':
        return { predecessorEdge: 'finish', successorEdge: 'start' }
      case 'SS':
        return { predecessorEdge: 'start', successorEdge: 'start' }
      case 'FF':
        return { predecessorEdge: 'finish', successorEdge: 'finish' }
      case 'SF':
        return { predecessorEdge: 'start', successorEdge: 'finish' }
    }
  }
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npm test`
  Expected: all pass (31 from before + 15 new = 46)

- [ ] **Step 5: Commit**

  ```bash
  git add lib/gantt-layout.ts lib/gantt-layout.test.ts
  git commit -m "feat: add pure timeline math for the Gantt chart"
  ```

---

## Task 3: Add shadcn `Tooltip` Primitive

**Files:**
- Create: `components/ui/tooltip.tsx` (generated)
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` — consumed by
  `GanttBar.tsx`, `GanttMilestone.tsx`, `GanttArrows.tsx` (later tasks)

- [ ] **Step 1: Run the shadcn CLI**

  ```bash
  npx shadcn@latest add tooltip
  ```
  This generates `components/ui/tooltip.tsx` matching this project's existing style (same
  pattern that added `select`, `dialog`, and Week 5's `tabs`) and adds
  `@radix-ui/react-tooltip` to `package.json`/`package-lock.json`.

- [ ] **Step 2: Verify build**

  Confirm `components/ui/tooltip.tsx` exists and exports `Tooltip`, `TooltipTrigger`,
  `TooltipContent`, `TooltipProvider`.

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add components/ui/tooltip.tsx package.json package-lock.json
  git commit -m "feat: add shadcn Tooltip primitive"
  ```

---

## Task 4: `components/gantt/gantt-constants.ts` — Shared Colors & Sizing

**Files:**
- Create: `components/gantt/gantt-constants.ts`

**Interfaces:**
- Consumes: `Phase` from `lib/types.ts`
- Produces: `PHASE_COLORS`, `BASELINE_COLOR`, `CRITICAL_COLOR`, `ROW_HEIGHT`, `BAR_HEIGHT`,
  `BAR_GAP`, `HEADER_HEIGHT`, `NAME_COLUMN_WIDTH`, `DAY_WIDTH`, `GanttViewMode` — consumed by
  every `components/gantt/*` component task below

- [ ] **Step 1: Create the file**

  ```typescript
  import type { Phase } from '@/lib/types'

  // Validated via the dataviz skill's six-checks palette validator
  // (categorical slots 1-4, fixed order — see docs/superpowers/specs/2026-07-03-minggu6-gantt-design.md).
  export const PHASE_COLORS: Record<Phase['phase_code'], string> = {
    F1: '#2a78d6',
    F2: '#1baf7a',
    F3: '#eda100',
    F4: '#008300',
  }

  export const BASELINE_COLOR = '#c3c2b7'
  export const CRITICAL_COLOR = '#d03b3b'

  export const ROW_HEIGHT = 40
  export const BAR_HEIGHT = 8
  export const BAR_GAP = 2
  export const HEADER_HEIGHT = 32
  export const NAME_COLUMN_WIDTH = 224

  export const DAY_WIDTH = {
    bulan: 4,
    minggu: 24,
  } as const

  export type GanttViewMode = keyof typeof DAY_WIDTH
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds (pure constants, no consumers yet)

- [ ] **Step 3: Commit**

  ```bash
  git add components/gantt/gantt-constants.ts
  git commit -m "feat: add Gantt color and sizing constants"
  ```

---

## Task 5: Timeline Page — Data Fetching

**Files:**
- Create: `app/(app)/dashboard/[locationCode]/timeline/page.tsx`

**Interfaces:**
- Consumes: `Dependency`, `BaselineActivitySnapshot`, `Phase` from `lib/types.ts`
- Produces: the route itself (`components/layout/Sidebar.tsx`'s existing link stops 404ing)

This task's page body is a temporary placeholder — replaced in Task 11 once `GanttChart` exists.
Building it first, alone, verifies every Supabase query and the response shape via a real
request before any rendering complexity is added on top.

- [ ] **Step 1: Create the page**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import type { Dependency, BaselineActivitySnapshot } from '@/lib/types'

  export default async function TimelinePage({ params }: { params: { locationCode: string } }) {
    const supabase = createClient()

    const { data: location } = await supabase
      .from('locations')
      .select('id, code, name')
      .eq('code', params.locationCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!location) notFound()

    const { data: phases } = await supabase
      .from('phases')
      .select(
        `
        id, location_id, phase_code, name, pic_utama, display_order,
        activities (
          id, phase_id, display_order, kegiatan, pic,
          tanggal_mulai_rencana, tanggal_selesai_rencana,
          tanggal_mulai_realisasi, tanggal_selesai_realisasi,
          status, progress_pct, catatan, is_milestone, is_on_critical_path,
          date_locked, total_float_days, created_at, updated_at
        )
      `
      )
      .eq('location_id', location.id)
      .order('display_order')
      .order('display_order', { referencedTable: 'activities' })

    const allPhases = phases ?? []
    const allActivityIds = allPhases.flatMap((p) => p.activities.map((a: { id: string }) => a.id))

    const { data: dependencyRows } = allActivityIds.length
      ? await supabase
          .from('activity_dependencies')
          .select('id, predecessor_id, successor_id, dep_type, lag_days')
          .in('predecessor_id', allActivityIds)
      : { data: [] }

    const { data: activeBaseline } = await supabase
      .from('baselines')
      .select('id, name')
      .eq('location_id', location.id)
      .eq('is_active', true)
      .maybeSingle()

    let baselineActivities: BaselineActivitySnapshot[] = []
    if (activeBaseline) {
      const { data: baselineRows } = await supabase
        .from('baseline_activities')
        .select('activity_id, kegiatan, tanggal_mulai_rencana, tanggal_selesai_rencana, is_milestone')
        .eq('baseline_id', activeBaseline.id)
      baselineActivities = baselineRows ?? []
    }

    const { data: holidayRows } = await supabase.from('work_calendar').select('holiday_date')
    const holidays = (holidayRows ?? []).map((h: { holiday_date: string }) => h.holiday_date)

    const dependencies = (dependencyRows ?? []) as Dependency[]
    const activityCount = allPhases.reduce((sum, p) => sum + p.activities.length, 0)

    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline / Gantt — {location.name}</h2>
        {/* Temporary placeholder — replaced by <GanttChart> in Task 11 once it exists. */}
        <p className="text-sm text-gray-500">
          {activityCount} kegiatan, {dependencies.length} dependensi, baseline:{' '}
          {activeBaseline ? activeBaseline.name : 'belum ada'}, {holidays.length} hari libur.
        </p>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Manual verification**

  Run: `npm run dev`, log in, click "Timeline / Gantt" in the sidebar for any location. Expected:
  the page loads (no longer 404s) and shows a real activity/dependency/baseline/holiday count
  line.

- [ ] **Step 4: Commit**

  ```bash
  git add "app/(app)/dashboard/[locationCode]/timeline/page.tsx"
  git commit -m "feat: add Timeline page data fetching"
  ```

---

## Task 6: `GanttTooltip.tsx` — Shared Tooltip Content

**Files:**
- Create: `components/gantt/GanttTooltip.tsx`

**Interfaces:**
- Consumes: `computeDeviationDays` from `lib/gantt-layout.ts` (Task 2); `Activity`,
  `BaselineActivitySnapshot`, `Dependency` from `lib/types.ts`
- Produces: `GanttBarTooltipContent`, `GanttArrowTooltipContent` — consumed by `GanttBar.tsx`,
  `GanttMilestone.tsx`, `GanttArrows.tsx` (later tasks)

- [ ] **Step 1: Create the file**

  ```typescript
  import { computeDeviationDays } from '@/lib/gantt-layout'
  import type { Activity, BaselineActivitySnapshot, Dependency } from '@/lib/types'

  const STATUS_LABELS: Record<Activity['status'], string> = {
    belum_mulai: 'Belum Mulai',
    sedang_berjalan: 'Sedang Berjalan',
    selesai: 'Selesai',
    ditunda: 'Ditunda',
  }

  interface GanttBarTooltipContentProps {
    activity: Activity
    baseline: BaselineActivitySnapshot | undefined
    holidays: Date[]
  }

  export function GanttBarTooltipContent({ activity, baseline, holidays }: GanttBarTooltipContentProps) {
    const deviation = baseline
      ? computeDeviationDays(
          new Date(baseline.tanggal_mulai_rencana),
          new Date(activity.tanggal_mulai_rencana),
          holidays
        )
      : null

    return (
      <div className="text-xs space-y-0.5 max-w-[220px]">
        <p className="font-medium">{activity.kegiatan}</p>
        <p>PIC: {activity.pic}</p>
        <p>
          Rencana: {activity.tanggal_mulai_rencana} – {activity.tanggal_selesai_rencana}
        </p>
        {baseline && deviation !== null && (
          <p>
            Baseline: {baseline.tanggal_mulai_rencana} (deviasi {deviation >= 0 ? '+' : ''}
            {deviation} hari kerja)
          </p>
        )}
        {activity.tanggal_mulai_realisasi && (
          <p>
            Realisasi: {activity.tanggal_mulai_realisasi} – {activity.tanggal_selesai_realisasi ?? '–'}
          </p>
        )}
        <p>Status: {STATUS_LABELS[activity.status]}</p>
        <p>
          {activity.is_on_critical_path
            ? 'Jalur Kritis: Ya'
            : `Float: ${activity.total_float_days} hari kerja`}
        </p>
      </div>
    )
  }

  interface GanttArrowTooltipContentProps {
    depType: Dependency['dep_type']
    lagDays: number
  }

  export function GanttArrowTooltipContent({ depType, lagDays }: GanttArrowTooltipContentProps) {
    return (
      <div className="text-xs">
        {depType} · lag {lagDays} hari
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add components/gantt/GanttTooltip.tsx
  git commit -m "feat: add Gantt tooltip content components"
  ```

---

## Task 7: `GanttBar.tsx` + `GanttMilestone.tsx` — Bar and Milestone Marks

**Files:**
- Create: `components/gantt/GanttBar.tsx`
- Create: `components/gantt/GanttMilestone.tsx`

**Interfaces:**
- Consumes: `Tooltip`/`TooltipTrigger`/`TooltipContent` from `components/ui/tooltip.tsx` (Task
  3); `GanttBarTooltipContent` from `GanttTooltip.tsx` (Task 6); `BASELINE_COLOR`,
  `CRITICAL_COLOR`, `BAR_HEIGHT` from `gantt-constants.ts` (Task 4); `Activity`,
  `BaselineActivitySnapshot` from `lib/types.ts`
- Produces: `GanttBarLayer` type, `GanttBar` component, `GanttMilestone` component — consumed by
  `GanttRow.tsx` (Task 8)

- [ ] **Step 1: Create `GanttBar.tsx`**

  ```typescript
  'use client'

  import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
  import { GanttBarTooltipContent } from './GanttTooltip'
  import { BASELINE_COLOR, CRITICAL_COLOR, BAR_HEIGHT } from './gantt-constants'
  import type { Activity, BaselineActivitySnapshot } from '@/lib/types'

  export type GanttBarLayer = 'baseline' | 'rencana' | 'realisasi'

  interface GanttBarProps {
    activity: Activity
    layer: GanttBarLayer
    left: number
    width: number
    top: number
    color: string
    baseline: BaselineActivitySnapshot | undefined
    holidays: Date[]
    highlightCritical: boolean
  }

  export function GanttBar({
    activity,
    layer,
    left,
    width,
    top,
    color,
    baseline,
    holidays,
    highlightCritical,
  }: GanttBarProps) {
    const isCriticalLayer = layer === 'rencana' && activity.is_on_critical_path && highlightCritical
    const fill = layer === 'baseline' ? BASELINE_COLOR : isCriticalLayer ? CRITICAL_COLOR : color

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute flex items-center cursor-default"
            style={{ left, width: Math.max(width, 2), height: BAR_HEIGHT + 16, top: top - 8 }}
          >
            <div
              className="w-full hover:brightness-110"
              style={{
                height: BAR_HEIGHT,
                backgroundColor: fill,
                filter: layer === 'realisasi' ? 'brightness(0.65)' : undefined,
                borderRadius: BAR_HEIGHT / 2,
              }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <GanttBarTooltipContent activity={activity} baseline={baseline} holidays={holidays} />
        </TooltipContent>
      </Tooltip>
    )
  }
  ```

- [ ] **Step 2: Create `GanttMilestone.tsx`**

  ```typescript
  'use client'

  import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
  import { GanttBarTooltipContent } from './GanttTooltip'
  import { CRITICAL_COLOR } from './gantt-constants'
  import type { Activity, BaselineActivitySnapshot } from '@/lib/types'

  interface GanttMilestoneProps {
    activity: Activity
    left: number
    baseline: BaselineActivitySnapshot | undefined
    holidays: Date[]
    highlightCritical: boolean
  }

  export function GanttMilestone({ activity, left, baseline, holidays, highlightCritical }: GanttMilestoneProps) {
    const isCritical = activity.is_on_critical_path && highlightCritical
    const color = isCritical ? CRITICAL_COLOR : '#0b0b0b'

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute flex items-center justify-center cursor-default"
            style={{ left: left - 8, width: 16, height: 24, top: 8 }}
          >
            <div style={{ width: 10, height: 10, backgroundColor: color, transform: 'rotate(45deg)' }} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <GanttBarTooltipContent activity={activity} baseline={baseline} holidays={holidays} />
        </TooltipContent>
      </Tooltip>
    )
  }
  ```

- [ ] **Step 3: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 4: Commit**

  ```bash
  git add components/gantt/GanttBar.tsx components/gantt/GanttMilestone.tsx
  git commit -m "feat: add Gantt bar and milestone mark components"
  ```

---

## Task 8: `GanttRow.tsx` — One Row's Bars/Milestone

**Files:**
- Create: `components/gantt/GanttRow.tsx`

**Interfaces:**
- Consumes: `GanttBar`, `GanttBarLayer` from `GanttBar.tsx`; `GanttMilestone` from
  `GanttMilestone.tsx` (Task 7); `dateToOffset` from `lib/gantt-layout.ts` (Task 2);
  `PHASE_COLORS`, `ROW_HEIGHT`, `BAR_HEIGHT`, `BAR_GAP` from `gantt-constants.ts` (Task 4)
- Produces: `GanttRow` component — consumed by `GanttChart.tsx` (Task 11)

- [ ] **Step 1: Create the file**

  ```typescript
  'use client'

  import { GanttBar, type GanttBarLayer } from './GanttBar'
  import { GanttMilestone } from './GanttMilestone'
  import { dateToOffset } from '@/lib/gantt-layout'
  import { PHASE_COLORS, ROW_HEIGHT, BAR_HEIGHT, BAR_GAP } from './gantt-constants'
  import type { Activity, BaselineActivitySnapshot, Phase } from '@/lib/types'

  interface GanttRowProps {
    activity: Activity
    phaseCode: Phase['phase_code']
    baseline: BaselineActivitySnapshot | undefined
    rangeStart: Date
    dayWidth: number
    holidays: Date[]
    showBaseline: boolean
    highlightCritical: boolean
  }

  interface Lane {
    layer: GanttBarLayer
    left: number
    width: number
  }

  export function GanttRow({
    activity,
    phaseCode,
    baseline,
    rangeStart,
    dayWidth,
    holidays,
    showBaseline,
    highlightCritical,
  }: GanttRowProps) {
    const color = PHASE_COLORS[phaseCode]

    if (activity.is_milestone) {
      const left = dateToOffset(new Date(activity.tanggal_mulai_rencana), rangeStart, dayWidth)
      return (
        <div className="relative" style={{ height: ROW_HEIGHT }}>
          <GanttMilestone
            activity={activity}
            left={left}
            baseline={baseline}
            holidays={holidays}
            highlightCritical={highlightCritical}
          />
        </div>
      )
    }

    const lanes: Lane[] = []

    if (showBaseline && baseline) {
      const left = dateToOffset(new Date(baseline.tanggal_mulai_rencana), rangeStart, dayWidth)
      const width = dateToOffset(new Date(baseline.tanggal_selesai_rencana), rangeStart, dayWidth) - left
      lanes.push({ layer: 'baseline', left, width })
    }

    const rencanaLeft = dateToOffset(new Date(activity.tanggal_mulai_rencana), rangeStart, dayWidth)
    const rencanaWidth =
      dateToOffset(new Date(activity.tanggal_selesai_rencana), rangeStart, dayWidth) - rencanaLeft
    lanes.push({ layer: 'rencana', left: rencanaLeft, width: rencanaWidth })

    if (activity.tanggal_mulai_realisasi && activity.tanggal_selesai_realisasi) {
      const left = dateToOffset(new Date(activity.tanggal_mulai_realisasi), rangeStart, dayWidth)
      const width =
        dateToOffset(new Date(activity.tanggal_selesai_realisasi), rangeStart, dayWidth) - left
      lanes.push({ layer: 'realisasi', left, width })
    }

    const stackHeight = lanes.length * BAR_HEIGHT + (lanes.length - 1) * BAR_GAP
    const stackTop = (ROW_HEIGHT - stackHeight) / 2

    return (
      <div className="relative" style={{ height: ROW_HEIGHT }}>
        {lanes.map((lane, index) => (
          <GanttBar
            key={lane.layer}
            activity={activity}
            layer={lane.layer}
            left={lane.left}
            width={lane.width}
            top={stackTop + index * (BAR_HEIGHT + BAR_GAP)}
            color={color}
            baseline={baseline}
            holidays={holidays}
            highlightCritical={highlightCritical}
          />
        ))}
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add components/gantt/GanttRow.tsx
  git commit -m "feat: add GanttRow composing bars and milestones"
  ```

---

## Task 9: `GanttArrows.tsx` — Dependency Arrow SVG Overlay

**Files:**
- Create: `components/gantt/GanttArrows.tsx`

**Interfaces:**
- Consumes: `Tooltip`/`TooltipTrigger`/`TooltipContent` from `components/ui/tooltip.tsx` (Task
  3); `GanttArrowTooltipContent` from `GanttTooltip.tsx` (Task 6); `dateToOffset`,
  `dependencyAnchor` from `lib/gantt-layout.ts` (Task 2); `ROW_HEIGHT`, `CRITICAL_COLOR`,
  `BASELINE_COLOR` from `gantt-constants.ts` (Task 4); `Activity`, `Dependency` from
  `lib/types.ts`
- Produces: `GanttArrows` component — consumed by `GanttChart.tsx` (Task 11)

- [ ] **Step 1: Create the file**

  ```typescript
  'use client'

  import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
  import { GanttArrowTooltipContent } from './GanttTooltip'
  import { dateToOffset, dependencyAnchor } from '@/lib/gantt-layout'
  import { ROW_HEIGHT, CRITICAL_COLOR, BASELINE_COLOR } from './gantt-constants'
  import type { Activity, Dependency } from '@/lib/types'

  interface GanttArrowsProps {
    activities: Activity[]
    dependencies: Dependency[]
    rangeStart: Date
    dayWidth: number
    totalWidth: number
    totalHeight: number
    highlightCritical: boolean
  }

  function edgeX(activity: Activity, edge: 'start' | 'finish', rangeStart: Date, dayWidth: number): number {
    const dateStr = edge === 'start' ? activity.tanggal_mulai_rencana : activity.tanggal_selesai_rencana
    return dateToOffset(new Date(dateStr), rangeStart, dayWidth)
  }

  export function GanttArrows({
    activities,
    dependencies,
    rangeStart,
    dayWidth,
    totalWidth,
    totalHeight,
    highlightCritical,
  }: GanttArrowsProps) {
    const activityById = new Map(activities.map((a) => [a.id, a]))
    const activityIndex = new Map(activities.map((a, i) => [a.id, i]))

    return (
      <svg
        className="absolute left-0 top-0 pointer-events-none"
        width={totalWidth}
        height={totalHeight}
      >
        <defs>
          <marker id="gantt-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#898781" />
          </marker>
        </defs>
        {dependencies.map((dep) => {
          const predecessor = activityById.get(dep.predecessor_id)
          const successor = activityById.get(dep.successor_id)
          const predIndex = activityIndex.get(dep.predecessor_id)
          const succIndex = activityIndex.get(dep.successor_id)
          if (!predecessor || !successor || predIndex === undefined || succIndex === undefined) return null

          const anchor = dependencyAnchor(dep.dep_type)
          const x1 = edgeX(predecessor, anchor.predecessorEdge, rangeStart, dayWidth)
          const x2 = edgeX(successor, anchor.successorEdge, rangeStart, dayWidth)
          const y1 = predIndex * ROW_HEIGHT + ROW_HEIGHT / 2
          const y2 = succIndex * ROW_HEIGHT + ROW_HEIGHT / 2
          const isCritical =
            highlightCritical && predecessor.is_on_critical_path && successor.is_on_critical_path
          const pathD = `M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x2 - 10} ${y2} L ${x2} ${y2}`

          return (
            <Tooltip key={dep.id}>
              <TooltipTrigger asChild>
                <g className="pointer-events-auto cursor-default">
                  <path d={pathD} fill="none" stroke="transparent" strokeWidth={10} />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isCritical ? CRITICAL_COLOR : BASELINE_COLOR}
                    strokeWidth={1.5}
                    markerEnd="url(#gantt-arrowhead)"
                  />
                </g>
              </TooltipTrigger>
              <TooltipContent>
                <GanttArrowTooltipContent depType={dep.dep_type} lagDays={dep.lag_days} />
              </TooltipContent>
            </Tooltip>
          )
        })}
      </svg>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add components/gantt/GanttArrows.tsx
  git commit -m "feat: add Gantt dependency arrow SVG overlay"
  ```

---

## Task 10: `GanttControls.tsx` — Toggles and Phase Legend

**Files:**
- Create: `components/gantt/GanttControls.tsx`

**Interfaces:**
- Consumes: `Tabs`/`TabsList`/`TabsTrigger` from `components/ui/tabs.tsx` (Week 5);
  `PHASE_COLORS`, `GanttViewMode` from `gantt-constants.ts` (Task 4); `Phase` from
  `lib/types.ts`
- Produces: `GanttControls` component — consumed by `GanttChart.tsx` (Task 11)

- [ ] **Step 1: Create the file**

  ```typescript
  'use client'

  import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
  import { PHASE_COLORS, type GanttViewMode } from './gantt-constants'
  import type { Phase } from '@/lib/types'

  const PHASE_LABELS: Record<Phase['phase_code'], string> = {
    F1: 'Fase 1',
    F2: 'Fase 2',
    F3: 'Fase 3',
    F4: 'Fase 4',
  }

  interface GanttControlsProps {
    viewMode: GanttViewMode
    onViewModeChange: (mode: GanttViewMode) => void
    showBaseline: boolean
    onShowBaselineChange: (value: boolean) => void
    showDependencies: boolean
    onShowDependenciesChange: (value: boolean) => void
    showCriticalHighlight: boolean
    onShowCriticalHighlightChange: (value: boolean) => void
  }

  export function GanttControls({
    viewMode,
    onViewModeChange,
    showBaseline,
    onShowBaselineChange,
    showDependencies,
    onShowDependenciesChange,
    showCriticalHighlight,
    onShowCriticalHighlightChange,
  }: GanttControlsProps) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-4">
          <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as GanttViewMode)}>
            <TabsList>
              <TabsTrigger value="bulan">Tampilan Bulan</TabsTrigger>
              <TabsTrigger value="minggu">Tampilan Minggu</TabsTrigger>
            </TabsList>
          </Tabs>

          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showBaseline}
              onChange={(e) => onShowBaselineChange(e.target.checked)}
            />
            Tampilkan Baseline
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showDependencies}
              onChange={(e) => onShowDependenciesChange(e.target.checked)}
            />
            Tampilkan Panah Dependensi
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showCriticalHighlight}
              onChange={(e) => onShowCriticalHighlightChange(e.target.checked)}
            />
            Highlight Jalur Kritis
          </label>
        </div>

        <div className="flex items-center gap-3">
          {(Object.keys(PHASE_COLORS) as Array<Phase['phase_code']>).map((code) => (
            <span key={code} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: PHASE_COLORS[code] }}
              />
              {PHASE_LABELS[code]}
            </span>
          ))}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add components/gantt/GanttControls.tsx
  git commit -m "feat: add Gantt view/toggle controls and phase legend"
  ```

---

## Task 11: `GanttChart.tsx` — Wire Everything Together

**Files:**
- Create: `components/gantt/GanttChart.tsx`
- Modify: `app/(app)/dashboard/[locationCode]/timeline/page.tsx`

**Interfaces:**
- Consumes: `computeDateRange`, `dateToOffset` from `lib/gantt-layout.ts` (Task 2);
  `GanttControls` (Task 10); `GanttRow` (Task 8); `GanttArrows` (Task 9); `DAY_WIDTH`,
  `ROW_HEIGHT`, `HEADER_HEIGHT`, `NAME_COLUMN_WIDTH`, `GanttViewMode` from
  `gantt-constants.ts` (Task 4); `Phase`, `Activity`, `Dependency`, `BaselineActivitySnapshot`
  from `lib/types.ts`
- Produces: `GanttChart` component — this task's Step 2 replaces Task 5's placeholder page body
  with a real render of it

- [ ] **Step 1: Create `GanttChart.tsx`**

  ```typescript
  'use client'

  import { useMemo, useState } from 'react'
  import { addDays } from 'date-fns'
  import { cn } from '@/lib/utils'
  import { computeDateRange, dateToOffset } from '@/lib/gantt-layout'
  import { GanttControls } from './GanttControls'
  import { GanttRow } from './GanttRow'
  import { GanttArrows } from './GanttArrows'
  import { DAY_WIDTH, ROW_HEIGHT, HEADER_HEIGHT, NAME_COLUMN_WIDTH, type GanttViewMode } from './gantt-constants'
  import type { Phase, Activity, Dependency, BaselineActivitySnapshot } from '@/lib/types'

  interface GanttChartProps {
    phases: Phase[]
    dependencies: Dependency[]
    baselineActivities: BaselineActivitySnapshot[]
    holidays: string[]
  }

  interface FlatActivity {
    activity: Activity
    phaseCode: Phase['phase_code']
  }

  export function GanttChart({ phases, dependencies, baselineActivities, holidays }: GanttChartProps) {
    const [viewMode, setViewMode] = useState<GanttViewMode>('bulan')
    const [showBaseline, setShowBaseline] = useState(true)
    const [showDependencies, setShowDependencies] = useState(true)
    const [showCriticalHighlight, setShowCriticalHighlight] = useState(true)

    const flatActivities: FlatActivity[] = useMemo(
      () =>
        phases.flatMap((phase) =>
          phase.activities.map((activity) => ({ activity, phaseCode: phase.phase_code }))
        ),
      [phases]
    )

    const baselineByActivityId = useMemo(
      () => new Map(baselineActivities.map((b) => [b.activity_id, b])),
      [baselineActivities]
    )

    const holidayDates = useMemo(() => holidays.map((h) => new Date(h)), [holidays])

    const dateRange = useMemo(
      () => computeDateRange(flatActivities.map((f) => f.activity), baselineActivities),
      [flatActivities, baselineActivities]
    )

    const dayWidth = DAY_WIDTH[viewMode]
    const totalDays = Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    )
    const totalWidth = Math.max(totalDays * dayWidth, 1)
    const totalHeight = flatActivities.length * ROW_HEIGHT
    const activitiesForArrows = flatActivities.map((f) => f.activity)

    const months = useMemo(() => {
      const result: { label: string; left: number; width: number; isCurrent: boolean }[] = []
      let cursor = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1)
      const now = new Date()
      while (cursor < dateRange.end) {
        const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
        const segmentStart = cursor < dateRange.start ? dateRange.start : cursor
        const segmentEnd = nextMonth > dateRange.end ? dateRange.end : nextMonth
        const left = dateToOffset(segmentStart, dateRange.start, dayWidth)
        const width = dateToOffset(segmentEnd, dateRange.start, dayWidth) - left
        result.push({
          label: cursor.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
          left,
          width,
          isCurrent: cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth(),
        })
        cursor = nextMonth
      }
      return result
    }, [dateRange, dayWidth])

    const weekendStrips = useMemo(() => {
      if (viewMode !== 'minggu') return []
      const strips: { left: number; width: number }[] = []
      let cursor = new Date(dateRange.start)
      while (cursor < dateRange.end) {
        const day = cursor.getDay()
        if (day === 0 || day === 6) {
          strips.push({ left: dateToOffset(cursor, dateRange.start, dayWidth), width: dayWidth })
        }
        cursor = addDays(cursor, 1)
      }
      return strips
    }, [dateRange, dayWidth, viewMode])

    return (
      <div>
        <GanttControls
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showBaseline={showBaseline}
          onShowBaselineChange={setShowBaseline}
          showDependencies={showDependencies}
          onShowDependenciesChange={setShowDependencies}
          showCriticalHighlight={showCriticalHighlight}
          onShowCriticalHighlightChange={setShowCriticalHighlight}
        />
        <div className="flex border border-gray-200 rounded-md overflow-hidden">
          <div
            className="flex-shrink-0 border-r border-gray-200 bg-white z-10"
            style={{ width: NAME_COLUMN_WIDTH }}
          >
            <div style={{ height: HEADER_HEIGHT }} className="border-b border-gray-200 bg-gray-50" />
            {flatActivities.map(({ activity }) => (
              <div
                key={activity.id}
                style={{ height: ROW_HEIGHT }}
                className="flex items-center px-2 text-sm border-b border-gray-100 truncate"
              >
                {activity.is_on_critical_path && showCriticalHighlight && <span className="mr-1">🔴</span>}
                {activity.kegiatan}
              </div>
            ))}
          </div>

          <div className="overflow-x-auto flex-1">
            <div style={{ width: totalWidth }}>
              <div style={{ height: HEADER_HEIGHT }} className="relative bg-gray-50 border-b border-gray-200">
                {months.map((m) => (
                  <div
                    key={`${m.label}-${m.left}`}
                    className={cn(
                      'absolute top-0 h-full flex items-center px-1 text-xs text-gray-500 border-r border-gray-200',
                      m.isCurrent && 'bg-gray-200/70 font-medium text-gray-700'
                    )}
                    style={{ left: m.left, width: m.width }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              <div className="relative">
                {weekendStrips.map((s, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bg-gray-100/60 pointer-events-none"
                    style={{ left: s.left, width: s.width, height: totalHeight }}
                  />
                ))}

                {flatActivities.map(({ activity, phaseCode }) => (
                  <GanttRow
                    key={activity.id}
                    activity={activity}
                    phaseCode={phaseCode}
                    baseline={baselineByActivityId.get(activity.id)}
                    rangeStart={dateRange.start}
                    dayWidth={dayWidth}
                    holidays={holidayDates}
                    showBaseline={showBaseline}
                    highlightCritical={showCriticalHighlight}
                  />
                ))}

                {showDependencies && (
                  <GanttArrows
                    activities={activitiesForArrows}
                    dependencies={dependencies}
                    rangeStart={dateRange.start}
                    dayWidth={dayWidth}
                    totalWidth={totalWidth}
                    totalHeight={totalHeight}
                    highlightCritical={showCriticalHighlight}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Replace the Task 5 placeholder in `page.tsx`**

  In `app/(app)/dashboard/[locationCode]/timeline/page.tsx`, add the import:
  ```typescript
  import { GanttChart } from '@/components/gantt/GanttChart'
  ```

  Change:
  ```typescript
      const dependencies = (dependencyRows ?? []) as Dependency[]
      const activityCount = allPhases.reduce((sum, p) => sum + p.activities.length, 0)

      return (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline / Gantt — {location.name}</h2>
          {/* Temporary placeholder — replaced by <GanttChart> in Task 11 once it exists. */}
          <p className="text-sm text-gray-500">
            {activityCount} kegiatan, {dependencies.length} dependensi, baseline:{' '}
            {activeBaseline ? activeBaseline.name : 'belum ada'}, {holidays.length} hari libur.
          </p>
        </div>
      )
  ```
  to:
  ```typescript
      const dependencies = (dependencyRows ?? []) as Dependency[]

      return (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline / Gantt — {location.name}</h2>
          <GanttChart
            phases={allPhases}
            dependencies={dependencies}
            baselineActivities={baselineActivities}
            holidays={holidays}
          />
        </div>
      )
  ```

- [ ] **Step 3: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 4: Manual browser verification**

  Run: `npm run dev`, log in, open the Timeline page for a location with several activities
  across at least 2 phases, at least one dependency, and at least one milestone (`is_milestone`).
  - Confirm bars render roughly where expected relative to their dates.
  - Toggle "Tampilkan Baseline" — since no location has a baseline yet, this should have no
    visible effect (nothing to show either way) — confirmed via `POST
    /api/locations/[locationId]/baselines` in Task 12's E2E pass, not here.
  - Toggle "Tampilkan Panah Dependensi" off/on — arrows should disappear/reappear.
  - Toggle "Highlight Jalur Kritis" off/on — a critical activity's bar should lose/regain its red
    color and the 🔴 prefix in the name column.
  - Hover a bar — confirm the tooltip shows name/PIC/rencana/status/float.
  - Hover a dependency arrow — confirm the tooltip shows type + lag.
  - Confirm a milestone activity renders as a ♦-style diamond, not a bar.
  - Switch to "Tampilan Minggu" — confirm the timeline re-scales and weekend columns get a subtle
    shaded strip.

- [ ] **Step 5: Commit**

  ```bash
  git add components/gantt/GanttChart.tsx "app/(app)/dashboard/[locationCode]/timeline/page.tsx"
  git commit -m "feat: wire GanttChart into the Timeline page"
  ```

---

## Task 12: Final Real-Browser E2E Pass and Progress Ledger

**Files:**
- Modify: `.superpowers/sdd/progress.md`

No code changes — this task re-verifies the full feature end-to-end with a real headless browser
(the approach Week 5's Task 7 used successfully, since `chromium-cli` isn't available in this
environment — drive Playwright's `chromium` module directly, Chromium is already downloaded at
`%LOCALAPPDATA%\ms-playwright\chromium-1223`), including the one scenario Task 11 couldn't cover
(an actual baseline, since none exists yet).

- [ ] **Step 1: Create a baseline for a test location**

  Using a location with at least 2 activities (create one via `POST /api/locations` if needed,
  same approach used in Weeks 4-6's own verification passes):
  ```bash
  curl -s -b /tmp/gantt-cookies.txt -X POST "http://localhost:3000/api/locations/LOCATION_ID/baselines" \
    -H "Content-Type: application/json" \
    -d '{"name":"Baseline Awal","description":"E2E test baseline"}'
  ```
  Expected: `201`. Then change one activity's plan dates via `PATCH /api/activities/ACT_ID` so a
  visible deviation exists between its baseline snapshot and its current rencana dates.

- [ ] **Step 2: Real-browser pass**

  Write a throwaway Playwright script (Node, using the `chromium` module directly) to:
  - Log in as admin, navigate to the test location's Timeline page.
  - Confirm 3 stacked bars render for the activity edited in Step 1 (baseline/rencana/realisasi
    or baseline/rencana if no realisasi), screenshot.
  - Hover that activity's rencana bar, confirm the tooltip shows a non-zero deviation number with
    the correct sign (later than baseline → positive, earlier → negative).
  - Toggle "Tampilkan Baseline" off, confirm the baseline bar disappears; toggle back on.
  - Confirm the phase legend (F1–F4 swatches) is visible.
  - Check the browser console for errors after each step.
  - Put the script and screenshots in `.superpowers/sdd/` (gitignored scratch, not committed —
    same convention as Week 5's Task 7).

- [ ] **Step 3: Clean up test data**

  Deactivate/delete the test location and baseline created in Step 1, the same way prior weeks'
  verification passes cleaned up after themselves.

- [ ] **Step 4: Run the full test suite one more time**

  Run: `npm test`
  Expected: all `lib/gantt-layout.test.ts` cases plus the existing 31 pass (46 total)

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 5: Record the outcome in the SDD progress ledger**

  Append to `.superpowers/sdd/progress.md`:
  ```markdown

  ## Week 6
  # Plan: docs/superpowers/plans/2026-07-03-minggu6-gantt.md
  # Spec: docs/superpowers/specs/2026-07-03-minggu6-gantt-design.md
  - Task 1: complete
  - Task 2: complete
  - Task 3: complete
  - Task 4: complete
  - Task 5: complete
  - Task 6: complete
  - Task 7: complete
  - Task 8: complete
  - Task 9: complete
  - Task 10: complete
  - Task 11: complete
  - Task 12: COMPLETE via real headless-Chromium Playwright E2E. [fill in actual findings here —
    any bugs found and fixed during verification, following the pattern of Weeks 1-5's ledger
    entries — do not leave this as a template]
  - Week 6 implementation COMPLETE (fill in date)
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add .superpowers/sdd/progress.md
  git commit -m "chore: record Week 6 Gantt E2E findings in SDD progress ledger"
  ```
