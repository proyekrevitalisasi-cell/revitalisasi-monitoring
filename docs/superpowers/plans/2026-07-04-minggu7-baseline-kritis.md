# Minggu 7: Baseline & Kritis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a UI to save, list, and activate baselines from the Timeline page (backend
has existed unused since Week 2), and populate the Fase table's "Baseline Mulai" / "Deviasi
(hari)" columns (currently hardcoded `–`). Critical-path highlighting itself is fully done as of
Week 6 and needs no new work this week.

**Architecture:** A new `BaselinePanel.tsx` (Dialog, same self-contained trigger pattern as
`DependencyPanel.tsx`) is rendered from `GanttChart.tsx`, gated by a new `isAdmin` prop threaded
down from `TimelinePage`. It calls the existing baseline API routes directly and calls
`router.refresh()` on success — the Timeline page already has no client mutation state (Week 6
design), so a server re-fetch is how it picks up the new/activated baseline, identical in spirit
to how `[faseSlug]/page.tsx` already re-fetches on navigation. Separately, `[faseSlug]/page.tsx`
fetches the active baseline's snapshot for the current phase's activities and threads it through
`ActivityTable` → `ActivityRow`, which renders it using `lib/gantt-layout.ts`'s
`computeDeviationDays` — already implemented and tested in Week 6, reused as-is with zero changes.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase JS v2 · shadcn/ui (no new
primitives — `Dialog`/`Button`/`Input`/`Textarea`/`Label`/`Badge` all already exist) · sonner
(toasts)

## Global Constraints

- `npm run build` must pass before every commit; `npm test` must keep passing (46 existing tests
  from Week 6 — no new pure functions this week, so no new test files)
- TypeScript strict — no implicit `any`
- No semicolons, single quotes — match this project's existing style exactly (see any file under
  `components/` or `lib/`)
- API response envelope stays `{ data: T | null, error: { code, message } | null }` — no API route
  changes this week, all three baseline routes are consumed as-is
- Admin-only UI is omitted entirely for non-admins (never rendered-but-disabled) — the existing
  convention in `ActivityTable.tsx` (`{isAdmin && <AddActivityDialog ... />}`) and
  `ActivityRow.tsx` (`{isAdmin && <DeleteActivityDialog ... />}`)
- No delete-baseline UI this week (`DELETE /api/baselines/[id]` stays API/SA-only) — see spec's
  "Out of scope"
- Every git commit message follows the existing convention: `feat:`/`fix:` prefix, one line
- Spec: `docs/superpowers/specs/2026-07-04-minggu7-baseline-kritis-design.md`

---

## Task 1: `lib/types.ts` — Add `Baseline` Type

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `Baseline` — consumed by `BaselinePanel.tsx` (Task 2), `TimelinePage` (Task 3)

