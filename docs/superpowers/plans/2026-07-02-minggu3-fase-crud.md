# Minggu 3: Fase CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fase page (`/dashboard/[locationCode]/fase-[1-4]`) — a full activities table with add/edit/delete/reorder, debounced auto-save, validation, status, and progress. All backend APIs already exist from Week 2; this plan is frontend-only plus one backend validation gap-fix.

**Architecture:** Server components fetch initial data (location, phase, activities, dependencies, holidays) via direct Supabase queries, matching the pattern already used by the home page and existing API routes. A client component `ActivityTable` holds activities in local state; every field edit updates state optimistically and fires a 600ms-debounced `PATCH /api/activities/[id]`. Per-row save-status indicators and toast notifications surface success/failure. Reorder uses ▲▼ buttons (no drag-and-drop library) calling `PATCH /api/activities/reorder`. Add/Delete use shadcn Dialogs calling the existing `POST`/`DELETE` activity routes.

**Tech Stack:** Next.js 14 App Router · React Server + Client Components · shadcn/ui (table, select, dialog, textarea, badge, sonner) · Supabase JS v2 · Zod (existing schemas) · date-fns v3

**Spec:** `docs/superpowers/specs/2026-07-02-minggu3-fase-crud-design.md`

## Global Constraints

- Response envelope unchanged: every fetch expects `{ data: T | null, error: { code, message } | null }`
- All activity mutations are already RBAC-gated server-side via `isAdmin()` — frontend hiding/disabling of Admin-only controls is UX only, never the security boundary
- Auto-save debounce is a uniform 600ms across all editable fields (text, date, textarea, toggles) — no per-field special-casing
- No new state-management library — plain `useState` + `fetch`, no SWR/React Query
- No drag-and-drop library — ▲▼ buttons only. `@dnd-kit/core` and `@dnd-kit/sortable` are pre-existing unused dependencies from project scaffold; do not wire them up
- No new date-picker library — native `<input type="date">`
- TypeScript strict — no implicit `any`
- `npm run build` must pass before every commit
- New components use named exports; Next.js pages/layouts use default export (framework requirement)
- Page-level composition uses the existing raw Tailwind palette (`gray-*`, `blue-*`, `red-*`), matching `components/layout/Sidebar.tsx` and `app/(app)/page.tsx` — shadcn primitives keep their own internal semantic tokens (`bg-primary`, etc.) unchanged
- Every task's git commit message follows the existing convention: `feat:` / `fix:` prefix, one line, no scope noise

---

## Task 1: Backend — PATCH Activity Date Validation

**Files:**
- Modify: `app/api/activities/[id]/route.ts:20-31`

**Interfaces:**
- No new exports. Adds a validation branch inside the existing `PATCH` handler, returning the same `VALIDATION_ERROR` shape already used elsewhere in this file.

**Context:** `POST /api/phases/[id]/activities` already rejects `tanggal_selesai_rencana < tanggal_mulai_rencana`, but `PATCH /api/activities/[id]` does not — a partial update that only changes one date can silently create `selesai < mulai`. This closes that gap by merging the incoming partial update against the current row before comparing.

- [ ] **Step 1: Add merged-date validation to the PATCH handler**

  In `app/api/activities/[id]/route.ts`, right after the existing block:

  ```typescript
    const { data: current } = await supabase
      .from('activities')
      .select('*')
      .eq('id', params.id)
      .single()
    if (!current) return notFound()
  ```

  insert:

  ```typescript
    const mergedMulaiRencana = parsed.data.tanggal_mulai_rencana ?? current.tanggal_mulai_rencana
    const mergedSelesaiRencana = parsed.data.tanggal_selesai_rencana ?? current.tanggal_selesai_rencana
    if (mergedSelesaiRencana < mergedMulaiRencana) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Tanggal selesai rencana harus setelah tanggal mulai rencana' } },
        { status: 400 }
      )
    }

    const mergedMulaiRealisasi =
      parsed.data.tanggal_mulai_realisasi !== undefined ? parsed.data.tanggal_mulai_realisasi : current.tanggal_mulai_realisasi
    const mergedSelesaiRealisasi =
      parsed.data.tanggal_selesai_realisasi !== undefined ? parsed.data.tanggal_selesai_realisasi : current.tanggal_selesai_realisasi
    if (mergedMulaiRealisasi && mergedSelesaiRealisasi && mergedSelesaiRealisasi < mergedMulaiRealisasi) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Tanggal selesai realisasi harus setelah tanggal mulai realisasi' } },
        { status: 400 }
      )
    }
  ```

  Note: `parsed.data.tanggal_mulai_realisasi` / `tanggal_selesai_realisasi` are `nullable().optional()`, so checking `!== undefined` (not just truthiness) correctly distinguishes "field not sent" from "field explicitly cleared to null".

- [ ] **Step 2: Verify types compile**

  Run: `npm run build`
  Expected: build succeeds with no TypeScript errors.

  Functional verification (does the API actually reject bad dates) happens in Task 11's manual E2E pass, once the Fase page UI exists to exercise it end-to-end.

- [ ] **Step 3: Commit**

  ```bash
  git add app/api/activities/[id]/route.ts
  git commit -m "fix: enforce selesai >= mulai on activity PATCH, not just POST"
  ```

---

## Task 2: shadcn/ui Components + Toast Mount

