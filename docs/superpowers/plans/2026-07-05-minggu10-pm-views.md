# Minggu 10: PM Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three PM Views pages — Workload View (`/workload`), Kalender Kerja
(`/work-calendar`), and Weekly Summary (`/dashboard/[locationCode]/weekly-summary`) — completing
Week 10 of the 16-week milestone.

**Architecture:** Workload is a new read-only cross-location aggregation (same
`locations → phases → activities` query shape as the Week 8 landing page), driven by a new pure
`lib/workload-metrics.ts` module (Vitest-tested) that both the heatmap and the PIC cards consume.
Kalender Kerja and Weekly Summary both reuse fully-working Week 2/4 backends
(`work_calendar` CRUD, `GET .../weekly-summary`) that never had UI built for them — this week is
almost entirely UI, with one small, additive, backward-compatible extension to the
weekly-summary route (a `weekOffset` query param) so "navigasi minggu lain" works. Kalender Kerja
is this codebase's first genuine whole-page role gate (`notFound()` for non-admin/super_admin),
distinct from every prior week's per-field/per-action gating.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase JS v2 · shadcn/ui (`Select`,
`Dialog`, `Table`, `Card`, `Input`, `Label` — all already installed, no new shadcn components
needed) · date-fns v3 · sonner (toasts)

## Global Constraints

