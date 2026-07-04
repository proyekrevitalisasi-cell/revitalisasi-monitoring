# Minggu 8: Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Week-1 landing-page stub at `/` with a full cross-location dashboard, replace
the `/dashboard/[locationCode]` redirect-to-fase-1 stub with a real per-location summary dashboard,
and build a new KK Consent tracker page at `/dashboard/[locationCode]/kk-consent` whose API has
existed unused since Week 2.

**Architecture:** A new pure-logic module (`lib/dashboard-metrics.ts`) computes every percentage,
count, and overdue-day number these pages need from raw activity arrays — Vitest-tested, no
database access. A new `components/dashboard/` directory holds small presentational components
(cards, a comparative table, a shared issues table) that take already-computed numbers as props.
Both dashboard pages are server components that fetch once and pass data down, the same
`getSession()`/direct-Supabase-query shape every other page in this app already uses — no new API
routes, no schema changes. The KK Consent page adds one client component
(`components/kk-consent/KkConsentForm.tsx`) that reuses this project's existing debounced-autosave
pattern (`useDebouncedCallback`, `SaveStatusBadge`) against the already-working
`PATCH /api/locations/[locationId]/kk-consent` route.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase JS v2 · shadcn/ui (adding `Progress`
this week) · date-fns v3 · sonner (toasts)

## Global Constraints