**Files:**
- Create: `components/ui/table.tsx`, `components/ui/select.tsx`, `components/ui/dialog.tsx`, `components/ui/textarea.tsx`, `components/ui/badge.tsx`, `components/ui/sonner.tsx` (all via shadcn CLI)
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` from `@/components/ui/table`; `Select, SelectTrigger, SelectValue, SelectContent, SelectItem` from `@/components/ui/select`; `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter` from `@/components/ui/dialog`; `Textarea` from `@/components/ui/textarea`; `Badge` from `@/components/ui/badge`; `Toaster` from `@/components/ui/sonner`; `toast` importable directly from the `sonner` package.

- [ ] **Step 1: Install components via shadcn CLI**

  ```bash
  npx shadcn@latest add table select dialog textarea badge sonner
  ```

  Accept any prompt to install missing Radix peer dependencies.

- [ ] **Step 2: Verify files exist**

  Confirm these files were created:
  ```
  components/ui/table.tsx
  components/ui/select.tsx
  components/ui/dialog.tsx
  components/ui/textarea.tsx
  components/ui/badge.tsx
  components/ui/sonner.tsx
  ```

- [ ] **Step 3: Mount the Toaster in the root layout**

  In `app/layout.tsx`, add the import and mount `<Toaster />` inside `<body>`:

  ```typescript
  import type { Metadata } from 'next'
  import { Inter } from 'next/font/google'
  import './globals.css'
  import { Toaster } from '@/components/ui/sonner'

  const inter = Inter({ subsets: ['latin'] })

  export const metadata: Metadata = {
    title: 'Dashboard Revitalisasi Perumnas',
    description: 'Sistem Pemantauan Multi-Lokasi Revitalisasi Rusun',
  }

  export default function RootLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
      <html lang="id">
        <body className={inter.className}>
          {children}
          <Toaster />
        </body>
      </html>
    )
  }
  ```

- [ ] **Step 4: Verify build**

  Run: `npm run build`
  Expected: build succeeds.

- [ ] **Step 5: Commit**

  ```bash
  git add -A
  git commit -m "feat: add shadcn table, select, dialog, textarea, badge, sonner components"
  ```

---

## Task 3: Shared Types, Debounce Hook, Activity Helpers

**Files:**
- Create: `lib/types.ts`
- Create: `hooks/useDebouncedCallback.ts`
- Create: `lib/activity-helpers.ts`

**Interfaces:**
- Consumes: `workingDaysBetween(start, end, holidays)` from `lib/calendar.ts` (existing, Week 2)
- Produces:
  - `lib/types.ts`: `ApiResponse<T>`, `ActivityStatus`, `Activity`, `Phase`, `Dependency` interfaces
  - `hooks/useDebouncedCallback.ts`: `useDebouncedCallback<Args extends unknown[]>(callback: (...args: Args) => void, delayMs: number): (...args: Args) => void`
  - `lib/activity-helpers.ts`: `computeDurasiHK(mulai: string, selesai: string, holidays: Date[]): number`, `validateRencanaDates(mulai: string, selesai: string): string | null`, `validateRealisasiDates(mulai: string | null, selesai: string | null): string | null`

- [ ] **Step 1: Create `lib/types.ts`**

  ```typescript
  export interface ApiResponse<T> {
    data: T | null
    error: { code: string; message: string } | null
  }

  export type ActivityStatus = 'belum_mulai' | 'sedang_berjalan' | 'selesai' | 'ditunda'

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

  export interface Phase {
    id: string
    location_id: string
    phase_code: 'F1' | 'F2' | 'F3' | 'F4'
    name: string
    pic_utama: string
    display_order: number
    activities: Activity[]
  }

  export interface Dependency {
    id: string
    predecessor_id: string
    successor_id: string
    dep_type: 'FS' | 'SS' | 'FF' | 'SF'
    lag_days: number
  }
  ```

- [ ] **Step 2: Create `hooks/useDebouncedCallback.ts`**

  ```typescript
  'use client'

  import { useCallback, useEffect, useRef } from 'react'

  export function useDebouncedCallback<Args extends unknown[]>(
    callback: (...args: Args) => void,
    delayMs: number
  ): (...args: Args) => void {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const callbackRef = useRef(callback)
    callbackRef.current = callback

    useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      }
    }, [])

    return useCallback(
      (...args: Args) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => callbackRef.current(...args), delayMs)
      },
      [delayMs]
    )
  }
  ```

- [ ] **Step 3: Create `lib/activity-helpers.ts`**

  ```typescript
  import { subDays } from 'date-fns'
  import { workingDaysBetween } from '@/lib/calendar'

  /**
   * Inclusive working-day count from mulai to selesai. Mirrors the inverse of
   * lib/templates.ts's `addWorkingDays(mulai, durationWorkingDays - 1, holidays)`.
   */
  export function computeDurasiHK(mulai: string, selesai: string, holidays: Date[]): number {
    const start = subDays(new Date(mulai), 1)
    const end = new Date(selesai)
    return workingDaysBetween(start, end, holidays)
  }

  export function validateRencanaDates(mulai: string, selesai: string): string | null {
    if (selesai < mulai) return 'Tanggal selesai rencana harus setelah tanggal mulai rencana'
    return null
  }

  export function validateRealisasiDates(mulai: string | null, selesai: string | null): string | null {
    if (mulai && selesai && selesai < mulai) {
      return 'Tanggal selesai realisasi harus setelah tanggal mulai realisasi'
    }
    return null
  }
  ```

- [ ] **Step 4: Verify build**

  Run: `npm run build`
  Expected: build succeeds (these files aren't imported anywhere yet, but must type-check standalone).

- [ ] **Step 5: Commit**

  ```bash
  git add lib/types.ts hooks/useDebouncedCallback.ts lib/activity-helpers.ts
  git commit -m "feat: add shared Activity types, debounce hook, activity helpers"
  ```

---

## Task 4: Location Layout + Phase Tabs + Redirect

**Files:**
- Create: `components/layout/PhaseTabs.tsx`
- Create: `app/(app)/dashboard/[locationCode]/layout.tsx`
- Create: `app/(app)/dashboard/[locationCode]/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`, `cn()` from `@/lib/utils`
- Produces: `PhaseTabs({ locationCode, phases }: { locationCode: string; phases: { id: string; phase_code: string; name: string }[] })` component

**Context:** The home page (`app/(app)/page.tsx`) already links to `/dashboard/[locationCode]`, which 404s today. This adds a location shell with a phase tab bar and a redirect from the bare location URL to `fase-1`, without building the full Week 8 dashboard.

- [ ] **Step 1: Create `components/layout/PhaseTabs.tsx`**

  ```typescript
  'use client'

  import Link from 'next/link'
  import { usePathname } from 'next/navigation'
  import { cn } from '@/lib/utils'

  interface PhaseTabsProps {
    locationCode: string
    phases: { id: string; phase_code: string; name: string }[]
  }

  export function PhaseTabs({ locationCode, phases }: PhaseTabsProps) {
    const pathname = usePathname()

    return (
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {phases.map((phase) => {
          const phaseNumber = phase.phase_code.replace('F', '')
          const href = `/dashboard/${locationCode}/fase-${phaseNumber}`
          const isActive = pathname === href

          return (
            <Link
              key={phase.id}
              href={href}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                isActive
                  ? 'text-blue-700 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-blue-700 hover:border-blue-300'
              )}
            >
              {phase.name}
            </Link>
          )
        })}
      </div>
    )
  }
  ```

- [ ] **Step 2: Create `app/(app)/dashboard/[locationCode]/layout.tsx`**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { PhaseTabs } from '@/components/layout/PhaseTabs'

  export default async function LocationLayout({
    children,
    params,
  }: {
    children: React.ReactNode
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

    const { data: phases } = await supabase
      .from('phases')
      .select('id, phase_code, name')
      .eq('location_id', location.id)
      .order('display_order')

    return (
      <div>
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">{location.name}</h1>
          <p className="text-sm text-gray-400">{location.code}</p>
        </div>

        <PhaseTabs locationCode={location.code} phases={phases ?? []} />

        {children}
      </div>
    )
  }
  ```