- [ ] **Step 1: Add the type**

  Append to the end of `lib/types.ts` (after the existing `BaselineActivitySnapshot` interface):
  ```typescript
  export interface Baseline {
    id: string
    name: string
    description: string | null
    is_active: boolean
    created_at: string
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds (purely additive type, nothing consumes it yet)

- [ ] **Step 3: Commit**

  ```bash
  git add lib/types.ts
  git commit -m "feat: add Baseline type"
  ```

---

## Task 2: `components/gantt/BaselinePanel.tsx` — Save/List/Activate Dialog

**Files:**
- Create: `components/gantt/BaselinePanel.tsx`

**Interfaces:**
- Consumes: `Baseline` from `lib/types.ts` (Task 1); `Dialog`/`DialogTrigger`/`DialogContent`/
  `DialogHeader`/`DialogTitle` from `components/ui/dialog.tsx`; `Button` from
  `components/ui/button.tsx`; `Input` from `components/ui/input.tsx`; `Textarea` from
  `components/ui/textarea.tsx`; `Label` from `components/ui/label.tsx`; `Badge` from
  `components/ui/badge.tsx`; `useRouter` from `next/navigation`; `toast` from `sonner`
- Produces: `BaselinePanel` component (props: `locationId: string`, `baselines: Baseline[]`) —
  consumed by `GanttChart.tsx` (Task 3). No `isAdmin` prop on this component itself — the caller
  decides whether to render it at all, matching `AddActivityDialog`'s existing convention.

This component has no server data of its own — everything it needs (`baselines`) is passed in as
a prop from the page, same shape as `DependencyPanel` receiving `dependencies`.

- [ ] **Step 1: Create the file**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { useRouter } from 'next/navigation'
  import { toast } from 'sonner'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { Textarea } from '@/components/ui/textarea'
  import { Badge } from '@/components/ui/badge'
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from '@/components/ui/dialog'
  import type { Baseline } from '@/lib/types'

  interface BaselinePanelProps {
    locationId: string
    baselines: Baseline[]
  }

  export function BaselinePanel({ locationId, baselines }: BaselinePanelProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [activatingId, setActivatingId] = useState<string | null>(null)

    async function handleSave() {
      if (name.trim().length < 2) {
        toast.error('Nama baseline minimal 2 karakter')
        return
      }
      setSubmitting(true)
      try {
        const res = await fetch(`/api/locations/${locationId}/baselines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menyimpan baseline')
        }
        toast.success('Baseline disimpan')
        setName('')
        setDescription('')
        setOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan baseline')
      } finally {
        setSubmitting(false)
      }
    }

    async function handleActivate(id: string) {
      setActivatingId(id)
      try {
        const res = await fetch(`/api/baselines/${id}/activate`, { method: 'PATCH' })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal mengaktifkan baseline')
        }
        toast.success('Baseline diaktifkan')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal mengaktifkan baseline')
      } finally {
        setActivatingId(null)
      }
    }

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">Kelola Baseline</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kelola Baseline</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nama Baseline</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Baseline Awal"
            />
            <Label>Deskripsi (opsional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Simpan Baseline Baru'}
            </Button>
          </div>
          <div className="space-y-2 border-t pt-3">
            <Label>Riwayat Baseline</Label>
            {baselines.length === 0 && (
              <p className="text-sm text-gray-500">Belum ada baseline.</p>
            )}
            {baselines.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(b.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                {b.is_active ? (
                  <Badge>Aktif</Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleActivate(b.id)}
                    disabled={activatingId === b.id}
                  >
                    {activatingId === b.id ? 'Mengaktifkan…' : 'Aktifkan'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds (no consumers yet, same as Week 6 Task 4's constants file)

- [ ] **Step 3: Commit**

  ```bash
  git add components/gantt/BaselinePanel.tsx
  git commit -m "feat: add BaselinePanel save/list/activate dialog"
  ```

---

## Task 3: Wire `BaselinePanel` into the Timeline Page

**Files:**
- Modify: `app/(app)/dashboard/[locationCode]/timeline/page.tsx`
- Modify: `components/gantt/GanttChart.tsx`

**Interfaces:**
- Consumes: `getSession`, `isAdmin` from `lib/auth-helpers.ts`; `Baseline` from `lib/types.ts`
  (Task 1); `BaselinePanel` from `components/gantt/BaselinePanel.tsx` (Task 2)
- Produces: `GanttChart` now accepts `isAdmin: boolean`, `baselines: Baseline[]`,
  `locationId: string` props

- [ ] **Step 1: Add auth check and an all-baselines query to `TimelinePage`**

  In `app/(app)/dashboard/[locationCode]/timeline/page.tsx`, change the top of the file:
  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { GanttChart } from '@/components/gantt/GanttChart'
  import type { Dependency, BaselineActivitySnapshot } from '@/lib/types'

  export default async function TimelinePage({ params }: { params: { locationCode: string } }) {
    const supabase = createClient()
  ```
  to:
  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { getSession, isAdmin } from '@/lib/auth-helpers'
  import { GanttChart } from '@/components/gantt/GanttChart'
  import type { Dependency, BaselineActivitySnapshot, Baseline } from '@/lib/types'

  export default async function TimelinePage({ params }: { params: { locationCode: string } }) {
    const supabase = createClient()
    const { profile } = await getSession()
    const canEdit = profile ? isAdmin(profile.role) : false
  ```

  Then, right after the existing `activeBaseline`/`baselineActivities` block (the
  `let baselineActivities: BaselineActivitySnapshot[] = []` block and its `if (activeBaseline)`),
  add a query for every baseline at this location:
  ```typescript
    const { data: allBaselineRows } = await supabase
      .from('baselines')
      .select('id, name, description, is_active, created_at')
      .eq('location_id', location.id)
      .order('created_at', { ascending: false })
    const baselines = (allBaselineRows ?? []) as Baseline[]
  ```

- [ ] **Step 2: Pass the new props into `GanttChart`**

  Change:
  ```typescript
        <GanttChart
          phases={allPhases}
          dependencies={dependencies}
          baselineActivities={baselineActivities}
          holidays={holidays}
        />
  ```
  to:
  ```typescript
        <GanttChart
          phases={allPhases}
          dependencies={dependencies}
          baselineActivities={baselineActivities}
          holidays={holidays}
          isAdmin={canEdit}
          baselines={baselines}
          locationId={location.id}
        />
  ```

- [ ] **Step 3: Accept the new props in `GanttChart` and render `BaselinePanel`**

  In `components/gantt/GanttChart.tsx`, change the import block:
  ```typescript
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
  ```
  to:
  ```typescript
  import { GanttControls } from './GanttControls'
  import { GanttRow } from './GanttRow'
  import { GanttArrows } from './GanttArrows'
  import { BaselinePanel } from './BaselinePanel'
  import { DAY_WIDTH, ROW_HEIGHT, HEADER_HEIGHT, NAME_COLUMN_WIDTH, type GanttViewMode } from './gantt-constants'
  import type { Phase, Activity, Dependency, BaselineActivitySnapshot, Baseline } from '@/lib/types'

  interface GanttChartProps {
    phases: Phase[]
    dependencies: Dependency[]
    baselineActivities: BaselineActivitySnapshot[]
    holidays: string[]
    isAdmin: boolean
    baselines: Baseline[]
    locationId: string
  }
  ```

  Change the function signature:
  ```typescript
  export function GanttChart({ phases, dependencies, baselineActivities, holidays }: GanttChartProps) {
  ```
  to:
  ```typescript
  export function GanttChart({
    phases,
    dependencies,
    baselineActivities,
    holidays,
    isAdmin,
    baselines,
    locationId,
  }: GanttChartProps) {
  ```

  Finally, change the top of the returned JSX:
  ```typescript
    return (
      <div>
        <GanttControls
  ```
  to:
  ```typescript
    return (
      <div>
        {isAdmin && (
          <div className="flex justify-end mb-3">
            <BaselinePanel locationId={locationId} baselines={baselines} />
          </div>
        )}
        <GanttControls
  ```

- [ ] **Step 4: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 5: Manual browser verification**

  Run: `npm run dev`, log in as an admin user, open the Timeline page for any location.
  - Confirm a "Kelola Baseline" button appears above the Gantt chart.
  - Click it, confirm the dialog opens with an empty name field, a description field, and either
    "Belum ada baseline." or a list of existing baselines (depending on whether this location has
    any yet).
  - Type a name under 2 characters and click "Simpan Baseline Baru" — confirm a toast error
    appears and the dialog stays open.
  - Type a valid name (e.g. "Baseline Awal"), click "Simpan Baseline Baru" — confirm a success
    toast, the dialog closes, and the page refreshes (Gantt should now render a baseline bar layer
    for every activity, since Week 6's `GanttChart` already renders whatever `baselineActivities`
    it's given).
  - Log out, log back in as a Viewer — confirm the "Kelola Baseline" button is entirely absent
    from the Timeline page.

- [ ] **Step 6: Commit**

  ```bash
  git add "app/(app)/dashboard/[locationCode]/timeline/page.tsx" components/gantt/GanttChart.tsx
  git commit -m "feat: wire BaselinePanel into the Timeline page"
  ```

---

## Task 4: "Baseline Mulai" / "Deviasi (hari)" Columns — Fase Table

**Files:**
- Modify: `app/(app)/dashboard/[locationCode]/[faseSlug]/page.tsx`
- Modify: `components/activities/ActivityTable.tsx`
- Modify: `components/activities/ActivityRow.tsx`

**Interfaces:**
- Consumes: `computeDeviationDays` from `lib/gantt-layout.ts` (Week 6, already tested);
  `BaselineActivitySnapshot` from `lib/types.ts`
- Produces: `ActivityTable` and `ActivityRow` now accept a `baselineActivities:
  BaselineActivitySnapshot[]` prop

- [ ] **Step 1: Fetch the active baseline's snapshot for this phase in `[faseSlug]/page.tsx`**

  Change the import line:
  ```typescript
  import type { Dependency, LocationActivitySummary } from '@/lib/types'
  ```
  to:
  ```typescript
  import type { Dependency, LocationActivitySummary, BaselineActivitySnapshot } from '@/lib/types'
  ```

  Right after the existing holidays query:
  ```typescript
    const { data: holidayRows } = await supabase.from('work_calendar').select('holiday_date')
    const holidays = (holidayRows ?? []).map((h: { holiday_date: string }) => h.holiday_date)
  ```
  add:
  ```typescript
    const { data: activeBaseline } = await supabase
      .from('baselines')
      .select('id')
      .eq('location_id', location.id)
      .eq('is_active', true)
      .maybeSingle()

    const phaseActivityIds = phase.activities.map((a: { id: string }) => a.id)

    let baselineActivities: BaselineActivitySnapshot[] = []
    if (activeBaseline && phaseActivityIds.length) {
      const { data: baselineRows } = await supabase
        .from('baseline_activities')
        .select('activity_id, kegiatan, tanggal_mulai_rencana, tanggal_selesai_rencana, is_milestone')
        .eq('baseline_id', activeBaseline.id)
        .in('activity_id', phaseActivityIds)
      baselineActivities = baselineRows ?? []
    }
  ```

  Then pass it into `ActivityTable`. Change:
  ```typescript
        <ActivityTable
          phaseId={phase.id}
          initialActivities={phase.activities}
          dependencies={(dependencyRows ?? []) as Dependency[]}
          locationActivities={locationActivities}
          holidays={holidays}
          isAdmin={canEdit}
        />
  ```
  to:
  ```typescript
        <ActivityTable
          phaseId={phase.id}
          initialActivities={phase.activities}
          dependencies={(dependencyRows ?? []) as Dependency[]}
          locationActivities={locationActivities}
          holidays={holidays}
          baselineActivities={baselineActivities}
          isAdmin={canEdit}
        />
  ```

- [ ] **Step 2: Thread `baselineActivities` through `ActivityTable.tsx`**

  Change the import line:
  ```typescript
  import type { Activity, CpmSummary, Dependency, LocationActivitySummary } from '@/lib/types'
  ```
  to:
  ```typescript
  import type { Activity, CpmSummary, Dependency, LocationActivitySummary, BaselineActivitySnapshot } from '@/lib/types'
  ```

  Change the props interface:
  ```typescript
  interface ActivityTableProps {
    phaseId: string
    initialActivities: Activity[]
    dependencies: Dependency[]
    locationActivities: LocationActivitySummary[]
    holidays: string[]
    isAdmin: boolean
  }
  ```
  to:
  ```typescript
  interface ActivityTableProps {
    phaseId: string
    initialActivities: Activity[]
    dependencies: Dependency[]
    locationActivities: LocationActivitySummary[]
    holidays: string[]
    baselineActivities: BaselineActivitySnapshot[]
    isAdmin: boolean
  }
  ```

  Change the function signature:
  ```typescript
  export function ActivityTable({
    phaseId,
    initialActivities,
    dependencies: initialDependencies,
    locationActivities,
    holidays,
    isAdmin,
  }: ActivityTableProps) {
  ```
  to:
  ```typescript
  export function ActivityTable({
    phaseId,
    initialActivities,
    dependencies: initialDependencies,
    locationActivities,
    holidays,
    baselineActivities,
    isAdmin,
  }: ActivityTableProps) {
  ```

  Change the `ActivityRow` render call:
  ```typescript
              <ActivityRow
                key={activity.id}
                activity={activity}
                index={index}
                isFirst={index === 0}
                isLast={index === sortedActivities.length - 1}
                dependencies={dependencies}
                locationActivities={locationActivities}
                holidays={holidays}
                isAdmin={isAdmin}
  ```
  to:
  ```typescript
              <ActivityRow
                key={activity.id}
                activity={activity}
                index={index}
                isFirst={index === 0}
                isLast={index === sortedActivities.length - 1}
                dependencies={dependencies}
                locationActivities={locationActivities}
                holidays={holidays}
                baselineActivities={baselineActivities}
                isAdmin={isAdmin}
  ```

- [ ] **Step 3: Render real values in `ActivityRow.tsx`**

  Change the import lines:
  ```typescript
  import { computeDurasiHK } from '@/lib/calendar'
  import { validateRencanaDates, validateRealisasiDates } from '@/lib/activity-helpers'
  import { cn } from '@/lib/utils'
  import type { Activity, CpmSummary, Dependency, LocationActivitySummary } from '@/lib/types'
  ```
  to:
  ```typescript
  import { computeDurasiHK } from '@/lib/calendar'
  import { computeDeviationDays } from '@/lib/gantt-layout'
  import { validateRencanaDates, validateRealisasiDates } from '@/lib/activity-helpers'
  import { cn } from '@/lib/utils'
  import type { Activity, CpmSummary, Dependency, LocationActivitySummary, BaselineActivitySnapshot } from '@/lib/types'
  ```

  Change the props interface:
  ```typescript
  interface ActivityRowProps {
    activity: Activity
    index: number
    isFirst: boolean
    isLast: boolean
    dependencies: Dependency[]
    locationActivities: LocationActivitySummary[]
    holidays: string[]
    isAdmin: boolean
  ```
  to:
  ```typescript
  interface ActivityRowProps {
    activity: Activity
    index: number
    isFirst: boolean
    isLast: boolean
    dependencies: Dependency[]
    locationActivities: LocationActivitySummary[]
    holidays: string[]
    baselineActivities: BaselineActivitySnapshot[]
    isAdmin: boolean
  ```
  (the remaining fields of `ActivityRowProps` — `saveStatus` through `onDependencyDeleted` — are
  unchanged, this only inserts one new field before `isAdmin`)

  Change the function signature:
  ```typescript
  export function ActivityRow({
    activity,
    index,
    isFirst,
    isLast,
    dependencies,
    locationActivities,
    holidays,
    isAdmin,
  ```
  to:
  ```typescript
  export function ActivityRow({
    activity,
    index,
    isFirst,
    isLast,
    dependencies,
    locationActivities,
    holidays,
    baselineActivities,
    isAdmin,
  ```
  (the remaining destructured fields — `saveStatus` through `onDependencyDeleted` — are unchanged)

  Change the top of the function body:
  ```typescript
    const holidayDates = holidays.map((h) => new Date(h))
    const durasiHK = computeDurasiHK(activity.tanggal_mulai_rencana, activity.tanggal_selesai_rencana, holidayDates)
  ```
  to:
  ```typescript
    const holidayDates = holidays.map((h) => new Date(h))
    const durasiHK = computeDurasiHK(activity.tanggal_mulai_rencana, activity.tanggal_selesai_rencana, holidayDates)
    const baseline = baselineActivities.find((b) => b.activity_id === activity.id)
    const deviation = baseline
      ? computeDeviationDays(
          new Date(baseline.tanggal_mulai_rencana),
          new Date(activity.tanggal_mulai_rencana),
          holidayDates
        )
      : null
  ```

  Finally, change the two stub cells:
  ```typescript
      <TableCell className="text-center text-gray-500">{durasiHK}</TableCell>
      <TableCell className="text-gray-300">–</TableCell>
      <TableCell className="text-gray-300">–</TableCell>
  ```
  to:
  ```typescript
      <TableCell className="text-center text-gray-500">{durasiHK}</TableCell>
      <TableCell className="text-gray-500">{baseline?.tanggal_mulai_rencana ?? '–'}</TableCell>
      <TableCell className="text-center text-gray-500">
        {deviation === null ? '–' : deviation > 0 ? `+${deviation}` : deviation}
      </TableCell>
  ```

- [ ] **Step 4: Verify build**

  Run: `npm run build`
  Expected: succeeds

  Run: `npm test`
  Expected: 46 passed (unchanged — no new pure functions, `computeDeviationDays` already covered
  by Week 6's `lib/gantt-layout.test.ts`)

- [ ] **Step 5: Manual browser verification**

  Run: `npm run dev`. Before any baseline exists for a test location, open its Fase 1 page —
  confirm Baseline Mulai and Deviasi both show `–` for every activity. After using "Kelola
  Baseline" (Task 3) to save a baseline, reload the Fase page — confirm Baseline Mulai now shows
  each activity's current rencana start date and Deviasi shows `0`. Edit that activity's rencana
  start date — confirm Deviasi updates to a signed value (e.g. `+3`) without a page reload, while
  Baseline Mulai stays fixed at the original snapshot date.

- [ ] **Step 6: Commit**

  ```bash
  git add "app/(app)/dashboard/[locationCode]/[faseSlug]/page.tsx" components/activities/ActivityTable.tsx components/activities/ActivityRow.tsx
  git commit -m "feat: populate Baseline Mulai and Deviasi columns in the Fase table"
  ```

---

## Task 5: Final Real-Browser E2E Pass and Progress Ledger

**Files:**
- Modify: `.superpowers/sdd/progress.md`

No code changes — this task verifies the full feature end-to-end with a real headless browser
(the approach used successfully in Weeks 5 and 6 — drive Playwright's `chromium` module directly
since `chromium-cli` isn't available in this environment; Chromium is already downloaded at
`%LOCALAPPDATA%\ms-playwright\chromium-1223`), covering both the baseline-management UI and the
Fase table's new columns together, including the multi-baseline activate/revert flow that Tasks 3
and 4's individual manual checks didn't cover.

- [ ] **Step 1: Set up a test location**

  Create a test location with at least 2 activities across 2 phases (via `POST /api/locations`
  and the Fase table's "+ Tambah Kegiatan", same approach used in every prior week's verification
  pass).

- [ ] **Step 2: Real-browser pass — baseline lifecycle**

  Write a throwaway Playwright script (Node, using the `chromium` module directly) to, as admin:
  - Open the test location's Fase 1 page. Confirm every activity's Baseline Mulai and Deviasi
    cells read `–`. Screenshot.
  - Navigate to the Timeline page, open "Kelola Baseline", save a baseline named "Baseline Awal".
    Confirm it appears in the list marked "Aktif".
  - Return to Fase 1. Confirm Baseline Mulai now shows a real date and Deviasi shows `0` for every
    activity. Screenshot.
  - Edit one activity's `tanggal_mulai_rencana` to a later date. Confirm that row's Deviasi
    becomes a positive signed number (`+N`) matching the working-day gap, while Baseline Mulai is
    unchanged.
  - Return to Timeline, save a second baseline named "Baseline Rev-1". Confirm both baselines are
    now listed, with "Baseline Rev-1" marked "Aktif" and "Baseline Awal" showing an "Aktifkan"
    button.
  - Click "Aktifkan" on "Baseline Awal". Confirm the list re-marks it "Aktif".
  - Return to Fase 1, confirm Baseline Mulai reverted to "Baseline Awal"'s original snapshot date
    for the edited activity (not "Baseline Rev-1"'s later snapshot).
  - Use "+ Tambah Kegiatan" to add one new activity to Fase 1. Confirm its Baseline Mulai and
    Deviasi both read `–` (no snapshot exists for an activity created after every baseline save).
  - Check the browser console for errors after each step.
  - Log out, log in as a Viewer, open the Timeline page — confirm "Kelola Baseline" is entirely
    absent. Open Fase 1 — confirm Baseline Mulai/Deviasi render as plain text with no inputs, same
    as every other read-only column for this role.
  - Put the script and screenshots in `.superpowers/sdd/` (gitignored scratch, not committed —
    same convention as Weeks 5-6).

- [ ] **Step 3: Clean up test data**

  Deactivate the test location created in Step 1 the same way prior weeks' verification passes
  cleaned up (`DELETE /api/locations/{id}` as `super_admin`, or leave inactive-but-undeleted if
  the seeded admin account isn't `super_admin` — same documented precedent as Weeks 5-6's ledger
  entries).

- [ ] **Step 4: Run the full test suite one more time**

  Run: `npm test`
  Expected: 46 passed (unchanged)

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 5: Record the outcome in the SDD progress ledger**

  Append to `.superpowers/sdd/progress.md`:
  ```markdown

  ## Week 7
  # Plan: docs/superpowers/plans/2026-07-04-minggu7-baseline-kritis.md
  # Spec: docs/superpowers/specs/2026-07-04-minggu7-baseline-kritis-design.md
  - Task 1: complete
  - Task 2: complete
  - Task 3: complete
  - Task 4: complete
  - Task 5: COMPLETE via real headless-Chromium Playwright E2E. [fill in actual findings here —
    any bugs found and fixed during verification, following the pattern of Weeks 1-6's ledger
    entries — do not leave this as a template]
  - Week 7 implementation COMPLETE (fill in date)
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add .superpowers/sdd/progress.md
  git commit -m "chore: record Week 7 Baseline & Kritis E2E findings in SDD progress ledger"
  ```