- `npm run build` must pass before every commit; `npm test` must keep passing (68 existing tests
  from Week 9 plus this week's new `lib/workload-metrics.test.ts` cases — 83 total)
- TypeScript strict — no implicit `any`
- No semicolons, single quotes — match this project's existing style exactly
- No schema, RLS, or migration changes this week
- Exactly one intentional API change this week: an additive, backward-compatible `weekOffset`
  query param on the existing `GET /api/locations/[locationId]/weekly-summary` route (Task 3) —
  every other API route is untouched
- Kalender Kerja (`/work-calendar`) is gated with `notFound()` for any non-admin/super_admin
  session, at the page level — this is the first whole-page role gate in this codebase (every
  prior week only gated individual actions/fields within an always-visible page)
- "Active" for Workload heatmap/card purposes = an activity whose
  `[tanggal_mulai_rencana, tanggal_selesai_rencana]` range overlaps the week/date-range in question
  AND whose `status !== 'selesai'`
- Every git commit message follows the existing convention: `feat:`/`fix:`/`chore:` prefix, one line
- Spec: `docs/superpowers/specs/2026-07-05-minggu10-pm-views-design.md`

---

## Task 1: `lib/workload-metrics.ts` — Pure Aggregation Functions, and `WorkloadActivity` Type

**Files:**
- Create: `lib/workload-metrics.ts`
- Create: `lib/workload-metrics.test.ts`
- Modify: `lib/types.ts` (append `WorkloadActivity` at the end of the file)

**Interfaces:**
- Consumes: `ActivityStatus` (already in `lib/types.ts`), `computeProgressPct` (already in
  `lib/dashboard-metrics.ts`, Week 8)
- Produces: `WeekColumn`, `computeWeekColumns(referenceDate: Date, weeksAhead: number):
  WeekColumn[]`, `WorkloadBand`, `getWorkloadBand(count: number): WorkloadBand`,
  `getWorkloadBandClasses(count: number): string`, `PicWorkloadRow`,
  `buildPicWorkload(activities: WorkloadActivity[], weekColumns: WeekColumn[], today: Date):
  PicWorkloadRow[]`, `getActivitiesInCell(activities: WorkloadActivity[], pic: string, week:
  WeekColumn): WorkloadActivity[]` — all consumed by `WorkloadHeatmap`/`WorkloadClient` (Tasks
  4-5) and the `/workload` page (Task 6). `WorkloadActivity` (from `lib/types.ts`) is the shared
  shape used by every Workload task.

- [ ] **Step 1: Append `WorkloadActivity` to `lib/types.ts`**

  Add at the end of `lib/types.ts` (after the existing `KkConsent` interface, and after Week 9's
  `RiskPhaseOption`):
  ```typescript

  export interface WorkloadActivity {
    id: string
    kegiatan: string
    pic: string
    status: ActivityStatus
    progress_pct: number
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    phaseCode: string
    locationCode: string
    locationName: string
  }
  ```

- [ ] **Step 2: Write the failing tests**

  Create `lib/workload-metrics.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import {
    computeWeekColumns,
    getWorkloadBand,
    buildPicWorkload,
    getActivitiesInCell,
  } from './workload-metrics'
  import type { WorkloadActivity } from './types'

  function makeActivity(overrides: Partial<WorkloadActivity> & Pick<WorkloadActivity, 'pic' | 'status' | 'tanggal_mulai_rencana' | 'tanggal_selesai_rencana'>): WorkloadActivity {
    return {
      id: 'a1',
      kegiatan: 'Kegiatan Test',
      progress_pct: 0,
      phaseCode: 'F1',
      locationCode: 'TA',
      locationName: 'Tanah Abang',
      ...overrides,
    }
  }

  describe('computeWeekColumns', () => {
    it('starts the first window on the Monday of the reference week', () => {
      const columns = computeWeekColumns(new Date('2026-07-08'), 3) // Wednesday
      expect(columns[0].start).toBe('2026-07-06') // Monday
      expect(columns[0].end).toBe('2026-07-10') // Friday
    })

    it('returns the requested number of weeks', () => {
      const columns = computeWeekColumns(new Date('2026-07-08'), 12)
      expect(columns).toHaveLength(12)
    })

    it('advances each window by 7 days', () => {
      const columns = computeWeekColumns(new Date('2026-07-08'), 2)
      expect(columns[1].start).toBe('2026-07-13')
      expect(columns[1].end).toBe('2026-07-17')
    })
  })

  describe('getWorkloadBand', () => {
    it('returns low at 0', () => expect(getWorkloadBand(0)).toBe('low'))
    it('returns low at 1', () => expect(getWorkloadBand(1)).toBe('low'))
    it('returns medium at 2', () => expect(getWorkloadBand(2)).toBe('medium'))
    it('returns medium at 3', () => expect(getWorkloadBand(3)).toBe('medium'))
    it('returns high at 4', () => expect(getWorkloadBand(4)).toBe('high'))
    it('returns high above 4', () => expect(getWorkloadBand(10)).toBe('high'))
  })

  describe('buildPicWorkload', () => {
    const today = new Date('2026-07-08')
    const weekColumns = computeWeekColumns(today, 2) // [07-06..10], [07-13..17]

    it('excludes selesai activities from activeCount and weekCounts', () => {
      const activities = [
        makeActivity({ pic: 'Budi', status: 'selesai', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-08' }),
        makeActivity({ pic: 'Budi', status: 'sedang_berjalan', tanggal_mulai_rencana: '2026-07-07', tanggal_selesai_rencana: '2026-07-09' }),
      ]
      const rows = buildPicWorkload(activities, weekColumns, today)
      expect(rows[0].activeCount).toBe(1)
      expect(rows[0].weekCounts[0]).toBe(1)
    })

    it("counts an activity in every week its date range overlaps", () => {
      const activities = [
        makeActivity({ pic: 'Citra', status: 'belum_mulai', tanggal_mulai_rencana: '2026-07-09', tanggal_selesai_rencana: '2026-07-14' }),
      ]
      const rows = buildPicWorkload(activities, weekColumns, today)
      expect(rows[0].weekCounts).toEqual([1, 1])
    })

    it('picks the earliest upcoming start date over a past-due one', () => {
      const activities = [
        makeActivity({ pic: 'Dedi', status: 'sedang_berjalan', tanggal_mulai_rencana: '2026-07-01', tanggal_selesai_rencana: '2026-07-05' }),
        makeActivity({ pic: 'Dedi', status: 'belum_mulai', tanggal_mulai_rencana: '2026-07-20', tanggal_selesai_rencana: '2026-07-25' }),
      ]
      const rows = buildPicWorkload(activities, weekColumns, today)
      expect(rows[0].nextStart).toBe('2026-07-20')
    })

    it('falls back to the earliest overall start when nothing is upcoming', () => {
      const activities = [
        makeActivity({ pic: 'Eka', status: 'sedang_berjalan', tanggal_mulai_rencana: '2026-07-01', tanggal_selesai_rencana: '2026-07-05' }),
        makeActivity({ pic: 'Eka', status: 'ditunda', tanggal_mulai_rencana: '2026-06-20', tanggal_selesai_rencana: '2026-06-25' }),
      ]
      const rows = buildPicWorkload(activities, weekColumns, today)
      expect(rows[0].nextStart).toBe('2026-06-20')
    })

    it('sorts PIC rows alphabetically', () => {
      const activities = [
        makeActivity({ pic: 'Zainal', status: 'belum_mulai', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-10' }),
        makeActivity({ pic: 'Ani', status: 'belum_mulai', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-10' }),
      ]
      const rows = buildPicWorkload(activities, weekColumns, today)
      expect(rows.map((r) => r.pic)).toEqual(['Ani', 'Zainal'])
    })
  })

  describe('getActivitiesInCell', () => {
    it('returns only activities matching pic, non-selesai, and week overlap', () => {
      const weekColumns = computeWeekColumns(new Date('2026-07-08'), 1)
      const activities = [
        makeActivity({ id: 'a1', pic: 'Budi', status: 'sedang_berjalan', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-08' }),
        makeActivity({ id: 'a2', pic: 'Budi', status: 'selesai', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-08' }),
        makeActivity({ id: 'a3', pic: 'Citra', status: 'sedang_berjalan', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-08' }),
      ]
      const result = getActivitiesInCell(activities, 'Budi', weekColumns[0])
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('a1')
    })
  })
  ```

- [ ] **Step 3: Run the test to verify it fails**

  Run: `npm test -- workload-metrics`
  Expected: FAIL — `Cannot find module './workload-metrics'`

- [ ] **Step 4: Write `lib/workload-metrics.ts`**

  ```typescript
  import { addDays, startOfWeek, format } from 'date-fns'
  import { computeProgressPct } from './dashboard-metrics'
  import type { WorkloadActivity } from './types'

  export interface WeekColumn {
    start: string
    end: string
    label: string
  }

  export function computeWeekColumns(referenceDate: Date, weeksAhead: number): WeekColumn[] {
    const firstMonday = startOfWeek(referenceDate, { weekStartsOn: 1 })
    const columns: WeekColumn[] = []
    for (let i = 0; i < weeksAhead; i++) {
      const monday = addDays(firstMonday, i * 7)
      const friday = addDays(monday, 4)
      columns.push({
        start: format(monday, 'yyyy-MM-dd'),
        end: format(friday, 'yyyy-MM-dd'),
        label: `${format(monday, 'd MMM')} – ${format(friday, 'd MMM')}`,
      })
    }
    return columns
  }

  function overlapsWeek(activity: WorkloadActivity, week: WeekColumn): boolean {
    return activity.tanggal_mulai_rencana <= week.end && activity.tanggal_selesai_rencana >= week.start
  }

  export type WorkloadBand = 'low' | 'medium' | 'high'

  export function getWorkloadBand(count: number): WorkloadBand {
    if (count <= 1) return 'low'
    if (count <= 3) return 'medium'
    return 'high'
  }

  export function getWorkloadBandClasses(count: number): string {
    const band = getWorkloadBand(count)
    if (band === 'low') return 'bg-green-50 text-green-600 border-green-200'
    if (band === 'medium') return 'bg-amber-50 text-amber-600 border-amber-200'
    return 'bg-red-50 text-red-600 border-red-200'
  }

  export interface PicWorkloadRow {
    pic: string
    activeCount: number
    nextStart: string | null
    avgProgress: number
    weekCounts: number[]
  }

  export function buildPicWorkload(
    activities: WorkloadActivity[],
    weekColumns: WeekColumn[],
    today: Date
  ): PicWorkloadRow[] {
    const todayStr = format(today, 'yyyy-MM-dd')
    const pics = Array.from(new Set(activities.map((a) => a.pic))).sort()

    return pics.map((pic) => {
      const picActivities = activities.filter((a) => a.pic === pic)
      const nonSelesai = picActivities.filter((a) => a.status !== 'selesai')

      const upcoming = nonSelesai
        .filter((a) => a.tanggal_mulai_rencana >= todayStr)
        .sort((a, b) => a.tanggal_mulai_rencana.localeCompare(b.tanggal_mulai_rencana))
      const earliestOverall = nonSelesai
        .slice()
        .sort((a, b) => a.tanggal_mulai_rencana.localeCompare(b.tanggal_mulai_rencana))

      const nextStart =
        upcoming.length > 0
          ? upcoming[0].tanggal_mulai_rencana
          : earliestOverall.length > 0
            ? earliestOverall[0].tanggal_mulai_rencana
            : null

      return {
        pic,
        activeCount: nonSelesai.length,
        nextStart,
        avgProgress: computeProgressPct(picActivities),
        weekCounts: weekColumns.map((week) => nonSelesai.filter((a) => overlapsWeek(a, week)).length),
      }
    })
  }

  export function getActivitiesInCell(
    activities: WorkloadActivity[],
    pic: string,
    week: WeekColumn
  ): WorkloadActivity[] {
    return activities.filter((a) => a.pic === pic && a.status !== 'selesai' && overlapsWeek(a, week))
  }
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npm test -- workload-metrics`
  Expected: PASS — 15/15 tests passing

- [ ] **Step 6: Run the full test suite and build**

  Run: `npm test`
  Expected: 83 passing (68 existing + 15 new)

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 7: Commit**

  ```bash
  git add lib/workload-metrics.ts lib/workload-metrics.test.ts lib/types.ts
  git commit -m "feat: add workload aggregation utilities and WorkloadActivity type"
  ```

---

## Task 2: `lib/national-holidays.ts` — Static National Holiday Data

**Files:**
- Create: `lib/national-holidays.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `NationalHoliday`, `NATIONAL_HOLIDAYS: Record<2026 | 2027, NationalHoliday[]>` —
  consumed by `ImportNationalHolidaysButton` (Task 8)

This is static reference data with no logic — no test file, same precedent as `PHASE_COLORS` in
`components/gantt/gantt-constants.ts` (a plain constant, nothing to unit-test). The data below is
copied verbatim from `supabase/seed.sql`'s "WORK CALENDAR — Libur Nasional 2026-2027" block — do
not alter any date or name.

- [ ] **Step 1: Create the file**

  ```typescript
  export interface NationalHoliday {
    holiday_date: string
    name: string
  }

  export const NATIONAL_HOLIDAYS: Record<2026 | 2027, NationalHoliday[]> = {
    2026: [
      { holiday_date: '2026-01-01', name: 'Tahun Baru Masehi 2026' },
      { holiday_date: '2026-01-29', name: 'Tahun Baru Imlek 2577 Kong Zi' },
      { holiday_date: '2026-02-18', name: 'Isra Mikraj Nabi Muhammad SAW 1447 H' },
      { holiday_date: '2026-03-22', name: 'Hari Suci Nyepi – Tahun Baru Saka 1948' },
      { holiday_date: '2026-04-03', name: 'Wafat Isa Al Masih' },
      { holiday_date: '2026-04-20', name: 'Cuti Bersama Idul Fitri 1447 H' },
      { holiday_date: '2026-04-21', name: 'Hari Raya Idul Fitri 1447 H' },
      { holiday_date: '2026-04-22', name: 'Hari Raya Idul Fitri 1447 H Hari ke-2' },
      { holiday_date: '2026-04-23', name: 'Cuti Bersama Idul Fitri 1447 H' },
      { holiday_date: '2026-04-24', name: 'Cuti Bersama Idul Fitri 1447 H' },
      { holiday_date: '2026-05-14', name: 'Kenaikan Yesus Kristus' },
      { holiday_date: '2026-05-23', name: 'Hari Raya Waisak 2570 BE' },
      { holiday_date: '2026-06-06', name: 'Hari Raya Idul Adha 1447 H' },
      { holiday_date: '2026-06-26', name: 'Tahun Baru Islam 1448 H' },
      { holiday_date: '2026-08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
      { holiday_date: '2026-09-04', name: 'Maulid Nabi Muhammad SAW 1448 H' },
      { holiday_date: '2026-12-25', name: 'Hari Raya Natal' },
      { holiday_date: '2026-12-26', name: 'Cuti Bersama Natal' },
    ],
    2027: [
      { holiday_date: '2027-01-01', name: 'Tahun Baru Masehi 2027' },
      { holiday_date: '2027-01-17', name: 'Tahun Baru Imlek 2578 Kong Zi' },
      { holiday_date: '2027-02-07', name: 'Isra Mikraj Nabi Muhammad SAW 1448 H' },
      { holiday_date: '2027-03-11', name: 'Hari Suci Nyepi – Tahun Baru Saka 1949' },
      { holiday_date: '2027-03-26', name: 'Wafat Isa Al Masih' },
      { holiday_date: '2027-04-10', name: 'Hari Raya Idul Fitri 1448 H' },
      { holiday_date: '2027-04-11', name: 'Hari Raya Idul Fitri 1448 H Hari ke-2' },
      { holiday_date: '2027-05-03', name: 'Kenaikan Yesus Kristus' },
      { holiday_date: '2027-05-12', name: 'Hari Raya Waisak 2571 BE' },
      { holiday_date: '2027-05-27', name: 'Hari Raya Idul Adha 1448 H' },
      { holiday_date: '2027-06-15', name: 'Tahun Baru Islam 1449 H' },
      { holiday_date: '2027-08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
      { holiday_date: '2027-08-24', name: 'Maulid Nabi Muhammad SAW 1449 H' },
      { holiday_date: '2027-12-25', name: 'Hari Raya Natal' },
      { holiday_date: '2027-12-26', name: 'Cuti Bersama Natal' },
    ],
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add lib/national-holidays.ts
  git commit -m "feat: add national holiday reference data for 2026-2027"
  ```

---

## Task 3: `weekOffset` Extension to the Weekly Summary API

**Files:**
- Modify: `app/api/locations/[locationId]/weekly-summary/route.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: the route now accepts an optional `?weekOffset=N` query param (integer, default `0`)
  — consumed by `WeeklySummaryClient` (Task 11)

Read the current file first — it's 135 lines, already fully working. You are making one small,
targeted change: shift the reference date used for every week/overdue calculation by
`7 * weekOffset` days. Do not change anything else in this file (the WhatsApp text generation,
the 4-panel filtering logic, and the response shape all stay exactly as they are).

- [ ] **Step 1: Add the `weekOffset` param and shift the reference date**

  In `app/api/locations/[locationId]/weekly-summary/route.ts`, find this block near the top of
  `GET`:
  ```typescript
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monday = startOfWeek(today, { weekStartsOn: 1 })
    const sunday = endOfWeek(today, { weekStartsOn: 1 })
    const nextMonday = addDays(monday, 7)
    const nextSunday = addDays(sunday, 7)
  ```
  Replace it with:
  ```typescript
    const weekOffsetParam = request.nextUrl.searchParams.get('weekOffset')
    const weekOffset = weekOffsetParam ? parseInt(weekOffsetParam, 10) || 0 : 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const referenceToday = addDays(today, weekOffset * 7)
    const monday = startOfWeek(referenceToday, { weekStartsOn: 1 })
    const sunday = endOfWeek(referenceToday, { weekStartsOn: 1 })
    const nextMonday = addDays(monday, 7)
    const nextSunday = addDays(sunday, 7)
  ```

  Then find this line further down (inside the `terlambat` filter):
  ```typescript
      return isBefore(parseISO(a.tanggal_selesai_rencana), today)
  ```
  Replace it with:
  ```typescript
      return isBefore(parseISO(a.tanggal_selesai_rencana), referenceToday)
  ```

  These are the only two edits. Every other line — including `selesai_minggu_ini`'s
  `isWithinInterval(updated, { start: monday, end: sunday })` check, the WhatsApp text assembly,
  and the JSON response shape — is unchanged, since `monday`/`sunday`/`nextMonday`/`nextSunday`
  already flow from the (now-shiftable) reference date.

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add "app/api/locations/[locationId]/weekly-summary/route.ts"
  git commit -m "feat: add weekOffset param to weekly-summary API for week navigation"
  ```

---

## Task 4: `components/workload/WorkloadHeatmap.tsx`

**Files:**
- Create: `components/workload/WorkloadHeatmap.tsx`

**Interfaces:**
- Consumes: `getWorkloadBandClasses`, `getActivitiesInCell`, `WeekColumn`, `PicWorkloadRow` (Task
  1, `lib/workload-metrics.ts`), `WorkloadActivity` (Task 1, `lib/types.ts`), `cn`
  (`lib/utils.ts`), `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`, `Table`/`TableBody`/
  `TableCell`/`TableHead`/`TableHeader`/`TableRow` (`components/ui/*`)
- Produces: `WorkloadHeatmap({ rows, weekColumns, activities }: WorkloadHeatmapProps)` — consumed
  by `WorkloadClient` (Task 5)

Self-contained: owns its own "which cell is selected" state internally (no lifting to the parent
needed — unlike Week 9's Risk Matrix, this heatmap's click only opens a detail popup, it doesn't
filter a sibling component).

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useState } from 'react'
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
  import { cn } from '@/lib/utils'
  import { getWorkloadBandClasses, getActivitiesInCell, type WeekColumn, type PicWorkloadRow } from '@/lib/workload-metrics'
  import type { WorkloadActivity } from '@/lib/types'

  interface WorkloadHeatmapProps {
    rows: PicWorkloadRow[]
    weekColumns: WeekColumn[]
    activities: WorkloadActivity[]
  }

  export function WorkloadHeatmap({ rows, weekColumns, activities }: WorkloadHeatmapProps) {
    const [selectedCell, setSelectedCell] = useState<{ pic: string; week: WeekColumn } | null>(null)

    if (rows.length === 0) {
      return <p className="text-sm text-gray-500">Tidak ada data PIC untuk ditampilkan.</p>
    }

    const cellActivities = selectedCell
      ? getActivitiesInCell(activities, selectedCell.pic, selectedCell.week)
      : []

    return (
      <>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-white">PIC</TableHead>
                {weekColumns.map((week) => (
                  <TableHead key={week.start} className="text-center whitespace-nowrap">
                    {week.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.pic}>
                  <TableCell className="sticky left-0 bg-white font-medium">{row.pic}</TableCell>
                  {row.weekCounts.map((count, i) => (
                    <TableCell key={weekColumns[i].start} className="text-center p-1">
                      <button
                        type="button"
                        onClick={() => count > 0 && setSelectedCell({ pic: row.pic, week: weekColumns[i] })}
                        className={cn(
                          'w-full h-9 flex items-center justify-center text-sm font-semibold rounded-md border transition-colors',
                          getWorkloadBandClasses(count)
                        )}
                      >
                        {count > 0 ? count : ''}
                      </button>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={selectedCell !== null} onOpenChange={(open) => !open && setSelectedCell(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedCell ? `${selectedCell.pic} — ${selectedCell.week.label}` : ''}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {cellActivities.length === 0 ? (
                <p className="text-sm text-gray-500">Tidak ada kegiatan.</p>
              ) : (
                cellActivities.map((a) => (
                  <div key={a.id} className="text-sm border rounded-md p-2">
                    <div className="font-medium">{a.kegiatan}</div>
                    <div className="text-gray-500 text-xs">
                      {a.locationName} ({a.locationCode}) — {a.phaseCode}
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/workload/WorkloadHeatmap.tsx
  git commit -m "feat: add WorkloadHeatmap component"
  ```

---

## Task 5: `components/workload/WorkloadClient.tsx`

**Files:**
- Create: `components/workload/WorkloadClient.tsx`

**Interfaces:**
- Consumes: `WorkloadHeatmap` (Task 4), `computeWeekColumns`, `buildPicWorkload` (Task 1,
  `lib/workload-metrics.ts`), `WorkloadActivity` (Task 1, `lib/types.ts`), `Card`/`CardHeader`/
  `CardTitle`/`CardContent`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`,
  `Input`, `Label` (`components/ui/*`)
- Produces: `WorkloadClient({ activities, locations }: WorkloadClientProps)` — consumed by the
  `/workload` page (Task 6)

Owns Lokasi/Fase/date-range filter state, filters the full `activities` prop client-side, computes
12 week columns from "today" (real wall-clock date, not navigable — the spec's 12-week window is
fixed, unlike Weekly Summary's navigable single week), and renders the PIC card grid plus
`WorkloadHeatmap`.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useMemo, useState } from 'react'
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
  import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { WorkloadHeatmap } from './WorkloadHeatmap'
  import { computeWeekColumns, buildPicWorkload } from '@/lib/workload-metrics'
  import type { WorkloadActivity } from '@/lib/types'

  interface WorkloadClientProps {
    activities: WorkloadActivity[]
    locations: Array<{ code: string; name: string }>
  }

  const PHASE_OPTIONS = ['F1', 'F2', 'F3', 'F4']

  export function WorkloadClient({ activities, locations }: WorkloadClientProps) {
    const [locationFilter, setLocationFilter] = useState('all')
    const [phaseFilter, setPhaseFilter] = useState('all')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    const filtered = useMemo(() => {
      return activities.filter((a) => {
        if (locationFilter !== 'all' && a.locationCode !== locationFilter) return false
        if (phaseFilter !== 'all' && a.phaseCode !== phaseFilter) return false
        if (dateFrom || dateTo) {
          const from = dateFrom || '0000-01-01'
          const to = dateTo || '9999-12-31'
          if (a.tanggal_mulai_rencana > to || a.tanggal_selesai_rencana < from) return false
        }
        return true
      })
    }, [activities, locationFilter, phaseFilter, dateFrom, dateTo])

    const today = new Date()
    const weekColumns = useMemo(() => computeWeekColumns(today, 12), [])
    const rows = useMemo(() => buildPicWorkload(filtered, weekColumns, today), [filtered, weekColumns])

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-500">Lokasi</Label>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Lokasi</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.code} value={loc.code}>
                    {loc.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-500">Fase</Label>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Fase</SelectItem>
                {PHASE_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-500">Dari Tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-500">Sampai Tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rows.map((row) => (
            <Card key={row.pic}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{row.pic}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Kegiatan aktif</span>
                  <span className="font-medium">{row.activeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Jadwal terdekat</span>
                  <span className="font-medium">{row.nextStart ?? '–'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Progres rata-rata</span>
                  <span className="font-medium">{row.avgProgress}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <WorkloadHeatmap rows={rows} weekColumns={weekColumns} activities={filtered} />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/workload/WorkloadClient.tsx
  git commit -m "feat: add WorkloadClient with filters and PIC cards"
  ```

---

## Task 6: `app/(app)/workload/page.tsx` — New Page

**Files:**
- Create: `app/(app)/workload/page.tsx`

**Interfaces:**
- Consumes: `createClient` (`lib/supabase/server.ts`), `WorkloadClient` (Task 5), `ActivityStatus`,
  `WorkloadActivity` (`lib/types.ts`)
- Produces: the route itself — `components/layout/Sidebar.tsx`'s existing `/workload` link
  (already present since Week 1) stops 404ing

Same query shape as `app/(app)/page.tsx` (the Week 8 landing page) — fetch all active locations
with nested `phases`/`activities`, but flatten into `WorkloadActivity[]` (attaching
`phaseCode`/`locationCode`/`locationName` to each activity) instead of computing per-location
summary cards.

- [ ] **Step 1: Create the page**

  ```typescript
  import { createClient } from '@/lib/supabase/server'
  import { WorkloadClient } from '@/components/workload/WorkloadClient'
  import type { ActivityStatus, WorkloadActivity } from '@/lib/types'

  interface LocationWithPhases {
    id: string
    code: string
    name: string
    phases: Array<{
      phase_code: string
      activities: Array<{
        id: string
        kegiatan: string
        pic: string
        status: ActivityStatus
        progress_pct: number
        tanggal_mulai_rencana: string
        tanggal_selesai_rencana: string
      }>
    }>
  }

  export default async function WorkloadPage() {
    const supabase = createClient()
    const { data: locationRows } = await supabase
      .from('locations')
      .select(
        `
        id, code, name,
        phases ( phase_code,
          activities ( id, kegiatan, pic, status, progress_pct, tanggal_mulai_rencana, tanggal_selesai_rencana )
        )
      `
      )
      .eq('is_active', true)
      .order('display_order')

    const locations = (locationRows ?? []) as LocationWithPhases[]

    const activities: WorkloadActivity[] = locations.flatMap((location) =>
      location.phases.flatMap((phase) =>
        phase.activities.map((a) => ({
          ...a,
          phaseCode: phase.phase_code,
          locationCode: location.code,
          locationName: location.name,
        }))
      )
    )

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workload View</h1>
        <p className="text-gray-500 mt-1 mb-6">Beban kerja PIC lintas-lokasi, 12 minggu ke depan</p>
        <WorkloadClient
          activities={activities}
          locations={locations.map((l) => ({ code: l.code, name: l.name }))}
        />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles and the route appears**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`, route list includes `/workload`

- [ ] **Step 3: Commit**

  ```bash
  git add "app/(app)/workload/page.tsx"
  git commit -m "feat: add Workload View page"
  ```

---

## Task 7: `Holiday` Type, `DeleteHolidayDialog.tsx`, and `YearCalendarGrid.tsx`

**Files:**
- Modify: `lib/types.ts` (append `Holiday` at the end of the file)
- Create: `components/work-calendar/DeleteHolidayDialog.tsx`
- Create: `components/work-calendar/YearCalendarGrid.tsx`

**Interfaces:**
- Consumes: `Holiday` (this task, `lib/types.ts`), `Button`, `Dialog`/`DialogContent`/
  `DialogFooter`/`DialogHeader`/`DialogTitle`/`DialogTrigger` (`components/ui/*`), `cn`
  (`lib/utils.ts`), `toast` (`sonner`)
- Produces: `DeleteHolidayDialog({ holidayId, holidayName, children, onDeleted }:
  DeleteHolidayDialogProps)` and `YearCalendarGrid({ year, holidays, onDeleted }:
  YearCalendarGridProps)` — both consumed by `WorkCalendarClient` (Task 9)

`DeleteHolidayDialog` targets `DELETE /api/work-calendar/[id]` (Week 2/4, already working). Unlike
`DeleteRiskDialog` (Week 9), which renders its own fixed 🗑️ trigger button, this dialog takes its
trigger as `children` — because `YearCalendarGrid` needs to make an entire calendar-day cell
clickable, not a small icon.

- [ ] **Step 1: Append `Holiday` to `lib/types.ts`**

  Add at the end of `lib/types.ts` (after `WorkloadActivity` from Task 1):
  ```typescript

  export interface Holiday {
    id: string
    holiday_date: string
    name: string
  }
  ```

- [ ] **Step 2: Create `DeleteHolidayDialog.tsx`**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { toast } from 'sonner'
  import { Button } from '@/components/ui/button'
  import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from '@/components/ui/dialog'

  interface DeleteHolidayDialogProps {
    holidayId: string
    holidayName: string
    children: React.ReactNode
    onDeleted: (id: string) => void
  }

  export function DeleteHolidayDialog({ holidayId, holidayName, children, onDeleted }: DeleteHolidayDialogProps) {
    const [open, setOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    async function handleConfirm() {
      setSubmitting(true)
      setErrorMessage(null)
      try {
        const res = await fetch(`/api/work-calendar/${holidayId}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message ?? 'Gagal menghapus hari libur')
          return
        }
        onDeleted(holidayId)
        toast.success('Hari libur dihapus, CPM sedang dihitung ulang')
        setOpen(false)
      } catch {
        setErrorMessage('Gagal menghapus hari libur')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setErrorMessage(null)
        }}
      >
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Hari Libur</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Yakin ingin menghapus <span className="font-medium">{holidayName}</span>? Perubahan
            kalender akan mentrigger recalculate CPM di semua lokasi.
          </p>
          {errorMessage && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              {errorMessage}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
              {submitting ? 'Menghapus…' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
  ```

- [ ] **Step 3: Create `YearCalendarGrid.tsx`**

  ```typescript
  'use client'

  import {
    eachMonthOfInterval,
    eachDayOfInterval,
    startOfYear,
    endOfYear,
    startOfMonth,
    endOfMonth,
    format,
    getDay,
  } from 'date-fns'
  import { DeleteHolidayDialog } from './DeleteHolidayDialog'
  import { cn } from '@/lib/utils'
  import type { Holiday } from '@/lib/types'

  interface YearCalendarGridProps {
    year: number
    holidays: Holiday[]
    onDeleted: (id: string) => void
  }

  const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  const DAY_LABELS = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg']

  export function YearCalendarGrid({ year, holidays, onDeleted }: YearCalendarGridProps) {
    const holidayByDate = new Map(holidays.map((h) => [h.holiday_date, h]))
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(year, 0, 1)),
      end: endOfYear(new Date(year, 0, 1)),
    })

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map((monthStart) => {
          const days = eachDayOfInterval({ start: startOfMonth(monthStart), end: endOfMonth(monthStart) })
          const leadingBlanks = (getDay(startOfMonth(monthStart)) + 6) % 7

          return (
            <div key={monthStart.toISOString()} className="border rounded-md p-3">
              <div className="text-sm font-semibold text-gray-900 mb-2">
                {MONTH_NAMES[monthStart.getMonth()]} {year}
              </div>
              <div className="grid grid-cols-7 gap-1 text-xs text-gray-400 mb-1">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="text-center">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {days.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const holiday = holidayByDate.get(dateStr)
                  const cell = (
                    <div
                      className={cn(
                        'text-center text-xs rounded p-1',
                        holiday ? 'bg-red-100 text-red-700 font-medium cursor-pointer' : 'text-gray-700'
                      )}
                      title={holiday?.name}
                    >
                      {format(day, 'd')}
                    </div>
                  )
                  if (holiday) {
                    return (
                      <DeleteHolidayDialog key={dateStr} holidayId={holiday.id} holidayName={holiday.name} onDeleted={onDeleted}>
                        {cell}
                      </DeleteHolidayDialog>
                    )
                  }
                  return <div key={dateStr}>{cell}</div>
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  ```

- [ ] **Step 4: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

  ```bash
  git add lib/types.ts components/work-calendar/DeleteHolidayDialog.tsx components/work-calendar/YearCalendarGrid.tsx
  git commit -m "feat: add Holiday type, DeleteHolidayDialog, and YearCalendarGrid"
  ```

---

## Task 8: `AddHolidayModal.tsx` and `ImportNationalHolidaysButton.tsx`

**Files:**
- Create: `components/work-calendar/AddHolidayModal.tsx`
- Create: `components/work-calendar/ImportNationalHolidaysButton.tsx`

**Interfaces:**
- Consumes: `Holiday` (Task 7, `lib/types.ts`), `NATIONAL_HOLIDAYS` (Task 2,
  `lib/national-holidays.ts`), `Button`, `Input`, `Label`, `Dialog`/`DialogContent`/`DialogFooter`/
  `DialogHeader`/`DialogTitle`/`DialogTrigger`, `Select`/`SelectTrigger`/`SelectValue`/
  `SelectContent`/`SelectItem` (`components/ui/*`), `toast` (`sonner`)
- Produces: `AddHolidayModal({ onAdded }: { onAdded: (holiday: Holiday) => void })` and
  `ImportNationalHolidaysButton({ existingDates, onImported }:
  ImportNationalHolidaysButtonProps)` — both consumed by `WorkCalendarClient` (Task 9)

`ImportNationalHolidaysButton` POSTs each missing holiday **sequentially, not in parallel** —
every `POST /api/work-calendar` call triggers a full `runCpmForAllActiveLocations` server-side
(Week 2/4), so firing many at once would run that recalculation concurrently many times over for
no benefit. Sequential is deliberate here, not an oversight.

- [ ] **Step 1: Create `AddHolidayModal.tsx`**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { toast } from 'sonner'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from '@/components/ui/dialog'
  import type { Holiday } from '@/lib/types'

  interface AddHolidayModalProps {
    onAdded: (holiday: Holiday) => void
  }

  export function AddHolidayModal({ onAdded }: AddHolidayModalProps) {
    const [open, setOpen] = useState(false)
    const [date, setDate] = useState('')
    const [name, setName] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit() {
      if (!date || name.trim().length < 2) {
        toast.error('Tanggal dan nama hari libur wajib diisi')
        return
      }
      setSubmitting(true)
      try {
        const res = await fetch('/api/work-calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ holiday_date: date, name }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menambah hari libur')
        }
        onAdded(json.data as Holiday)
        toast.success('Hari libur ditambahkan, CPM sedang dihitung ulang')
        setOpen(false)
        setDate('')
        setName('')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menambah hari libur')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>+ Tambah Hari Libur</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Hari Libur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nama</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Cuti Bersama" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
  ```

- [ ] **Step 2: Create `ImportNationalHolidaysButton.tsx`**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { toast } from 'sonner'
  import { Button } from '@/components/ui/button'
  import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
  import { NATIONAL_HOLIDAYS } from '@/lib/national-holidays'
  import type { Holiday } from '@/lib/types'

  interface ImportNationalHolidaysButtonProps {
    existingDates: Set<string>
    onImported: (holidays: Holiday[]) => void
  }

  const AVAILABLE_YEARS = [2026, 2027] as const

  export function ImportNationalHolidaysButton({ existingDates, onImported }: ImportNationalHolidaysButtonProps) {
    const [year, setYear] = useState<(typeof AVAILABLE_YEARS)[number]>(2026)
    const [importing, setImporting] = useState(false)

    async function handleImport() {
      setImporting(true)
      const toAdd = NATIONAL_HOLIDAYS[year].filter((h) => !existingDates.has(h.holiday_date))
      const alreadyPresent = NATIONAL_HOLIDAYS[year].length - toAdd.length
      const added: Holiday[] = []
      let failed = 0

      for (const holiday of toAdd) {
        try {
          const res = await fetch('/api/work-calendar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ holiday_date: holiday.holiday_date, name: holiday.name }),
          })
          const json = await res.json()
          if (!res.ok || json.error) {
            failed += 1
            continue
          }
          added.push(json.data as Holiday)
        } catch {
          failed += 1
        }
      }

      onImported(added)
      toast.success(`${added.length} hari libur ditambahkan, ${alreadyPresent + failed} sudah ada`)
      setImporting(false)
    }

    return (
      <div className="flex items-center gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v) as (typeof AVAILABLE_YEARS)[number])}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleImport} disabled={importing}>
          {importing ? 'Mengimpor…' : `Import Libur Nasional ${year}`}
        </Button>
      </div>
    )
  }
  ```

- [ ] **Step 3: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

  ```bash
  git add components/work-calendar/AddHolidayModal.tsx components/work-calendar/ImportNationalHolidaysButton.tsx
  git commit -m "feat: add AddHolidayModal and ImportNationalHolidaysButton"
  ```

---

## Task 9: `components/work-calendar/WorkCalendarClient.tsx`

**Files:**
- Create: `components/work-calendar/WorkCalendarClient.tsx`

**Interfaces:**
- Consumes: `YearCalendarGrid` (Task 7), `AddHolidayModal`, `ImportNationalHolidaysButton` (Task
  8), `Holiday` (Task 7, `lib/types.ts`), `Button` (`components/ui/button.tsx`)
- Produces: `WorkCalendarClient({ initialHolidays }: WorkCalendarClientProps)` — consumed by the
  `/work-calendar` page (Task 10)

No `isAdmin` prop — unlike every other feature built so far, this whole page is gated at the
route level (Task 10's `notFound()` for non-admin/super_admin), so every component under it is
only ever rendered for an admin session. Adding per-field `isAdmin` conditionals here would be
dead code.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { Button } from '@/components/ui/button'
  import { YearCalendarGrid } from './YearCalendarGrid'
  import { AddHolidayModal } from './AddHolidayModal'
  import { ImportNationalHolidaysButton } from './ImportNationalHolidaysButton'
  import type { Holiday } from '@/lib/types'

  interface WorkCalendarClientProps {
    initialHolidays: Holiday[]
  }

  export function WorkCalendarClient({ initialHolidays }: WorkCalendarClientProps) {
    const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays)
    const [year, setYear] = useState(new Date().getFullYear())

    const yearHolidays = holidays.filter((h) => h.holiday_date.startsWith(String(year)))
    const existingDates = new Set(holidays.map((h) => h.holiday_date))

    function handleAdded(holiday: Holiday) {
      setHolidays((prev) => [...prev, holiday].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)))
    }

    function handleImported(imported: Holiday[]) {
      setHolidays((prev) => [...prev, ...imported].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)))
    }

    function handleDeleted(id: string) {
      setHolidays((prev) => prev.filter((h) => h.id !== id))
    }

    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-md p-3">
          Perubahan kalender akan mentrigger recalculate CPM di semua lokasi.
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setYear((y) => y - 1)}>
              ← {year - 1}
            </Button>
            <span className="text-lg font-semibold text-gray-900 w-16 text-center">{year}</span>
            <Button variant="outline" onClick={() => setYear((y) => y + 1)}>
              {year + 1} →
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <ImportNationalHolidaysButton existingDates={existingDates} onImported={handleImported} />
            <AddHolidayModal onAdded={handleAdded} />
          </div>
        </div>

        <YearCalendarGrid year={year} holidays={yearHolidays} onDeleted={handleDeleted} />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/work-calendar/WorkCalendarClient.tsx
  git commit -m "feat: add WorkCalendarClient composing year nav, grid, add, and import"
  ```

---

## Task 10: `app/(app)/work-calendar/page.tsx` — New Page, First Whole-Page Role Gate

**Files:**
- Create: `app/(app)/work-calendar/page.tsx`

**Interfaces:**
- Consumes: `getSession`, `isAdmin` (`lib/auth-helpers.ts`), `createClient`
  (`lib/supabase/server.ts`), `WorkCalendarClient` (Task 9), `Holiday` (`lib/types.ts`)
- Produces: the route itself — `components/layout/Sidebar.tsx`'s existing `/work-calendar` link
  (already present since Week 1, already conditionally hidden for non-admins in the Sidebar's own
  `isAdmin &&` block) stops 404ing for admins, and now correctly 404s for anyone who reaches the
  URL directly without the admin/super_admin role

Per PRD §10.11 ("Akses: Admin & SA"), this page must not render at all for a Viewer, even via a
direct URL — the Sidebar hiding the link is UX only, not the actual control.

- [ ] **Step 1: Create the page**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { getSession, isAdmin } from '@/lib/auth-helpers'
  import { WorkCalendarClient } from '@/components/work-calendar/WorkCalendarClient'
  import type { Holiday } from '@/lib/types'

  export default async function WorkCalendarPage() {
    const { profile } = await getSession()
    if (!profile || !isAdmin(profile.role)) notFound()

    const supabase = createClient()
    const { data: holidayRows } = await supabase
      .from('work_calendar')
      .select('id, holiday_date, name')
      .order('holiday_date')

    const holidays = (holidayRows ?? []) as Holiday[]

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kalender Kerja</h1>
        <p className="text-gray-500 mt-1 mb-6">Hari libur nasional dan cuti bersama</p>
        <WorkCalendarClient initialHolidays={holidays} />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles and the route appears**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`, route list includes `/work-calendar`

- [ ] **Step 3: Commit**

  ```bash
  git add "app/(app)/work-calendar/page.tsx"
  git commit -m "feat: add Kalender Kerja page with admin/super_admin-only access"
  ```

---

## Task 11: `components/weekly-summary/WeeklySummaryClient.tsx`

**Files:**
- Create: `components/weekly-summary/WeeklySummaryClient.tsx`

**Interfaces:**
- Consumes: `Button` (`components/ui/button.tsx`), `toast` (`sonner`)
- Produces: `WeeklySummaryClient({ locationId }: WeeklySummaryClientProps)` — consumed by the
  weekly-summary page (Task 12)

Fetches `GET /api/locations/[locationId]/weekly-summary?weekOffset=N` client-side (Task 3's
extension), re-fetching whenever `weekOffset` changes. The response shape (`week`,
`selesai_minggu_ini`, `mulai_minggu_depan`, `terlambat`, `ditunda`, `overall_pct`,
`phase_progress`, `whatsapp_text`) is already fully defined by the existing route — this task only
consumes it, it does not change it.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useEffect, useState } from 'react'
  import { toast } from 'sonner'
  import { Button } from '@/components/ui/button'

  interface SummaryActivity {
    id: string
    kegiatan: string
    pic: string
    phase_code: string
    status: string
  }

  interface WeeklySummaryData {
    week: string
    selesai_minggu_ini: SummaryActivity[]
    mulai_minggu_depan: SummaryActivity[]
    terlambat: SummaryActivity[]
    ditunda: SummaryActivity[]
    overall_pct: number
    phase_progress: Array<{ phase_code: string; name: string; pct: number }>
    whatsapp_text: string
  }

  interface WeeklySummaryClientProps {
    locationId: string
  }

  export function WeeklySummaryClient({ locationId }: WeeklySummaryClientProps) {
    const [weekOffset, setWeekOffset] = useState(0)
    const [data, setData] = useState<WeeklySummaryData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      let cancelled = false
      setLoading(true)
      fetch(`/api/locations/${locationId}/weekly-summary?weekOffset=${weekOffset}`)
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return
          if (json.error) {
            toast.error(json.error.message ?? 'Gagal memuat ringkasan mingguan')
            return
          }
          setData(json.data as WeeklySummaryData)
        })
        .catch(() => {
          if (!cancelled) toast.error('Gagal memuat ringkasan mingguan')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }, [locationId, weekOffset])

    async function handleCopy() {
      if (!data) return
      try {
        await navigator.clipboard.writeText(data.whatsapp_text)
        toast.success('Teks disalin ke clipboard')
      } catch {
        toast.error('Gagal menyalin teks')
      }
    }

    if (loading && !data) {
      return <p className="text-sm text-gray-500">Memuat ringkasan mingguan…</p>
    }

    if (!data) {
      return <p className="text-sm text-gray-500">Gagal memuat data.</p>
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setWeekOffset((w) => w - 1)}>
              ← Minggu Sebelumnya
            </Button>
            <span className="text-sm font-medium text-gray-900">{data.week}</span>
            <Button variant="outline" onClick={() => setWeekOffset((w) => w + 1)}>
              Minggu Berikutnya →
            </Button>
          </div>
          {weekOffset !== 0 && (
            <Button variant="ghost" onClick={() => setWeekOffset(0)}>
              Kembali ke Minggu Ini
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryPanel title="✅ Selesai Minggu Ini" items={data.selesai_minggu_ini} />
          <SummaryPanel title="🚀 Mulai Minggu Depan" items={data.mulai_minggu_depan} />
          <SummaryPanel title="⏰ Terlambat" items={data.terlambat} />
          <SummaryPanel title="⚠️ Ditunda" items={data.ditunda} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Teks WhatsApp</h2>
            <Button onClick={handleCopy}>Salin Teks WhatsApp</Button>
          </div>
          <pre className="font-mono text-xs bg-gray-50 border rounded-md p-4 whitespace-pre-wrap">
            {data.whatsapp_text}
          </pre>
        </div>
      </div>
    )
  }

  function SummaryPanel({ title, items }: { title: string; items: SummaryActivity[] }) {
    return (
      <div className="border rounded-md p-3">
        <div className="text-sm font-semibold text-gray-900 mb-2">{title}</div>
        {items.length === 0 ? (
          <p className="text-xs text-gray-400">Tidak ada</p>
        ) : (
          <ul className="space-y-1">
            {items.map((a) => (
              <li key={a.id} className="text-xs text-gray-600">
                {a.kegiatan} ({a.phase_code}) — {a.pic}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/weekly-summary/WeeklySummaryClient.tsx
  git commit -m "feat: add WeeklySummaryClient with week navigation and WA copy"
  ```

---

## Task 12: Weekly Summary Page and Sidebar Nav Link

**Files:**
- Create: `app/(app)/dashboard/[locationCode]/weekly-summary/page.tsx`
- Modify: `components/layout/Sidebar.tsx:115-116`

**Interfaces:**
- Consumes: `createClient` (`lib/supabase/server.ts`), `WeeklySummaryClient` (Task 11)
- Produces: the route itself, plus a working Sidebar nav link to it (previously absent —
  unlike `/workload`/`/work-calendar`, this route never had a Sidebar entry)

- [ ] **Step 1: Create the page**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { WeeklySummaryClient } from '@/components/weekly-summary/WeeklySummaryClient'

  export default async function WeeklySummaryPage({
    params,
  }: {
    params: { locationCode: string }
  }) {
    const supabase = createClient()
    const { data: location } = await supabase
      .from('locations')
      .select('id, code')
      .eq('code', params.locationCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!location) notFound()

    return <WeeklySummaryClient locationId={location.id} />
  }
  ```

- [ ] **Step 2: Add the Sidebar nav link**

  In `components/layout/Sidebar.tsx`, find these two lines (inside the `{currentCode && (...)}` block):
  ```typescript
              <NavLink href={`/dashboard/${currentCode}`} icon="📊" label="Ringkasan" pathname={pathname} exact />
              <NavLink href={`/dashboard/${currentCode}/timeline`} icon="📅" label="Timeline / Gantt" pathname={pathname} />
  ```
  Insert a new line immediately after the Timeline link:
  ```typescript
              <NavLink href={`/dashboard/${currentCode}`} icon="📊" label="Ringkasan" pathname={pathname} exact />
              <NavLink href={`/dashboard/${currentCode}/timeline`} icon="📅" label="Timeline / Gantt" pathname={pathname} />
              <NavLink href={`/dashboard/${currentCode}/weekly-summary`} icon="🗞️" label="Ringkasan Mingguan" pathname={pathname} />
  ```

- [ ] **Step 3: Verify the build compiles and the route appears**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`, route list includes
  `/dashboard/[locationCode]/weekly-summary`

  Run: `npm run lint`
  Expected: no errors

  Run: `npm test`
  Expected: 83/83 passing (unchanged — no new tests this task)

- [ ] **Step 4: Commit**

  ```bash
  git add "app/(app)/dashboard/[locationCode]/weekly-summary/page.tsx" components/layout/Sidebar.tsx
  git commit -m "feat: add Weekly Summary page and Sidebar nav link"
  ```

---

## Task 13: Final Real-Browser E2E Pass and Progress Ledger

**Files:**
- Modify: `.superpowers/sdd/progress.md`

No code changes — this task verifies all three PM Views end-to-end with a real headless browser
(the approach established since Week 5 — drive Playwright's `chromium` module directly via
`require('playwright')`/`chromium.launch()`, since `chromium-cli` isn't available in this
environment). This is the pass that actually clicks through the UI — do not substitute plain HTTP
requests for this task.

- [ ] **Step 1: Prepare test data**

  Using existing or disposable test locations, ensure at least 3 different PICs appear across at
  least 2 locations with activities spanning a range of statuses (some `selesai`, some
  `sedang_berjalan`/`belum_mulai` with dates inside the next 12 weeks, at least one `ditunda`) so
  the Workload heatmap and Weekly Summary panels all have real, non-empty data to render.

- [ ] **Step 2: Real-browser pass — Workload View**

  As any role, navigate to `/workload`. Confirm PIC cards show plausible active counts, a nearest
  upcoming start date (or `–`), and an average progress percentage. Confirm the heatmap renders
  one row per PIC and 12 week columns, colored by band (green/amber/red matching 0-1/2-3/4+).
  Click a nonzero cell, confirm the Dialog lists exactly the activities for that PIC overlapping
  that week (cross-check against the raw activity data). Change the Lokasi and Fase filters,
  confirm both the cards and heatmap update to the filtered set. Set a date range, confirm it
  further narrows the same way.

- [ ] **Step 3: Real-browser pass — Kalender Kerja**

  Log in as `admin@perumnas.co.id`. Navigate to `/work-calendar`. Confirm the current year's grid
  renders with existing holidays marked red. Use "+ Tambah Hari Libur" to add a disposable test
  holiday, confirm it appears red in the grid immediately. Click that same day, confirm the delete
  confirmation names it correctly, confirm, and confirm it disappears from the grid. Use "Import
  Libur Nasional 2027" (or whichever year has holidays not yet present), confirm the toast reports
  a plausible added/already-present split, and confirm the newly-imported dates now show red.
  Navigate Prev/Next year, confirm the grid updates to show that year's (likely empty, outside
  2026-2027) holidays. Log out, log in as `viewer@perumnas.co.id`, navigate directly to
  `/work-calendar` by URL, confirm it 404s (not renders read-only — per this week's whole-page
  gate).

- [ ] **Step 4: Real-browser pass — Weekly Summary**

  As admin, navigate to `/dashboard/{code}/weekly-summary` for a location with real activity data.
  Confirm the 4 panels show plausible content matching the raw data (cross-check at least one
  panel's activities against a direct query). Click "Minggu Berikutnya" and "Minggu Sebelumnya" a
  few times, confirm the week label and panel contents change accordingly, and confirm "Kembali ke
  Minggu Ini" returns to the original week. Click "Salin Teks WhatsApp", confirm (via
  `page.evaluate(() => navigator.clipboard.readText())` or equivalent) that the clipboard content
  exactly matches the on-screen monospace box. Confirm the Sidebar's new "Ringkasan Mingguan" link
  navigates here correctly.

- [ ] **Step 5: Cross-role and console check**

  Confirm zero browser console errors across the whole run. Confirm Viewer sees `/workload` and
  the weekly-summary page identically to admin (both are all-roles pages), with no
  add/delete/import affordances anywhere those don't belong.

- [ ] **Step 6: Clean up test data**

  Remove the disposable "+ Tambah Hari Libur" test holiday added in Step 3 if it wasn't already
  deleted during the pass (confirm via `GET /api/work-calendar`). Deactivate any disposable test
  locations created for Step 1 (`DELETE /api/locations/{id}` as `superadmin@perumnas.co.id`, same
  precedent as every prior week).

- [ ] **Step 7: Record the ledger entry**

  Append to `.superpowers/sdd/progress.md`:
  ```markdown

  ## Week 10
  # Plan: docs/superpowers/plans/2026-07-05-minggu10-pm-views.md
  # Spec: docs/superpowers/specs/2026-07-05-minggu10-pm-views-design.md
  - Task 1: [fill in commit + review outcome]
  - Task 2: [fill in commit + review outcome]
  - Task 3: [fill in commit + review outcome]
  - Task 4: [fill in commit + review outcome]
  - Task 5: [fill in commit + review outcome]
  - Task 6: [fill in commit + review outcome]
  - Task 7: [fill in commit + review outcome]
  - Task 8: [fill in commit + review outcome]
  - Task 9: [fill in commit + review outcome]
  - Task 10: [fill in commit + review outcome]
  - Task 11: [fill in commit + review outcome]
  - Task 12: [fill in commit + review outcome]
  - Task 13: [fill in E2E findings — do not leave this as a template]
  - Week 10 PM Views COMPLETE (fill in date)
  ```

  ```bash
  git add .superpowers/sdd/progress.md
  git commit -m "chore: record Week 10 Task 13 E2E pass in SDD progress ledger"
  ```