- [ ] **Step 3: Create `app/(app)/dashboard/[locationCode]/page.tsx`**

  ```typescript
  import { redirect } from 'next/navigation'

  export default function LocationIndexPage({ params }: { params: { locationCode: string } }) {
    redirect(`/dashboard/${params.locationCode}/fase-1`)
  }
  ```

- [ ] **Step 4: Verify build**

  Run: `npm run build`
  Expected: build succeeds.

- [ ] **Step 5: Commit**

  ```bash
  git add components/layout/PhaseTabs.tsx "app/(app)/dashboard/[locationCode]/layout.tsx" "app/(app)/dashboard/[locationCode]/page.tsx"
  git commit -m "feat: add location layout with phase tabs and redirect to fase-1"
  ```

---

## Task 5: Fase Page — Server Data Fetch

**Files:**
- Create: `app/(app)/dashboard/[locationCode]/fase-[phase]/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`; `getSession`, `isAdmin` from `@/lib/auth-helpers`; `ActivityTable` from `@/components/activities/ActivityTable` (produced in Task 6 — this task creates the page assuming that import path, `npm run build` will fail until Task 6 lands; that's expected and resolved by the end of Task 6)
- Produces: the `/dashboard/[locationCode]/fase-[1-4]` route

- [ ] **Step 1: Create `app/(app)/dashboard/[locationCode]/fase-[phase]/page.tsx`**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { getSession, isAdmin } from '@/lib/auth-helpers'
  import { ActivityTable } from '@/components/activities/ActivityTable'

  const VALID_PHASE_NUMBERS = ['1', '2', '3', '4']

  export default async function FasePage({
    params,
  }: {
    params: { locationCode: string; phase: string }
  }) {
    if (!VALID_PHASE_NUMBERS.includes(params.phase)) notFound()

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

    const phaseCode = `F${params.phase}`
    const { data: phase } = await supabase
      .from('phases')
      .select(`
        id, location_id, phase_code, name, pic_utama, display_order,
        activities (
          id, phase_id, display_order, kegiatan, pic,
          tanggal_mulai_rencana, tanggal_selesai_rencana,
          tanggal_mulai_realisasi, tanggal_selesai_realisasi,
          status, progress_pct, catatan, is_milestone, is_on_critical_path,
          date_locked, created_at, updated_at
        )
      `)
      .eq('location_id', location.id)
      .eq('phase_code', phaseCode)
      .order('display_order', { referencedTable: 'activities' })
      .single()

    if (!phase) notFound()

    const { data: allPhases } = await supabase
      .from('phases')
      .select('id')
      .eq('location_id', location.id)
    const phaseIds = (allPhases ?? []).map((p: { id: string }) => p.id)

    const { data: allActivityRows } = phaseIds.length
      ? await supabase.from('activities').select('id').in('phase_id', phaseIds)
      : { data: [] }
    const allActivityIds = (allActivityRows ?? []).map((a: { id: string }) => a.id)

    const { data: dependencies } = allActivityIds.length
      ? await supabase
          .from('activity_dependencies')
          .select('id, predecessor_id, successor_id, dep_type, lag_days')
          .in('predecessor_id', allActivityIds)
      : { data: [] }

    const depCounts: Record<string, number> = {}
    for (const dep of dependencies ?? []) {
      depCounts[dep.predecessor_id] = (depCounts[dep.predecessor_id] ?? 0) + 1
      depCounts[dep.successor_id] = (depCounts[dep.successor_id] ?? 0) + 1
    }

    const { data: holidayRows } = await supabase.from('work_calendar').select('holiday_date')
    const holidays = (holidayRows ?? []).map((h: { holiday_date: string }) => h.holiday_date)

    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{phase.name}</h2>
        <ActivityTable
          phaseId={phase.id}
          initialActivities={phase.activities}
          depCounts={depCounts}
          holidays={holidays}
          isAdmin={canEdit}
        />
      </div>
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add "app/(app)/dashboard/[locationCode]/fase-[phase]/page.tsx"
  git commit -m "feat: add fase page server data fetch (activities, deps, holidays)"
  ```

  (Build verification deferred to Task 6, which creates `ActivityTable`.)

---

## Task 6: ActivityTable + ActivityRow — Table Shell, Read-Only Cells, Auto-Save for Text/Date/Textarea

**Files:**
- Create: `components/activities/SaveStatusBadge.tsx`
- Create: `components/activities/ActivityRow.tsx`
- Create: `components/activities/ActivityTable.tsx`

**Interfaces:**
- Consumes: `Activity` from `@/lib/types`; `useDebouncedCallback` from `@/hooks/useDebouncedCallback`; `computeDurasiHK`, `validateRencanaDates`, `validateRealisasiDates` from `@/lib/activity-helpers`; `Table/TableHeader/TableBody/TableRow/TableHead/TableCell` from `@/components/ui/table`; `Input` from `@/components/ui/input`; `Textarea` from `@/components/ui/textarea`; `Badge` from `@/components/ui/badge`; `toast` from `sonner`
- Produces:
  - `SaveStatus = 'idle' | 'saving' | 'saved' | 'error'`, `SaveStatusBadge({ status: SaveStatus })`
  - `ActivityRow` props: `{ activity: Activity; index: number; isFirst: boolean; isLast: boolean; depCount: number; holidays: string[]; isAdmin: boolean; saveStatus: SaveStatus; onFieldChange: (id: string, changes: Partial<Activity>) => void; onMove: (id: string, direction: 'up' | 'down') => void; onToggleLock: (id: string) => void }` (`onMove`/`onToggleLock` are wired to real handlers in Tasks 7–8; this task passes no-op stubs so the component compiles)
  - `ActivityTable` props: `{ phaseId: string; initialActivities: Activity[]; depCounts: Record<string, number>; holidays: string[]; isAdmin: boolean }`

- [ ] **Step 1: Create `components/activities/SaveStatusBadge.tsx`**

  ```typescript
  'use client'

  export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

  const CONFIG: Record<Exclude<SaveStatus, 'idle'>, { text: string; className: string }> = {
    saving: { text: 'Menyimpan…', className: 'text-gray-400' },
    saved: { text: '✓ Tersimpan', className: 'text-green-600' },
    error: { text: '⚠ Gagal', className: 'text-red-600' },
  }

  export function SaveStatusBadge({ status }: { status: SaveStatus }) {
    if (status === 'idle') return null
    const config = CONFIG[status]
    return <span className={`text-xs whitespace-nowrap ${config.className}`}>{config.text}</span>
  }
  ```

- [ ] **Step 2: Create `components/activities/ActivityRow.tsx`**

  ```typescript
  'use client'

  import { toast } from 'sonner'
  import { TableCell, TableRow } from '@/components/ui/table'
  import { Input } from '@/components/ui/input'
  import { Textarea } from '@/components/ui/textarea'
  import { Badge } from '@/components/ui/badge'
  import { SaveStatusBadge, type SaveStatus } from './SaveStatusBadge'
  import { computeDurasiHK, validateRencanaDates, validateRealisasiDates } from '@/lib/activity-helpers'
  import type { Activity } from '@/lib/types'

  const STATUS_LABELS: Record<Activity['status'], string> = {
    belum_mulai: 'Belum Mulai',
    sedang_berjalan: 'Sedang Berjalan',
    selesai: 'Selesai',
    ditunda: 'Ditunda',
  }

  interface ActivityRowProps {
    activity: Activity
    index: number
    isFirst: boolean
    isLast: boolean
    depCount: number
    holidays: string[]
    isAdmin: boolean
    saveStatus: SaveStatus
    onFieldChange: (id: string, changes: Partial<Activity>) => void
    onMove: (id: string, direction: 'up' | 'down') => void
    onToggleLock: (id: string) => void
  }

  export function ActivityRow({
    activity,
    index,
    isFirst,
    isLast,
    depCount,
    holidays,
    isAdmin,
    saveStatus,
    onFieldChange,
    onMove,
    onToggleLock,
  }: ActivityRowProps) {
    const holidayDates = holidays.map((h) => new Date(h))
    const durasiHK = computeDurasiHK(activity.tanggal_mulai_rencana, activity.tanggal_selesai_rencana, holidayDates)

    function handleRencanaDateChange(field: 'tanggal_mulai_rencana' | 'tanggal_selesai_rencana', value: string) {
      const mulai = field === 'tanggal_mulai_rencana' ? value : activity.tanggal_mulai_rencana
      const selesai = field === 'tanggal_selesai_rencana' ? value : activity.tanggal_selesai_rencana
      const validationError = validateRencanaDates(mulai, selesai)
      if (validationError) {
        toast.error(validationError)
        return
      }
      onFieldChange(activity.id, { [field]: value })
    }

    function handleRealisasiDateChange(field: 'tanggal_mulai_realisasi' | 'tanggal_selesai_realisasi', value: string) {
      const nextValue = value || null
      const mulai = field === 'tanggal_mulai_realisasi' ? nextValue : activity.tanggal_mulai_realisasi
      const selesai = field === 'tanggal_selesai_realisasi' ? nextValue : activity.tanggal_selesai_realisasi
      const validationError = validateRealisasiDates(mulai, selesai)
      if (validationError) {
        toast.error(validationError)
        return
      }
      onFieldChange(activity.id, { [field]: nextValue })
    }

    return (
      <TableRow className={activity.is_on_critical_path ? 'bg-red-50/40' : undefined}>
        {isAdmin && (
          <TableCell>
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => onMove(activity.id, 'up')}
                disabled={isFirst}
                className="text-gray-400 hover:text-blue-600 disabled:opacity-20 text-xs leading-none"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => onMove(activity.id, 'down')}
                disabled={isLast}
                className="text-gray-400 hover:text-blue-600 disabled:opacity-20 text-xs leading-none"
              >
                ▼
              </button>
            </div>
          </TableCell>
        )}
        <TableCell className="text-xs text-gray-400">{index + 1}</TableCell>
        <TableCell>{activity.is_milestone ? '♦' : ''}</TableCell>
        <TableCell>
          <button
            type="button"
            onClick={() => onToggleLock(activity.id)}
            disabled={!isAdmin}
            className={activity.date_locked ? 'opacity-100' : 'opacity-20'}
            title="Toggle kunci tanggal"
          >
            🔒
          </button>
        </TableCell>
        <TableCell>{activity.is_on_critical_path && <Badge variant="destructive">Kritis</Badge>}</TableCell>
        <TableCell>
          {isAdmin ? (
            // defaultValue (uncontrolled): keeps the caret stable while the debounced
            // save round-trips, instead of re-rendering the DOM value on every parent update.
            <Input
              defaultValue={activity.kegiatan}
              onChange={(e) => onFieldChange(activity.id, { kegiatan: e.target.value })}
              className="h-8 min-w-[220px]"
            />
          ) : (
            activity.kegiatan
          )}
        </TableCell>
        <TableCell>
          {isAdmin ? (
            <Input
              defaultValue={activity.pic}
              onChange={(e) => onFieldChange(activity.id, { pic: e.target.value })}
              className="h-8 w-24"
            />
          ) : (
            activity.pic
          )}
        </TableCell>
        <TableCell>
          <Badge variant="secondary">{depCount}</Badge>
        </TableCell>
        <TableCell>
          {isAdmin ? (
            <Input
              type="date"
              defaultValue={activity.tanggal_mulai_rencana}
              onChange={(e) => handleRencanaDateChange('tanggal_mulai_rencana', e.target.value)}
              className="h-8"
            />
          ) : (
            activity.tanggal_mulai_rencana
          )}
        </TableCell>
        <TableCell>
          {isAdmin ? (
            <Input
              type="date"
              defaultValue={activity.tanggal_selesai_rencana}
              onChange={(e) => handleRencanaDateChange('tanggal_selesai_rencana', e.target.value)}
              className="h-8"
            />
          ) : (
            activity.tanggal_selesai_rencana
          )}
        </TableCell>
        <TableCell className="text-center text-gray-500">{durasiHK}</TableCell>
        <TableCell className="text-gray-300">–</TableCell>
        <TableCell className="text-gray-300">–</TableCell>
        <TableCell>
          {isAdmin ? (
            <Input
              type="date"
              defaultValue={activity.tanggal_mulai_realisasi ?? ''}
              onChange={(e) => handleRealisasiDateChange('tanggal_mulai_realisasi', e.target.value)}
              className="h-8"
            />
          ) : (
            activity.tanggal_mulai_realisasi ?? '–'
          )}
        </TableCell>
        <TableCell>
          {isAdmin ? (
            <Input
              type="date"
              defaultValue={activity.tanggal_selesai_realisasi ?? ''}
              onChange={(e) => handleRealisasiDateChange('tanggal_selesai_realisasi', e.target.value)}
              className="h-8"
            />
          ) : (
            activity.tanggal_selesai_realisasi ?? '–'
          )}
        </TableCell>
        <TableCell>{STATUS_LABELS[activity.status]}</TableCell>
        <TableCell className="text-center">{activity.progress_pct}%</TableCell>
        <TableCell>
          {isAdmin ? (
            <Textarea
              defaultValue={activity.catatan ?? ''}
              onChange={(e) => onFieldChange(activity.id, { catatan: e.target.value || null })}
              className="h-8 min-w-[160px] resize-none"
              rows={1}
            />
          ) : (
            activity.catatan ?? '–'
          )}
        </TableCell>
        <TableCell className="text-gray-300">–</TableCell>
        {isAdmin && (
          <TableCell>
            <SaveStatusBadge status={saveStatus} />
          </TableCell>
        )}
        {isAdmin && <TableCell />}
      </TableRow>
    )
  }
  ```

  Status select, progress buttons, and milestone toggle stay read-only text in this task — they become interactive in Task 7. `onMove`/`onToggleLock` are already wired to real props here since the row shell needs the callback signature; Task 7/8 supply the real implementations in `ActivityTable`.

- [ ] **Step 3: Create `components/activities/ActivityTable.tsx`**

  ```typescript
  'use client'

  import { useCallback, useRef, useState } from 'react'
  import { toast } from 'sonner'
  import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
  import { ActivityRow } from './ActivityRow'
  import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
  import type { Activity } from '@/lib/types'
  import type { SaveStatus } from './SaveStatusBadge'

  interface ActivityTableProps {
    phaseId: string
    initialActivities: Activity[]
    depCounts: Record<string, number>
    holidays: string[]
    isAdmin: boolean
  }

  export function ActivityTable({ phaseId, initialActivities, depCounts, holidays, isAdmin }: ActivityTableProps) {
    const [activities, setActivities] = useState<Activity[]>(initialActivities)
    const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({})
    const pendingChanges = useRef<Record<string, Partial<Activity>>>({})
    const savedSnapshots = useRef<Record<string, Activity>>(
      Object.fromEntries(initialActivities.map((a) => [a.id, a]))
    )

    const setRowStatus = useCallback((id: string, status: SaveStatus) => {
      setSaveStatuses((prev) => ({ ...prev, [id]: status }))
      if (status === 'saved' || status === 'error') {
        setTimeout(
          () => {
            setSaveStatuses((prev) => (prev[id] === status ? { ...prev, [id]: 'idle' } : prev))
          },
          status === 'saved' ? 2000 : 3000
        )
      }
    }, [])

    const flushSave = useCallback(
      async (id: string) => {
        const changes = pendingChanges.current[id]
        if (!changes) return
        delete pendingChanges.current[id]
        setRowStatus(id, 'saving')

        try {
          const res = await fetch(`/api/activities/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changes),
          })
          const json = await res.json()
          if (!res.ok || json.error) {
            throw new Error(json.error?.message ?? 'Gagal menyimpan perubahan')
          }
          const updated = json.data as Activity
          savedSnapshots.current[id] = updated
          setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)))
          setRowStatus(id, 'saved')
        } catch (err) {
          const snapshot = savedSnapshots.current[id]
          setActivities((prev) => prev.map((a) => (a.id === id ? snapshot : a)))
          setRowStatus(id, 'error')
          toast.error(err instanceof Error ? err.message : 'Gagal menyimpan perubahan')
        }
      },
      [setRowStatus]
    )

    const debouncedFlush = useDebouncedCallback((id: string) => {
      flushSave(id)
    }, 600)

    const handleFieldChange = useCallback(
      (id: string, changes: Partial<Activity>) => {
        setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)))
        pendingChanges.current[id] = { ...pendingChanges.current[id], ...changes }
        debouncedFlush(id)
      },
      [debouncedFlush]
    )

    // Wired to real reorder/lock logic in Tasks 7-8; no-op placeholders keep this task self-contained.
    const handleMove = useCallback((_id: string, _direction: 'up' | 'down') => {}, [])
    const handleToggleLock = useCallback((_id: string) => {}, [])

    const sortedActivities = [...activities].sort((a, b) => a.display_order - b.display_order)

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead className="w-8" />}
              <TableHead className="w-10">Urut</TableHead>
              <TableHead className="w-8">♦</TableHead>
              <TableHead className="w-8">🔒</TableHead>
              <TableHead className="w-16">Kritis</TableHead>
              <TableHead>Kegiatan</TableHead>
              <TableHead>PIC</TableHead>
              <TableHead className="w-14">Dep</TableHead>
              <TableHead>Rencana Mulai</TableHead>
              <TableHead>Rencana Selesai</TableHead>
              <TableHead className="w-20">Durasi (HK)</TableHead>
              <TableHead>Baseline Mulai</TableHead>
              <TableHead className="w-20">Deviasi</TableHead>
              <TableHead>Realisasi Mulai</TableHead>
              <TableHead>Realisasi Selesai</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">%</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead className="w-16">Risiko</TableHead>
              {isAdmin && <TableHead className="w-20">Simpan</TableHead>}
              {isAdmin && <TableHead className="w-8" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedActivities.map((activity, index) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                index={index}
                isFirst={index === 0}
                isLast={index === sortedActivities.length - 1}
                depCount={depCounts[activity.id] ?? 0}
                holidays={holidays}
                isAdmin={isAdmin}
                saveStatus={saveStatuses[activity.id] ?? 'idle'}
                onFieldChange={handleFieldChange}
                onMove={handleMove}
                onToggleLock={handleToggleLock}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }
  ```

- [ ] **Step 4: Verify build**

  Run: `npm run build`
  Expected: build succeeds. This resolves the `ActivityTable` import added by Task 5.

- [ ] **Step 5: Commit**

  ```bash
  git add components/activities/SaveStatusBadge.tsx components/activities/ActivityRow.tsx components/activities/ActivityTable.tsx
  git commit -m "feat: add ActivityTable/ActivityRow with debounced auto-save for text/date/textarea fields"
  ```

---

## Task 7: Status Select, Progress Buttons, Milestone Toggle, Lock Toggle

**Files:**
- Modify: `components/activities/ActivityRow.tsx`
- Modify: `components/activities/ActivityTable.tsx`

**Interfaces:**
- Consumes: `Select, SelectTrigger, SelectValue, SelectContent, SelectItem` from `@/components/ui/select`; `cn` from `@/lib/utils`
- Produces: `ActivityTable`'s real `handleToggleLock(id: string): Promise<void>` (replaces the Task 6 no-op), calling `PATCH /api/activities/[id]/lock`

**Context:** `PATCH /api/activities/[id]/lock` takes no body — the server flips `date_locked` itself — so this goes through its own immediate fetch, not the generic debounced `onFieldChange` path used by every other field.

- [ ] **Step 1: Replace the milestone cell in `ActivityRow.tsx`**

  Replace:
  ```typescript
        <TableCell>{activity.is_milestone ? '♦' : ''}</TableCell>
  ```
  with:
  ```typescript
        <TableCell>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => onFieldChange(activity.id, { is_milestone: !activity.is_milestone })}
              className={activity.is_milestone ? 'opacity-100' : 'opacity-20'}
              title="Toggle milestone"
            >
              ♦
            </button>
          ) : (
            activity.is_milestone ? '♦' : ''
          )}
        </TableCell>
  ```

- [ ] **Step 2: Replace the status cell in `ActivityRow.tsx`**

  Add the import at the top of the file:
  ```typescript
  import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
  ```

  Replace:
  ```typescript
        <TableCell>{STATUS_LABELS[activity.status]}</TableCell>
  ```
  with:
  ```typescript
        <TableCell>
          {isAdmin ? (
            <Select
              value={activity.status}
              onValueChange={(value) => {
                const changes: Partial<Activity> = { status: value as Activity['status'] }
                if (value === 'selesai') changes.progress_pct = 100
                if (value === 'belum_mulai') changes.progress_pct = 0
                onFieldChange(activity.id, changes)
              }}
            >
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(STATUS_LABELS) as [Activity['status'], string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={activity.status === 'selesai' ? 'default' : 'secondary'}>
              {STATUS_LABELS[activity.status]}
            </Badge>
          )}
        </TableCell>
  ```

- [ ] **Step 3: Replace the progress cell in `ActivityRow.tsx`**

  Add the import at the top of the file:
  ```typescript
  import { cn } from '@/lib/utils'
  ```

  Replace:
  ```typescript
        <TableCell className="text-center">{activity.progress_pct}%</TableCell>
  ```
  with:
  ```typescript
        <TableCell>
          {isAdmin ? (
            <div className="flex flex-col gap-1">
              <div className="flex gap-0.5">
                {[0, 25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onFieldChange(activity.id, { progress_pct: pct })}
                    className={cn(
                      'text-[10px] px-1 py-0.5 rounded border',
                      activity.progress_pct === pct
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                    )}
                  >
                    {pct}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min={0}
                max={100}
                value={activity.progress_pct}
                onChange={(e) => {
                  const value = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                  onFieldChange(activity.id, { progress_pct: value })
                }}
                className="h-6 w-16 text-xs"
              />
            </div>
          ) : (
            `${activity.progress_pct}%`
          )}
        </TableCell>
  ```

  Note: the progress number input is controlled (`value=`, not `defaultValue=`) — unlike text fields, it must stay in sync when the quick-buttons change `progress_pct` from outside the input itself.

- [ ] **Step 4: Add the real lock-toggle handler to `ActivityTable.tsx`**

  Replace:
  ```typescript
    // Wired to real reorder/lock logic in Tasks 7-8; no-op placeholders keep this task self-contained.
    const handleMove = useCallback((_id: string, _direction: 'up' | 'down') => {}, [])
    const handleToggleLock = useCallback((_id: string) => {}, [])
  ```
  with:
  ```typescript
    // Wired to real reorder logic in Task 8.
    const handleMove = useCallback((_id: string, _direction: 'up' | 'down') => {}, [])

    const handleToggleLock = useCallback(
      async (id: string) => {
        setRowStatus(id, 'saving')
        try {
          const res = await fetch(`/api/activities/${id}/lock`, { method: 'PATCH' })
          const json = await res.json()
          if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Gagal mengubah kunci tanggal')
          const dateLocked = json.data.date_locked as boolean
          setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, date_locked: dateLocked } : a)))
          savedSnapshots.current[id] = { ...savedSnapshots.current[id], date_locked: dateLocked }
          setRowStatus(id, 'saved')
        } catch (err) {
          setRowStatus(id, 'error')
          toast.error(err instanceof Error ? err.message : 'Gagal mengubah kunci tanggal')
        }
      },
      [setRowStatus]
    )
  ```

- [ ] **Step 5: Verify build**

  Run: `npm run build`
  Expected: build succeeds.

- [ ] **Step 6: Commit**

  ```bash
  git add components/activities/ActivityRow.tsx components/activities/ActivityTable.tsx
  git commit -m "feat: wire status select, progress buttons, milestone/lock toggles"
  ```

---

## Task 8: Reorder (▲▼ Buttons)

**Files:**
- Modify: `components/activities/ActivityTable.tsx`

**Interfaces:**
- Produces: `ActivityTable`'s real `handleMove(id: string, direction: 'up' | 'down'): Promise<void>` (replaces the Task 6/7 no-op), calling `PATCH /api/activities/reorder`

- [ ] **Step 1: Replace the move handler in `ActivityTable.tsx`**

  Replace:
  ```typescript
    // Wired to real reorder logic in Task 8.
    const handleMove = useCallback((_id: string, _direction: 'up' | 'down') => {}, [])
  ```
  with:
  ```typescript
    const handleMove = useCallback(
      async (id: string, direction: 'up' | 'down') => {
        const sorted = [...activities].sort((a, b) => a.display_order - b.display_order)
        const currentIndex = sorted.findIndex((a) => a.id === id)
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
        if (currentIndex === -1 || targetIndex < 0 || targetIndex >= sorted.length) return

        const current = sorted[currentIndex]
        const target = sorted[targetIndex]
        const swappedOrders: Record<string, number> = {
          [current.id]: target.display_order,
          [target.id]: current.display_order,
        }

        setActivities((prev) =>
          prev.map((a) => (a.id in swappedOrders ? { ...a, display_order: swappedOrders[a.id] } : a))
        )

        try {
          const res = await fetch('/api/activities/reorder', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: [
                { id: current.id, display_order: target.display_order },
                { id: target.id, display_order: current.display_order },
              ],
            }),
          })
          const json = await res.json()
          if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Gagal mengubah urutan')
        } catch (err) {
          setActivities((prev) =>
            prev.map((a) => {
              if (a.id === current.id) return { ...a, display_order: current.display_order }
              if (a.id === target.id) return { ...a, display_order: target.display_order }
              return a
            })
          )
          toast.error(err instanceof Error ? err.message : 'Gagal mengubah urutan')
        }
      },
      [activities]
    )
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: build succeeds.

- [ ] **Step 3: Commit**

  ```bash
  git add components/activities/ActivityTable.tsx
  git commit -m "feat: wire up/down reorder buttons to PATCH /api/activities/reorder"
  ```

---

## Task 9: Add Activity Dialog

**Files:**
- Create: `components/activities/AddActivityDialog.tsx`
- Modify: `components/activities/ActivityTable.tsx`

**Interfaces:**
- Consumes: `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter` from `@/components/ui/dialog`; `Button` from `@/components/ui/button`; `Label` from `@/components/ui/label`; `validateRencanaDates` from `@/lib/activity-helpers`
- Produces: `AddActivityDialog({ phaseId: string; onCreated: (activity: Activity) => void })`

- [ ] **Step 1: Create `components/activities/AddActivityDialog.tsx`**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { toast } from 'sonner'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { Textarea } from '@/components/ui/textarea'
  import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from '@/components/ui/dialog'
  import { validateRencanaDates } from '@/lib/activity-helpers'
  import type { Activity } from '@/lib/types'

  interface AddActivityDialogProps {
    phaseId: string
    onCreated: (activity: Activity) => void
  }

  const EMPTY_FORM = {
    kegiatan: '',
    pic: '',
    tanggal_mulai_rencana: '',
    tanggal_selesai_rencana: '',
    is_milestone: false,
    catatan: '',
  }

  export function AddActivityDialog({ phaseId, onCreated }: AddActivityDialogProps) {
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit() {
      if (!form.kegiatan.trim() || !form.pic.trim() || !form.tanggal_mulai_rencana || !form.tanggal_selesai_rencana) {
        toast.error('Kegiatan, PIC, dan tanggal rencana wajib diisi')
        return
      }
      const validationError = validateRencanaDates(form.tanggal_mulai_rencana, form.tanggal_selesai_rencana)
      if (validationError) {
        toast.error(validationError)
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch(`/api/phases/${phaseId}/activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kegiatan: form.kegiatan,
            pic: form.pic,
            tanggal_mulai_rencana: form.tanggal_mulai_rencana,
            tanggal_selesai_rencana: form.tanggal_selesai_rencana,
            is_milestone: form.is_milestone,
            catatan: form.catatan || undefined,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Gagal menambah kegiatan')
        onCreated(json.data as Activity)
        toast.success('Kegiatan ditambahkan')
        setForm(EMPTY_FORM)
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menambah kegiatan')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            + Tambah Kegiatan
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Kegiatan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="add-kegiatan">Kegiatan</Label>
              <Input
                id="add-kegiatan"
                value={form.kegiatan}
                onChange={(e) => setForm({ ...form, kegiatan: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="add-pic">PIC</Label>
              <Input id="add-pic" value={form.pic} onChange={(e) => setForm({ ...form, pic: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="add-mulai">Rencana Mulai</Label>
                <Input
                  id="add-mulai"
                  type="date"
                  value={form.tanggal_mulai_rencana}
                  onChange={(e) => setForm({ ...form, tanggal_mulai_rencana: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="add-selesai">Rencana Selesai</Label>
                <Input
                  id="add-selesai"
                  type="date"
                  value={form.tanggal_selesai_rencana}
                  onChange={(e) => setForm({ ...form, tanggal_selesai_rencana: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="add-milestone"
                type="checkbox"
                checked={form.is_milestone}
                onChange={(e) => setForm({ ...form, is_milestone: e.target.checked })}
              />
              <Label htmlFor="add-milestone">Milestone</Label>
            </div>
            <div>
              <Label htmlFor="add-catatan">Catatan</Label>
              <Textarea
                id="add-catatan"
                value={form.catatan}
                onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
  ```

- [ ] **Step 2: Wire it into `ActivityTable.tsx`**

  Add the import:
  ```typescript
  import { AddActivityDialog } from './AddActivityDialog'
  ```

  Add the create handler (near `handleFieldChange`):
  ```typescript
    const handleCreated = useCallback((activity: Activity) => {
      savedSnapshots.current[activity.id] = activity
      setActivities((prev) => [...prev, activity])
    }, [])
  ```

  Render the dialog below the closing `</Table>` (still inside the wrapping `<div className="overflow-x-auto">`... move the dialog outside that div so it isn't affected by horizontal scroll):
  ```typescript
    return (
      <div>
        <div className="overflow-x-auto">
          <Table>
            {/* ...unchanged... */}
          </Table>
        </div>
        {isAdmin && (
          <div className="mt-3">
            <AddActivityDialog phaseId={phaseId} onCreated={handleCreated} />
          </div>
        )}
      </div>
    )
  ```

- [ ] **Step 3: Verify build**

  Run: `npm run build`
  Expected: build succeeds.

- [ ] **Step 4: Commit**

  ```bash
  git add components/activities/AddActivityDialog.tsx components/activities/ActivityTable.tsx
  git commit -m "feat: add AddActivityDialog wired to POST /api/phases/[id]/activities"
  ```

---

## Task 10: Delete Activity Dialog

**Files:**
- Create: `components/activities/DeleteActivityDialog.tsx`
- Modify: `components/activities/ActivityRow.tsx`
- Modify: `components/activities/ActivityTable.tsx`

**Interfaces:**
- Produces: `DeleteActivityDialog({ activityId: string; activityName: string; onDeleted: (id: string) => void })`

**Context:** `DELETE /api/activities/[id]` returns `409 HAS_SUCCESSORS` with a count message (no successor names — the API doesn't provide a list) when the activity has dependents. The dialog surfaces that message inline instead of closing.

- [ ] **Step 1: Create `components/activities/DeleteActivityDialog.tsx`**

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

  interface DeleteActivityDialogProps {
    activityId: string
    activityName: string
    onDeleted: (id: string) => void
  }

  export function DeleteActivityDialog({ activityId, activityName, onDeleted }: DeleteActivityDialogProps) {
    const [open, setOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    async function handleConfirm() {
      setSubmitting(true)
      setErrorMessage(null)
      try {
        const res = await fetch(`/api/activities/${activityId}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message ?? 'Gagal menghapus kegiatan')
          return
        }
        onDeleted(activityId)
        toast.success('Kegiatan dihapus')
        setOpen(false)
      } catch {
        setErrorMessage('Gagal menghapus kegiatan')
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
        <DialogTrigger asChild>
          <button type="button" className="text-gray-400 hover:text-red-600" title="Hapus kegiatan">
            🗑️
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Kegiatan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Yakin ingin menghapus <span className="font-medium">{activityName}</span>?
          </p>
          {errorMessage && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{errorMessage}</p>
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

- [ ] **Step 2: Wire it into `ActivityRow.tsx`**

  Add the import:
  ```typescript
  import { DeleteActivityDialog } from './DeleteActivityDialog'
  ```

  Add `onDeleted` to the props interface:
  ```typescript
  interface ActivityRowProps {
    activity: Activity
    index: number
    isFirst: boolean
    isLast: boolean
    depCount: number
    holidays: string[]
    isAdmin: boolean
    saveStatus: SaveStatus
    onFieldChange: (id: string, changes: Partial<Activity>) => void
    onMove: (id: string, direction: 'up' | 'down') => void
    onToggleLock: (id: string) => void
    onDeleted: (id: string) => void
  }
  ```

  Add `onDeleted` to the destructured function parameters:
  ```typescript
  export function ActivityRow({
    activity,
    index,
    isFirst,
    isLast,
    depCount,
    holidays,
    isAdmin,
    saveStatus,
    onFieldChange,
    onMove,
    onToggleLock,
    onDeleted,
  }: ActivityRowProps) {
  ```

  Replace the final placeholder cell:
  ```typescript
        {isAdmin && <TableCell />}
  ```
  with:
  ```typescript
        {isAdmin && (
          <TableCell>
            <DeleteActivityDialog activityId={activity.id} activityName={activity.kegiatan} onDeleted={onDeleted} />
          </TableCell>
        )}
  ```

- [ ] **Step 3: Wire it into `ActivityTable.tsx`**

  Add the delete handler (near `handleCreated`):
  ```typescript
    const handleDeleted = useCallback((id: string) => {
      delete savedSnapshots.current[id]
      setActivities((prev) => prev.filter((a) => a.id !== id))
    }, [])
  ```

  In the `sortedActivities.map` render, add the new prop:
  ```typescript
            {sortedActivities.map((activity, index) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                index={index}
                isFirst={index === 0}
                isLast={index === sortedActivities.length - 1}
                depCount={depCounts[activity.id] ?? 0}
                holidays={holidays}
                isAdmin={isAdmin}
                saveStatus={saveStatuses[activity.id] ?? 'idle'}
                onFieldChange={handleFieldChange}
                onMove={handleMove}
                onToggleLock={handleToggleLock}
                onDeleted={handleDeleted}
              />
            ))}
  ```

- [ ] **Step 4: Verify build**

  Run: `npm run build`
  Expected: build succeeds.

- [ ] **Step 5: Commit**

  ```bash
  git add components/activities/DeleteActivityDialog.tsx components/activities/ActivityRow.tsx components/activities/ActivityTable.tsx
  git commit -m "feat: add DeleteActivityDialog with 409 HAS_SUCCESSORS handling"
  ```

---

## Task 11: Manual E2E Verification

**Files:** none (verification only)

- [ ] **Step 1: Start the local stack**

  ```bash
  supabase start
  npm run dev
  ```

- [ ] **Step 2: Log in as Admin and walk the Fase page**

  Navigate to `/dashboard/<any-seeded-location-code>/fase-1` and verify:
  - Table renders all seeded activities from `PHASE_TEMPLATES` (F1), sorted by display order
  - Edit "Kegiatan" text → wait ~600ms → row shows "Menyimpan…" then "✓ Tersimpan"; reload the page and confirm the change persisted
  - Edit "PIC" text, a date field, and "Catatan" → same auto-save behavior
  - Set "Rencana Selesai" to a date before "Rencana Mulai" → expect an error toast and no save (value should not persist after reload)
  - Change "Status" to "Selesai" → "%" auto-jumps to 100; change to "Belum Mulai" → "%" auto-jumps to 0
  - Click the 25/50/75/100 quick-buttons and confirm the numeric input updates to match
  - Toggle the ♦ milestone icon and the 🔒 lock icon → both persist after reload
  - Click ▲ on the second row → it swaps with the first row; reload and confirm the new order persisted
  - Click "+ Tambah Kegiatan", submit with valid data → new row appears at the bottom
  - Click "+ Tambah Kegiatan", leave Kegiatan blank → expect a validation toast, dialog stays open
  - Click 🗑️ on a row with no successors → confirm dialog → row disappears after confirming
  - If any seeded activity has a dependency successor, attempt to delete its predecessor → expect the `HAS_SUCCESSORS` message shown inline in the dialog, dialog does not close

- [ ] **Step 3: Log in as Viewer and re-check the same page**

  Verify: no drag/reorder/edit controls render (no Input/Select/Textarea/buttons for mutation), all values display as plain text/badges, no "+ Tambah Kegiatan" button, no 🗑️ icons.

- [ ] **Step 4: Cross-phase navigation**

  Verify: phase tab bar switches between fase-1..fase-4 and highlights the active tab; visiting `/dashboard/<code>` redirects to `/dashboard/<code>/fase-1`; visiting an invalid phase (`/dashboard/<code>/fase-5`) 404s; visiting an unknown location code 404s.

- [ ] **Step 5: Update the SDD progress ledger**

  Append to `.superpowers/sdd/progress.md`:

  ```markdown

  ## Week 3
  # Plan: docs/superpowers/plans/2026-07-02-minggu3-fase-crud.md
  ```

  (Task-by-task COMPLETE lines get appended here during execution, matching the Week 1/2 format.)

- [ ] **Step 6: Final commit**

  ```bash
  git add .superpowers/sdd/progress.md
  git commit -m "chore: Week 3 manual E2E verified — Fase CRUD complete"
  ```