- `npm run build` must pass before every commit; `npm test` must keep passing (46 existing tests
  from Week 7 plus this week's new `lib/dashboard-metrics.test.ts` cases — 61 total)
- TypeScript strict — no implicit `any`
- No semicolons, single quotes — match this project's existing style exactly
- No API routes or schema/migrations change this week — every number comes from `locations`,
  `phases`, `activities`, `kk_consent`, all already fully working since Weeks 1-2
- Two distinct, already-established admin-gating patterns apply in different places — do not mix
  them up: (1) admin-only **action** buttons/dialogs are omitted entirely for non-admins (e.g.
  `BaselinePanel`'s parent-side `{isAdmin && ...}` gate) — nothing in this week's plan is an action
  dialog, so this pattern doesn't apply to any new component; (2) admin-only **form fields inside
  an always-visible form** render as plain read-only text for non-admins instead of an input (e.g.
  `ActivityRow.tsx`'s own `isAdmin ? <Input .../> : activity.field` per-field pattern) — this is
  the pattern `KkConsentForm.tsx` follows, since the KK Consent page itself is always visible to
  every role, only its inputs differ by role
- Every git commit message follows the existing convention: `feat:`/`fix:`/`chore:` prefix, one line
- Spec: `docs/superpowers/specs/2026-07-04-minggu8-dashboard-design.md`

---

## Task 1: `lib/dashboard-metrics.ts` — Pure Aggregation Functions

**Files:**
- Create: `lib/dashboard-metrics.ts`
- Create: `lib/dashboard-metrics.test.ts`

**Interfaces:**
- Consumes: `ActivityStatus` from `lib/types.ts` (Week 1)
- Produces: `computeProgressPct`, `StatusCounts`, `computeStatusCounts`, `isNeedsAttention`,
  `computeOverdueDays`, `computeProjectFinishDate` — consumed by every `components/dashboard/*`
  task and both dashboard pages below

- [ ] **Step 1: Write the failing tests**

  Create `lib/dashboard-metrics.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import {
    computeProgressPct,
    computeStatusCounts,
    isNeedsAttention,
    computeOverdueDays,
    computeProjectFinishDate,
  } from './dashboard-metrics'

  describe('computeProgressPct', () => {
    it('returns 0 for an empty array', () => {
      expect(computeProgressPct([])).toBe(0)
    })

    it("returns the single activity's own percentage", () => {
      expect(computeProgressPct([{ progress_pct: 40 }])).toBe(40)
    })

    it('averages multiple activities', () => {
      expect(
        computeProgressPct([{ progress_pct: 0 }, { progress_pct: 50 }, { progress_pct: 100 }])
      ).toBe(50)
    })

    it('rounds a non-integer average to the nearest integer', () => {
      expect(
        computeProgressPct([{ progress_pct: 0 }, { progress_pct: 0 }, { progress_pct: 100 }])
      ).toBe(33)
    })
  })

  describe('computeStatusCounts', () => {
    it('returns all zeros for an empty array', () => {
      expect(computeStatusCounts([])).toEqual({ critical: 0, ditunda: 0, selesai: 0, total: 0 })
    })

    it('counts critical, ditunda, and selesai independently across a mixed set', () => {
      const activities = [
        { status: 'selesai' as const, is_on_critical_path: true },
        { status: 'ditunda' as const, is_on_critical_path: false },
        { status: 'sedang_berjalan' as const, is_on_critical_path: true },
        { status: 'belum_mulai' as const, is_on_critical_path: false },
      ]
      expect(computeStatusCounts(activities)).toEqual({ critical: 2, ditunda: 1, selesai: 1, total: 4 })
    })
  })

  describe('isNeedsAttention', () => {
    const today = new Date('2026-07-10')

    it('is true when status is ditunda regardless of date', () => {
      expect(
        isNeedsAttention({ status: 'ditunda', tanggal_selesai_rencana: '2026-08-01' }, today)
      ).toBe(true)
    })

    it('is true when overdue and not selesai', () => {
      expect(
        isNeedsAttention({ status: 'sedang_berjalan', tanggal_selesai_rencana: '2026-07-01' }, today)
      ).toBe(true)
    })

    it('is false when overdue but already selesai', () => {
      expect(
        isNeedsAttention({ status: 'selesai', tanggal_selesai_rencana: '2026-07-01' }, today)
      ).toBe(false)
    })

    it('is false when not overdue and not ditunda', () => {
      expect(
        isNeedsAttention({ status: 'belum_mulai', tanggal_selesai_rencana: '2026-08-01' }, today)
      ).toBe(false)
    })
  })

  describe('computeOverdueDays', () => {
    const today = new Date('2026-07-10')

    it('returns a positive count when overdue', () => {
      expect(computeOverdueDays('2026-07-05', today)).toBe(5)
    })

    it('returns 0 when due exactly today', () => {
      expect(computeOverdueDays('2026-07-10', today)).toBe(0)
    })

    it('returns a negative count when not yet due', () => {
      expect(computeOverdueDays('2026-07-15', today)).toBe(-5)
    })
  })

  describe('computeProjectFinishDate', () => {
    it('returns null for an empty array', () => {
      expect(computeProjectFinishDate([])).toBeNull()
    })

    it("returns the single activity's date", () => {
      expect(computeProjectFinishDate([{ tanggal_selesai_rencana: '2026-07-10' }])).toBe('2026-07-10')
    })

    it('returns the maximum date across multiple activities', () => {
      const activities = [
        { tanggal_selesai_rencana: '2026-07-10' },
        { tanggal_selesai_rencana: '2026-09-01' },
        { tanggal_selesai_rencana: '2026-08-15' },
      ]
      expect(computeProjectFinishDate(activities)).toBe('2026-09-01')
    })
  })
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npm test`
  Expected: FAIL — `lib/dashboard-metrics.ts` doesn't exist yet ("Cannot find module './dashboard-metrics'")

- [ ] **Step 3: Create `lib/dashboard-metrics.ts`**

  ```typescript
  import { differenceInCalendarDays, parseISO } from 'date-fns'
  import type { ActivityStatus } from '@/lib/types'

  export function computeProgressPct(activities: Array<{ progress_pct: number }>): number {
    if (activities.length === 0) return 0
    const sum = activities.reduce((acc, a) => acc + a.progress_pct, 0)
    return Math.round(sum / activities.length)
  }

  export interface StatusCounts {
    critical: number
    ditunda: number
    selesai: number
    total: number
  }

  export function computeStatusCounts(
    activities: Array<{ status: ActivityStatus; is_on_critical_path: boolean }>
  ): StatusCounts {
    return {
      critical: activities.filter((a) => a.is_on_critical_path).length,
      ditunda: activities.filter((a) => a.status === 'ditunda').length,
      selesai: activities.filter((a) => a.status === 'selesai').length,
      total: activities.length,
    }
  }

  export function isNeedsAttention(
    activity: { status: ActivityStatus; tanggal_selesai_rencana: string },
    today: Date
  ): boolean {
    if (activity.status === 'ditunda') return true
    if (activity.status === 'selesai') return false
    return parseISO(activity.tanggal_selesai_rencana) < today
  }

  export function computeOverdueDays(tanggalSelesaiRencana: string, today: Date): number {
    return differenceInCalendarDays(today, parseISO(tanggalSelesaiRencana))
  }

  export function computeProjectFinishDate(
    activities: Array<{ tanggal_selesai_rencana: string }>
  ): string | null {
    if (activities.length === 0) return null
    return activities.reduce(
      (max, a) => (a.tanggal_selesai_rencana > max ? a.tanggal_selesai_rencana : max),
      activities[0].tanggal_selesai_rencana
    )
  }
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npm test`
  Expected: all pass (46 from before + 15 new = 61)

- [ ] **Step 5: Commit**

  ```bash
  git add lib/dashboard-metrics.ts lib/dashboard-metrics.test.ts
  git commit -m "feat: add pure dashboard aggregation functions"
  ```

---

## Task 2: Add shadcn `Progress` Primitive

**Files:**
- Create: `components/ui/progress.tsx` (generated)
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `Progress` (prop: `value: number`, 0-100) — consumed by `LocationSummaryCard.tsx`,
  `KkConsentSummaryBar.tsx`, `KkConsentForm.tsx`, and both dashboard pages' overall-progress bars

- [ ] **Step 1: Run the shadcn CLI**

  ```bash
  npx shadcn@latest add progress
  ```
  Same pattern that added `select`/`dialog`/`tabs`/`tooltip` in earlier weeks — generates
  `components/ui/progress.tsx` matching this project's existing style and adds
  `@radix-ui/react-progress` to `package.json`/`package-lock.json`.

- [ ] **Step 2: Verify build**

  Confirm `components/ui/progress.tsx` exists and exports `Progress`.

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add components/ui/progress.tsx package.json package-lock.json
  git commit -m "feat: add shadcn Progress primitive"
  ```

---

## Task 3: `lib/types.ts` — Add `KkConsent` Type

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `KkConsent` — consumed by `KkConsentSummaryBar.tsx`/page-2 wiring (Tasks 8-9) and
  `KkConsentForm.tsx`/page-3 wiring (Tasks 10-11)

- [ ] **Step 1: Add the type**

  Append to the end of `lib/types.ts` (after the existing `Baseline` interface):
  ```typescript
  export interface KkConsent {
    id: string
    location_id: string
    target_kk: number
    setuju: number
    menolak: number
    belum_dihubungi: number
    threshold_pct: number
    catatan: string | null
    updated_at: string
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds (purely additive type, nothing consumes it yet)

- [ ] **Step 3: Commit**

  ```bash
  git add lib/types.ts
  git commit -m "feat: add KkConsent type"
  ```

---

## Task 4: `components/dashboard/LocationSummaryCard.tsx`

**Files:**
- Create: `components/dashboard/LocationSummaryCard.tsx`

**Interfaces:**
- Consumes: `Card`/`CardHeader`/`CardContent` from `components/ui/card.tsx`; `Progress` from
  `components/ui/progress.tsx` (Task 2); `PHASE_COLORS` from
  `components/gantt/gantt-constants.ts` (Week 6, reused as-is — not redefined); `computeProgressPct`,
  `computeStatusCounts` from `lib/dashboard-metrics.ts` (Task 1); `Phase`, `ActivityStatus` from
  `lib/types.ts`
- Produces: `LocationSummaryCard` component — consumed by the `/` page rewrite (Task 7)

- [ ] **Step 1: Create the file**

  ```typescript
  import Link from 'next/link'
  import { Card, CardContent, CardHeader } from '@/components/ui/card'
  import { Progress } from '@/components/ui/progress'
  import { PHASE_COLORS } from '@/components/gantt/gantt-constants'
  import { computeProgressPct, computeStatusCounts } from '@/lib/dashboard-metrics'
  import type { Phase, ActivityStatus } from '@/lib/types'

  interface LocationSummaryCardProps {
    location: { code: string; name: string; description: string | null }
    phases: Array<{
      phase_code: Phase['phase_code']
      activities: Array<{ status: ActivityStatus; progress_pct: number; is_on_critical_path: boolean }>
    }>
  }

  export function LocationSummaryCard({ location, phases }: LocationSummaryCardProps) {
    const allActivities = phases.flatMap((p) => p.activities)
    const overallPct = computeProgressPct(allActivities)
    const counts = computeStatusCounts(allActivities)

    return (
      <Link href={`/dashboard/${location.code}`} className="block">
        <Card className="hover:border-blue-400 hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">{location.code}</div>
            <div className="font-semibold text-gray-900">{location.name}</div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Progres Keseluruhan</span>
                <span className="font-medium text-gray-900">{overallPct}%</span>
              </div>
              <Progress value={overallPct} />
            </div>

            <div className="flex gap-2">
              {phases.map((phase) => {
                const phasePct = computeProgressPct(phase.activities)
                return (
                  <div key={phase.phase_code} className="flex-1 text-center">
                    <div
                      className="h-1.5 rounded-full mb-1"
                      style={{ backgroundColor: PHASE_COLORS[phase.phase_code] }}
                    />
                    <div className="text-[11px] text-gray-500">
                      {phase.phase_code} {phasePct}%
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
              <span className="text-red-600 font-medium">{counts.critical} kritis</span>
              <span className="text-amber-600 font-medium">{counts.ditunda} ditunda</span>
              <span className="text-gray-500">
                {counts.selesai}/{counts.total} selesai
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add components/dashboard/LocationSummaryCard.tsx
  git commit -m "feat: add LocationSummaryCard for the cross-location dashboard"
  ```

---

## Task 5: `components/dashboard/ComparativeTable.tsx`

**Files:**
- Create: `components/dashboard/ComparativeTable.tsx`

**Interfaces:**
- Consumes: `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` from
  `components/ui/table.tsx`; `computeProgressPct` from `lib/dashboard-metrics.ts` (Task 1);
  `Phase` from `lib/types.ts`
- Produces: `ComparativeTable` component — consumed by the `/` page rewrite (Task 7)

- [ ] **Step 1: Create the file**

  ```typescript
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
  import { computeProgressPct } from '@/lib/dashboard-metrics'
  import type { Phase } from '@/lib/types'

  const PHASE_CODES: Phase['phase_code'][] = ['F1', 'F2', 'F3', 'F4']

  interface ComparativeTableProps {
    locations: Array<{
      code: string
      name: string
      phases: Array<{
        phase_code: Phase['phase_code']
        activities: Array<{ progress_pct: number }>
      }>
    }>
  }

  export function ComparativeTable({ locations }: ComparativeTableProps) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lokasi</TableHead>
            {PHASE_CODES.map((code) => (
              <TableHead key={code} className="text-center">
                {code}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map((location) => (
            <TableRow key={location.code}>
              <TableCell className="font-medium">{location.name}</TableCell>
              {PHASE_CODES.map((code) => {
                const phase = location.phases.find((p) => p.phase_code === code)
                const pct = phase ? computeProgressPct(phase.activities) : 0
                return (
                  <TableCell key={code} className="text-center text-gray-600">
                    {pct}%
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add components/dashboard/ComparativeTable.tsx
  git commit -m "feat: add ComparativeTable for cross-location phase percentages"
  ```

---

## Task 6: `components/dashboard/ActivityIssueTable.tsx`

**Files:**
- Create: `components/dashboard/ActivityIssueTable.tsx`

**Interfaces:**
- Consumes: `Badge` from `components/ui/badge.tsx`; `Table`/`TableBody`/`TableCell`/`TableHead`/
  `TableHeader`/`TableRow` from `components/ui/table.tsx`; `ActivityStatus` from `lib/types.ts`
- Produces: `ActivityIssueRow` type, `ActivityIssueTable` component (props: `issues:
  ActivityIssueRow[]`, `showLocation: boolean`) — consumed by both the `/` page rewrite (Task 7,
  `showLocation={true}`) and the `/dashboard/[locationCode]` page rewrite (Task 9,
  `showLocation={false}`)

This component is purely presentational — it renders a pre-filtered, pre-sorted list handed to it.
Filtering (via `isNeedsAttention`) and sorting (via `computeOverdueDays`) both happen in the pages
that use it, not here, since those depend on "today" (a rendering-time concern each page already
resolves once for its own data).

- [ ] **Step 1: Create the file**

  ```typescript
  import { Badge } from '@/components/ui/badge'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
  import type { ActivityStatus } from '@/lib/types'

  export interface ActivityIssueRow {
    activityId: string
    kegiatan: string
    pic: string
    phaseCode: string
    tanggalSelesaiRencana: string
    status: ActivityStatus
    overdueDays: number
    locationName?: string
    locationCode?: string
  }

  interface ActivityIssueTableProps {
    issues: ActivityIssueRow[]
    showLocation: boolean
  }

  export function ActivityIssueTable({ issues, showLocation }: ActivityIssueTableProps) {
    if (issues.length === 0) {
      return <p className="text-sm text-gray-500">Tidak ada isu saat ini.</p>
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {showLocation && <TableHead>Lokasi</TableHead>}
            <TableHead>Fase</TableHead>
            <TableHead>Kegiatan</TableHead>
            <TableHead>PIC</TableHead>
            <TableHead>Selesai Rencana</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <TableRow key={issue.activityId}>
              {showLocation && (
                <TableCell className="text-xs text-gray-500">
                  {issue.locationCode} — {issue.locationName}
                </TableCell>
              )}
              <TableCell className="text-xs text-gray-500">{issue.phaseCode}</TableCell>
              <TableCell>{issue.kegiatan}</TableCell>
              <TableCell className="text-gray-500">{issue.pic}</TableCell>
              <TableCell className="text-gray-500">{issue.tanggalSelesaiRencana}</TableCell>
              <TableCell>
                {issue.status === 'ditunda' ? (
                  <Badge variant="secondary">Ditunda</Badge>
                ) : (
                  <span className="text-amber-600 text-sm">{issue.overdueDays} hari telat</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add components/dashboard/ActivityIssueTable.tsx
  git commit -m "feat: add shared ActivityIssueTable for needs-attention lists"
  ```

---

## Task 7: Rewrite `app/(app)/page.tsx` — Cross-Location Landing Page

**Files:**
- Modify: `app/(app)/page.tsx`

**Interfaces:**
- Consumes: `LocationSummaryCard` (Task 4), `ComparativeTable` (Task 5), `ActivityIssueTable` +
  `ActivityIssueRow` (Task 6), `isNeedsAttention` + `computeOverdueDays` from
  `lib/dashboard-metrics.ts` (Task 1); `Phase`, `ActivityStatus` from `lib/types.ts`
- Produces: the full `/` page — replaces the entire Week-1 stub body (the plain grid + stale
  "Minggu 1 selesai" banner)

- [ ] **Step 1: Replace the file**

  Replace the entire contents of `app/(app)/page.tsx`:
  ```typescript
  import { createClient } from '@/lib/supabase/server'
  import { LocationSummaryCard } from '@/components/dashboard/LocationSummaryCard'
  import { ComparativeTable } from '@/components/dashboard/ComparativeTable'
  import { ActivityIssueTable, type ActivityIssueRow } from '@/components/dashboard/ActivityIssueTable'
  import { isNeedsAttention, computeOverdueDays } from '@/lib/dashboard-metrics'
  import type { Phase, ActivityStatus } from '@/lib/types'

  interface LocationWithPhases {
    id: string
    code: string
    name: string
    description: string | null
    phases: Array<{
      phase_code: Phase['phase_code']
      activities: Array<{
        id: string
        kegiatan: string
        pic: string
        status: ActivityStatus
        progress_pct: number
        is_on_critical_path: boolean
        tanggal_selesai_rencana: string
      }>
    }>
  }

  export default async function HomePage() {
    const supabase = createClient()
    const { data: locationRows } = await supabase
      .from('locations')
      .select(
        `
        id, code, name, description,
        phases (
          phase_code,
          activities ( id, kegiatan, pic, status, progress_pct, is_on_critical_path, tanggal_selesai_rencana )
        )
      `
      )
      .eq('is_active', true)
      .order('display_order')

    const locations = (locationRows ?? []) as LocationWithPhases[]
    const today = new Date()

    const issues: ActivityIssueRow[] = locations
      .flatMap((location) =>
        location.phases.flatMap((phase) =>
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
              locationName: location.name,
              locationCode: location.code,
            }))
        )
      )
      .sort((a, b) => b.overdueDays - a.overdueDays)

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Program Revitalisasi Rusun</h1>
        <p className="text-gray-500 mt-1 mb-6">Ringkasan Semua Lokasi — Perum Perumnas</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {locations.map((location) => (
            <LocationSummaryCard key={location.id} location={location} phases={location.phases} />
          ))}
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Ringkasan Komparatif</h2>
          <ComparativeTable locations={locations} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Isu Lintas-Lokasi</h2>
          <ActivityIssueTable issues={issues} showLocation />
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Manual verification**

  Run: `npm run dev`, log in, open `/`. Expected: a grid of location cards each showing a progress
  bar/%, 4 phase mini-bars with colors, and kritis/ditunda/selesai counts; below that a comparative
  table (locations × F1-F4 %); below that either "Tidak ada isu saat ini." or a table of every
  ditunda/overdue activity across all locations, most-overdue first.

- [ ] **Step 4: Commit**

  ```bash
  git add "app/(app)/page.tsx"
  git commit -m "feat: rewrite cross-location landing page with real dashboard data"
  ```

---

## Task 8: Per-Location Dashboard Supporting Components

**Files:**
- Create: `components/dashboard/PhaseSummaryCard.tsx`
- Create: `components/dashboard/CriticalPathCard.tsx`
- Create: `components/dashboard/UpcomingActivitiesPanel.tsx`
- Create: `components/dashboard/KkConsentSummaryBar.tsx`

**Interfaces:**
- Consumes: `Badge` from `components/ui/badge.tsx`; `Card`/`CardHeader`/`CardContent` from
  `components/ui/card.tsx`; `Progress` from `components/ui/progress.tsx` (Task 2);
  `computeProgressPct`, `computeStatusCounts` from `lib/dashboard-metrics.ts` (Task 1); `cn` from
  `lib/utils.ts`; `ActivityStatus` from `lib/types.ts`
- Produces: `PhaseSummaryCard`, `CriticalPathCard`, `UpcomingActivitiesPanel`,
  `KkConsentSummaryBar` components — consumed by the `/dashboard/[locationCode]` page rewrite
  (Task 9)

Four small presentational components with no consumers yet (Task 9 wires them in) — this task
verifies each builds correctly, same shape as Week 6 Task 4's standalone constants file.

- [ ] **Step 1: Create `PhaseSummaryCard.tsx`**

  ```typescript
  import { Badge } from '@/components/ui/badge'
  import { Card, CardContent, CardHeader } from '@/components/ui/card'
  import { computeProgressPct, computeStatusCounts } from '@/lib/dashboard-metrics'
  import type { ActivityStatus } from '@/lib/types'

  interface PhaseSummaryCardProps {
    name: string
    picUtama: string
    activities: Array<{ status: ActivityStatus; progress_pct: number; is_on_critical_path: boolean }>
  }

  export function PhaseSummaryCard({ name, picUtama, activities }: PhaseSummaryCardProps) {
    const pct = computeProgressPct(activities)
    const counts = computeStatusCounts(activities)

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="font-semibold text-gray-900">{name}</div>
          <div className="text-xs text-gray-400">{picUtama}</div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{pct}%</div>
          <div className="text-xs text-gray-500 mt-1">
            {counts.selesai}/{counts.total} selesai
          </div>
          {counts.ditunda > 0 && (
            <Badge variant="secondary" className="mt-2">
              {counts.ditunda} ditunda
            </Badge>
          )}
        </CardContent>
      </Card>
    )
  }
  ```

- [ ] **Step 2: Create `CriticalPathCard.tsx`**

  ```typescript
  import { Card, CardContent, CardHeader } from '@/components/ui/card'

  interface CriticalPathCardProps {
    criticalCount: number
    finishDate: string | null
  }

  export function CriticalPathCard({ criticalCount, finishDate }: CriticalPathCardProps) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="font-semibold text-gray-900">Jalur Kritis</div>
        </CardHeader>
        <CardContent className="flex justify-between items-end">
          <div>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <div className="text-xs text-gray-500">kegiatan kritis</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">{finishDate ?? '–'}</div>
            <div className="text-xs text-gray-500">estimasi selesai proyek</div>
          </div>
        </CardContent>
      </Card>
    )
  }
  ```

- [ ] **Step 3: Create `UpcomingActivitiesPanel.tsx`**

  ```typescript
  interface UpcomingActivity {
    id: string
    kegiatan: string
    pic: string
    tanggalMulaiRencana: string
  }

  interface UpcomingActivitiesPanelProps {
    activities: UpcomingActivity[]
  }

  export function UpcomingActivitiesPanel({ activities }: UpcomingActivitiesPanelProps) {
    if (activities.length === 0) {
      return <p className="text-sm text-gray-500">Tidak ada kegiatan mendatang.</p>
    }

    return (
      <ul className="divide-y divide-gray-100">
        {activities.map((activity) => (
          <li key={activity.id} className="py-2 flex justify-between text-sm">
            <span className="text-gray-900">{activity.kegiatan}</span>
            <span className="text-gray-500">
              {activity.pic} · {activity.tanggalMulaiRencana}
            </span>
          </li>
        ))}
      </ul>
    )
  }
  ```

- [ ] **Step 4: Create `KkConsentSummaryBar.tsx`**

  ```typescript
  import Link from 'next/link'
  import { Progress } from '@/components/ui/progress'
  import { cn } from '@/lib/utils'

  interface KkConsentSummaryBarProps {
    locationCode: string
    targetKk: number
    setuju: number
    thresholdPct: number
  }

  export function KkConsentSummaryBar({ locationCode, targetKk, setuju, thresholdPct }: KkConsentSummaryBarProps) {
    const pct = targetKk > 0 ? Math.round((setuju / targetKk) * 100) : 0
    const metThreshold = pct >= thresholdPct

    return (
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">Persetujuan Warga (KK)</span>
          <span className={cn('font-medium', metThreshold ? 'text-green-600' : 'text-amber-600')}>
            {pct}% (ambang {thresholdPct}%)
          </span>
        </div>
        <Progress value={pct} />
        <Link
          href={`/dashboard/${locationCode}/kk-consent`}
          className="text-xs text-blue-500 hover:underline mt-1 inline-block"
        >
          Lihat detail →
        </Link>
      </div>
    )
  }
  ```

- [ ] **Step 5: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 6: Commit**

  ```bash
  git add components/dashboard/PhaseSummaryCard.tsx components/dashboard/CriticalPathCard.tsx components/dashboard/UpcomingActivitiesPanel.tsx components/dashboard/KkConsentSummaryBar.tsx
  git commit -m "feat: add per-location dashboard supporting components"
  ```

---

## Task 9: Rewrite `app/(app)/dashboard/[locationCode]/page.tsx` — Per-Location Dashboard

**Files:**
- Modify: `app/(app)/dashboard/[locationCode]/page.tsx`

**Interfaces:**
- Consumes: `Progress` (Task 2); `PhaseSummaryCard`, `CriticalPathCard`,
  `UpcomingActivitiesPanel`, `KkConsentSummaryBar` (Task 8); `ActivityIssueTable` +
  `ActivityIssueRow` (Task 6); `computeProgressPct`, `computeStatusCounts`,
  `computeProjectFinishDate`, `isNeedsAttention`, `computeOverdueDays` (Task 1); `KkConsent` (Task 3)
- Produces: the full `/dashboard/[locationCode]` page — replaces the single-line
  `redirect(...)` that has stood in since Week 1

- [ ] **Step 1: Replace the file**

  Replace the entire contents of `app/(app)/dashboard/[locationCode]/page.tsx` (currently just
  `redirect(`/dashboard/${params.locationCode}/fase-1`)`):
  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { Progress } from '@/components/ui/progress'
  import { PhaseSummaryCard } from '@/components/dashboard/PhaseSummaryCard'
  import { CriticalPathCard } from '@/components/dashboard/CriticalPathCard'
  import { UpcomingActivitiesPanel } from '@/components/dashboard/UpcomingActivitiesPanel'
  import { ActivityIssueTable, type ActivityIssueRow } from '@/components/dashboard/ActivityIssueTable'
  import { KkConsentSummaryBar } from '@/components/dashboard/KkConsentSummaryBar'
  import {
    computeProgressPct,
    computeStatusCounts,
    computeProjectFinishDate,
    isNeedsAttention,
    computeOverdueDays,
  } from '@/lib/dashboard-metrics'
  import type { Phase, ActivityStatus, KkConsent } from '@/lib/types'

  interface ActivityForDashboard {
    id: string
    kegiatan: string
    pic: string
    status: ActivityStatus
    progress_pct: number
    is_on_critical_path: boolean
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
  }

  export default async function LocationDashboardPage({
    params,
  }: {
    params: { locationCode: string }
  }) {
    const supabase = createClient()

    const { data: location } = await supabase
      .from('locations')
      .select('id, name, code')
      .eq('code', params.locationCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!location) notFound()

    const { data: phaseRows } = await supabase
      .from('phases')
      .select(
        `
        id, phase_code, name, pic_utama,
        activities ( id, kegiatan, pic, status, progress_pct, is_on_critical_path, tanggal_mulai_rencana, tanggal_selesai_rencana )
      `
      )
      .eq('location_id', location.id)
      .order('display_order')

    const phases = (phaseRows ?? []) as Array<{
      id: string
      phase_code: Phase['phase_code']
      name: string
      pic_utama: string
      activities: ActivityForDashboard[]
    }>

    const { data: kkConsentRow } = await supabase
      .from('kk_consent')
      .select('*')
      .eq('location_id', location.id)
      .single()
    const kkConsent = kkConsentRow as KkConsent | null

    const allActivities = phases.flatMap((p) => p.activities)
    const overallPct = computeProgressPct(allActivities)
    const statusCounts = computeStatusCounts(allActivities)
    const finishDate = computeProjectFinishDate(allActivities)
    const today = new Date()

    const upcoming = allActivities
      .filter((a) => a.status !== 'selesai')
      .sort((a, b) => a.tanggal_mulai_rencana.localeCompare(b.tanggal_mulai_rencana))
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        kegiatan: a.kegiatan,
        pic: a.pic,
        tanggalMulaiRencana: a.tanggal_mulai_rencana,
      }))

    const issues: ActivityIssueRow[] = phases
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
          }))
      )
      .sort((a, b) => b.overdueDays - a.overdueDays)

    return (
      <div className="space-y-8">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Progres Keseluruhan</span>
            <span className="font-medium text-gray-900">{overallPct}%</span>
          </div>
          <Progress value={overallPct} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {phases.map((phase) => (
            <PhaseSummaryCard
              key={phase.id}
              name={phase.name}
              picUtama={phase.pic_utama}
              activities={phase.activities}
            />
          ))}
        </div>

        <CriticalPathCard criticalCount={statusCounts.critical} finishDate={finishDate} />

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Kegiatan Mendatang</h2>
          <UpcomingActivitiesPanel activities={upcoming} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Perlu Perhatian</h2>
          <ActivityIssueTable issues={issues} showLocation={false} />
        </div>

        {kkConsent && kkConsent.target_kk > 0 && (
          <KkConsentSummaryBar
            locationCode={location.code}
            targetKk={kkConsent.target_kk}
            setuju={kkConsent.setuju}
            thresholdPct={kkConsent.threshold_pct}
          />
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Manual verification**

  Run: `npm run dev`, log in, click "Ringkasan" in the Sidebar for a location with activities
  across all 4 phases. Expected: the page no longer redirects to `fase-1` — it shows an overall
  progress bar, 4 phase cards, a Jalur Kritis card, an upcoming-activities list, a
  perlu-perhatian table, and — only if that location's `kk_consent.target_kk > 0` — a KK Consent
  summary bar linking to Page 3 (not built until Task 11, will 404 for now).

- [ ] **Step 4: Commit**

  ```bash
  git add "app/(app)/dashboard/[locationCode]/page.tsx"
  git commit -m "feat: rewrite per-location dashboard, replacing the fase-1 redirect stub"
  ```

---

## Task 10: `components/kk-consent/KkConsentForm.tsx`

**Files:**
- Create: `components/kk-consent/KkConsentForm.tsx`

**Interfaces:**
- Consumes: `Input` from `components/ui/input.tsx`; `Label` from `components/ui/label.tsx`;
  `Textarea` from `components/ui/textarea.tsx`; `Progress` from `components/ui/progress.tsx`
  (Task 2); `SaveStatusBadge`, `SaveStatus` from `components/activities/SaveStatusBadge.tsx`
  (Week 3, reused as-is); `useDebouncedCallback` from `hooks/useDebouncedCallback.ts` (Week 3,
  reused as-is); `cn` from `lib/utils.ts`; `KkConsent` from `lib/types.ts` (Task 3)
- Produces: `KkConsentForm` component (props: `locationId: string`, `initialData: KkConsent`,
  `isAdmin: boolean`) — consumed by the new KK Consent page (Task 11)

The debounce pattern here mirrors `ActivityTable.tsx`'s established shape exactly: a `pendingChanges`
ref accumulates every field change (not just the latest one) so that editing two fields within the
same 600ms window sends both, not just whichever was typed last.

- [ ] **Step 1: Create the file**

  ```typescript
  'use client'

  import { useCallback, useRef, useState } from 'react'
  import { toast } from 'sonner'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { Textarea } from '@/components/ui/textarea'
  import { Progress } from '@/components/ui/progress'
  import { SaveStatusBadge, type SaveStatus } from '@/components/activities/SaveStatusBadge'
  import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
  import { cn } from '@/lib/utils'
  import type { KkConsent } from '@/lib/types'

  interface KkConsentFormProps {
    locationId: string
    initialData: KkConsent
    isAdmin: boolean
  }

  type EditableFields = Pick<KkConsent, 'target_kk' | 'setuju' | 'menolak' | 'catatan'>

  export function KkConsentForm({ locationId, initialData, isAdmin }: KkConsentFormProps) {
    const [data, setData] = useState<KkConsent>(initialData)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
    const pendingChanges = useRef<Partial<EditableFields>>({})

    const setStatus = useCallback((status: SaveStatus) => {
      setSaveStatus(status)
      if (status === 'saved' || status === 'error') {
        setTimeout(
          () => {
            setSaveStatus((prev) => (prev === status ? 'idle' : prev))
          },
          status === 'saved' ? 2000 : 3000
        )
      }
    }, [])

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
        setData(json.data as KkConsent)
        setStatus('saved')
      } catch (err) {
        setStatus('error')
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan')
      }
    }, [locationId, setStatus])

    const debouncedFlush = useDebouncedCallback(() => {
      flushSave()
    }, 600)

    function handleFieldChange(changes: Partial<EditableFields>) {
      setData((prev) => ({ ...prev, ...changes }))
      pendingChanges.current = { ...pendingChanges.current, ...changes }
      debouncedFlush()
    }

    const pct = data.target_kk > 0 ? Math.round((data.setuju / data.target_kk) * 100) : 0
    const metThreshold = pct >= data.threshold_pct

    return (
      <div className="max-w-xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Persetujuan Warga (KK)</h2>
          <p className="text-xs text-gray-400 mt-1">Sesuai UU No. 20/2011 Pasal 65 Ayat (2)</p>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Progres Persetujuan</span>
            <span className={cn('font-medium', metThreshold ? 'text-green-600' : 'text-amber-600')}>
              {pct}% (ambang {data.threshold_pct}%)
            </span>
          </div>
          <Progress value={pct} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Target KK</Label>
            {isAdmin ? (
              <Input
                type="number"
                min={0}
                defaultValue={data.target_kk}
                onChange={(e) =>
                  handleFieldChange({ target_kk: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                }
              />
            ) : (
              <div className="text-sm text-gray-900">{data.target_kk}</div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Belum Dihubungi</Label>
            <div className="text-sm text-gray-500">{data.belum_dihubungi}</div>
          </div>
          <div className="space-y-1">
            <Label>Jumlah Setuju</Label>
            {isAdmin ? (
              <Input
                type="number"
                min={0}
                defaultValue={data.setuju}
                onChange={(e) =>
                  handleFieldChange({ setuju: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                }
              />
            ) : (
              <div className="text-sm text-gray-900">{data.setuju}</div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Jumlah Menolak</Label>
            {isAdmin ? (
              <Input
                type="number"
                min={0}
                defaultValue={data.menolak}
                onChange={(e) =>
                  handleFieldChange({ menolak: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                }
              />
            ) : (
              <div className="text-sm text-gray-900">{data.menolak}</div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Catatan</Label>
          {isAdmin ? (
            <Textarea
              defaultValue={data.catatan ?? ''}
              onChange={(e) => handleFieldChange({ catatan: e.target.value || null })}
              rows={3}
            />
          ) : (
            <div className="text-sm text-gray-500">{data.catatan ?? '–'}</div>
          )}
        </div>

        {isAdmin && (
          <div>
            <SaveStatusBadge status={saveStatus} />
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds (no consumers yet)

- [ ] **Step 3: Commit**

  ```bash
  git add components/kk-consent/KkConsentForm.tsx
  git commit -m "feat: add KkConsentForm with debounced auto-save"
  ```

---

## Task 11: `app/(app)/dashboard/[locationCode]/kk-consent/page.tsx` — New Page

**Files:**
- Create: `app/(app)/dashboard/[locationCode]/kk-consent/page.tsx`

**Interfaces:**
- Consumes: `getSession`, `isAdmin` from `lib/auth-helpers.ts`; `KkConsentForm` (Task 10);
  `KkConsent` from `lib/types.ts` (Task 3)
- Produces: the route itself — `components/layout/Sidebar.tsx`'s existing
  `/dashboard/{code}/kk-consent` link (Week 1) stops 404ing

- [ ] **Step 1: Create the page**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { getSession, isAdmin } from '@/lib/auth-helpers'
  import { KkConsentForm } from '@/components/kk-consent/KkConsentForm'
  import type { KkConsent } from '@/lib/types'

  export default async function KkConsentPage({
    params,
  }: {
    params: { locationCode: string }
  }) {
    const supabase = createClient()
    const { profile } = await getSession()
    const canEdit = profile ? isAdmin(profile.role) : false

    const { data: location } = await supabase
      .from('locations')
      .select('id, code')
      .eq('code', params.locationCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!location) notFound()

    const { data: kkConsent } = await supabase
      .from('kk_consent')
      .select('*')
      .eq('location_id', location.id)
      .single()

    if (!kkConsent) notFound()

    return (
      <KkConsentForm
        locationId={location.id}
        initialData={kkConsent as KkConsent}
        isAdmin={canEdit}
      />
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Manual verification**

  Run: `npm run dev`, log in as admin, click "Persetujuan Warga" in the Sidebar for any location.
  Expected: the page loads (no longer 404s), shows the progress bar and threshold marker, and
  editing Target KK / Setuju / Menolak / Catatan each triggers a debounced save (watch for
  "Menyimpan…" then "✓ Tersimpan"). Log in as a Viewer and confirm the same page shows plain
  read-only numbers with no inputs.

- [ ] **Step 4: Commit**

  ```bash
  git add "app/(app)/dashboard/[locationCode]/kk-consent/page.tsx"
  git commit -m "feat: add KK Consent tracker page"
  ```

---

## Task 12: Final Real-Browser E2E Pass and Progress Ledger

**Files:**
- Modify: `.superpowers/sdd/progress.md`

No code changes — this task verifies the full feature end-to-end with a real headless browser
(the approach established in Weeks 5-7 — drive Playwright's `chromium` module directly via
`require('playwright')`/`chromium.launch()`, since `chromium-cli` isn't available in this
environment; Chromium is already downloaded at `%LOCALAPPDATA%\ms-playwright\chromium-1223`, and
`playwright` is already an installed dependency in `package.json`). This is the pass that actually
clicks through the UI — do not substitute plain HTTP requests for this task.

- [ ] **Step 1: Prepare test data**

  Using an existing or new test location with at least 2 phases populated with activities: ensure
  at least one activity is `ditunda`, at least one has a `tanggal_selesai_rencana` in the past with
  a non-`selesai` status (for the Perlu Perhatian / Isu Lintas-Lokasi panels), and at least one is
  `is_on_critical_path = true` (already true for most seeded locations after Week 4's CPM runs).

- [ ] **Step 2: Real-browser pass**

  Write a throwaway Playwright script (Node, using the `chromium` module directly) to, as admin:
  - Open `/`. Confirm each location card shows a progress bar/%, 4 phase mini-bars, and
    kritis/ditunda/selesai counts matching the test data. Confirm the comparative table renders a
    row per location. Confirm the issues panel lists the ditunda/overdue test activities, sorted
    most-overdue-first. Screenshot.
  - Click into the test location's card, confirming it navigates to `/dashboard/{code}` (not a
    404, not the old fase-1 redirect).
  - On that page, confirm all 4 phase cards, the Jalur Kritis card (nonzero critical count, a real
    finish date), the Kegiatan Mendatang list, and the Perlu Perhatian table all show correct data.
  - If `target_kk` is 0 for this location, confirm the KK Consent summary bar is absent; use the
    KK Consent page to set a nonzero target, reload the dashboard, confirm the summary bar now
    appears with the correct percentage and links correctly.
  - On the KK Consent page, edit Target KK, Setuju, and Menolak in quick succession (within the
    same 600ms window) and confirm both changes are actually persisted after reload (verifies the
    `pendingChanges` accumulation, not just the last-typed field).
  - Log out, log in as Viewer: confirm `/` renders identically (no admin-only elements exist on
    this page to begin with), confirm the per-location dashboard renders identically, and confirm
    the KK Consent page shows read-only text with no inputs.
  - Check the browser console for errors after each step.
  - Put the script and screenshots in `.superpowers/sdd/` (gitignored scratch, not committed —
    same convention as Weeks 5-7).

- [ ] **Step 3: Clean up test data**

  Revert any test data changes (e.g. the `kk_consent` target you set) the same way prior weeks'
  verification passes cleaned up after themselves.

- [ ] **Step 4: Run the full test suite one more time**

  Run: `npm test`
  Expected: 61/61 passing

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 5: Record the outcome in the SDD progress ledger**

  Append to `.superpowers/sdd/progress.md`:
  ```markdown

  ## Week 8
  # Plan: docs/superpowers/plans/2026-07-04-minggu8-dashboard.md
  # Spec: docs/superpowers/specs/2026-07-04-minggu8-dashboard-design.md
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
    any bugs found and fixed during verification, following the pattern of Weeks 1-7's ledger
    entries — do not leave this as a template]
  - Week 8 implementation COMPLETE (fill in date)
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add .superpowers/sdd/progress.md
  git commit -m "chore: record Week 8 Dashboard E2E findings in SDD progress ledger"
  ```
