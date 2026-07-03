# Minggu 5: Dependensi UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins manage per-activity dependencies (predecessor/successor, type, lag) from a
panel opened off the existing "Dep" badge, reject cycles with a visible error, and notify the
user when a mutation causes CPM to shift other activities' dates.

**Architecture:** Every mutation route that already calls `runCpmForLocation` (Week 4) starts
returning its CPM result to the client instead of discarding it, nested inside `data` alongside
the mutated entity. A new `DependencyPanel.tsx` component (Dialog + Tabs, same self-contained
trigger pattern as `DeleteActivityDialog`) replaces the static "N dep" badge, reading/writing a
`dependencies` array that `ActivityTable` now holds as state (lifted from a prop, same pattern
already used for `activities`).

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase JS v2 · shadcn/ui (adding `Tabs`
this week) · sonner (toasts)

## Global Constraints

- `npm run build` must pass before every commit (no automated tests added this week — no new
  pure functions, consistent with Weeks 1–3's convention; Vitest suite from Week 4 stays
  untouched and must keep passing via `npm test`)
- TypeScript strict — no implicit `any`
- API response envelope stays `{ data: T | null, error: { code, message } | null }`, but `data`'s
  shape is endpoint-specific (already established by `POST
  /api/locations/[locationId]/recalculate` returning `{ updatedCount, criticalPath }` rather than
  an entity) — this week nests the mutated entity plus a `cpm` summary under `data` for every
  route that runs CPM
- Every existing `isAdmin(profile.role)` check stays exactly where it is — no new endpoints,
  only response-shape changes to existing ones
- Every git commit message follows the existing convention: `feat:`/`fix:` prefix, one line
- Spec: `docs/superpowers/specs/2026-07-03-minggu5-dependensi-ui-design.md`

---

## Task 1: `lib/types.ts` — `CpmSummary` and `LocationActivitySummary` Types

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `CpmSummary`, `LocationActivitySummary` — consumed by every later task

- [ ] **Step 1: Add the two new types**

  Append to the end of `lib/types.ts` (after the existing `Dependency` interface):
  ```typescript
  export interface CpmSummary {
    shiftedCount: number
    hasCycle: boolean
    criticalPath: string[]
    updatedActivities: Array<{
      id: string
      tanggal_mulai_rencana: string
      tanggal_selesai_rencana: string
      is_on_critical_path: boolean
    }>
  }

  export interface LocationActivitySummary {
    id: string
    kegiatan: string
    phaseCode: string
  }
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build`
  Expected: succeeds (purely additive types, nothing consumes them yet)

- [ ] **Step 3: Commit**

  ```bash
  git add lib/types.ts
  git commit -m "feat: add CpmSummary and LocationActivitySummary types"
  ```

---

## Task 2: `lib/cpm-runner.ts` — Return `shiftedCount`, Add `toCpmSummary` Helper

**Files:**
- Modify: `lib/cpm-runner.ts`

**Interfaces:**
- Consumes: `CpmSummary` from `lib/types.ts` (Task 1)
- Produces: `CpmRunResult.shiftedCount: number` (new field); `toCpmSummary(result: CpmRunResult):
  CpmSummary` — used by every route task below to build its response's `cpm` field in one line

- [ ] **Step 1: Add the import**

  At the top of `lib/cpm-runner.ts`, add:
  ```typescript
  import type { CpmSummary } from '@/lib/types'
  ```

- [ ] **Step 2: Add `shiftedCount` to `CpmRunResult`**

  Change:
  ```typescript
  interface CpmRunResult {
    updatedActivities: UpdatedActivity[]
    criticalPath: string[]
    hasCycle: boolean
    cycleIds: string[]
  }
  ```
  to:
  ```typescript
  interface CpmRunResult {
    updatedActivities: UpdatedActivity[]
    criticalPath: string[]
    hasCycle: boolean
    cycleIds: string[]
    shiftedCount: number
  }
  ```

- [ ] **Step 3: Populate `shiftedCount` at every `CpmRunResult` return site**

  Change the `empty` fallback:
  ```typescript
  const empty: CpmRunResult = { updatedActivities: [], criticalPath: [], hasCycle: false, cycleIds: [] }
  ```
  to:
  ```typescript
  const empty: CpmRunResult = { updatedActivities: [], criticalPath: [], hasCycle: false, cycleIds: [], shiftedCount: 0 }
  ```

  Change the cycle-detected early return:
  ```typescript
      return { updatedActivities: [], criticalPath: [], hasCycle: true, cycleIds: result.cycleIds }
  ```
  to:
  ```typescript
      return { updatedActivities: [], criticalPath: [], hasCycle: true, cycleIds: result.cycleIds, shiftedCount: 0 }
  ```

  Change the final success return:
  ```typescript
    return { updatedActivities, criticalPath: result.criticalPath, hasCycle: false, cycleIds: [] }
  ```
  to:
  ```typescript
    return { updatedActivities, criticalPath: result.criticalPath, hasCycle: false, cycleIds: [], shiftedCount }
  ```
  (`shiftedCount` is already computed a few lines above this return — the existing `let
  shiftedCount = 0` loop that currently only feeds the audit log description.)

- [ ] **Step 4: Add the `toCpmSummary` helper**

  Append to the end of `lib/cpm-runner.ts` (after `runCpmForAllActiveLocations`):
  ```typescript
  export function toCpmSummary(result: CpmRunResult): CpmSummary {
    return {
      shiftedCount: result.shiftedCount,
      hasCycle: result.hasCycle,
      criticalPath: result.criticalPath,
      updatedActivities: result.updatedActivities,
    }
  }
  ```

- [ ] **Step 5: Verify build and existing tests**

  Run: `npm run build`
  Expected: succeeds

  Run: `npm test`
  Expected: 31 passed (Week 4's suite is untouched by this change — `lib/cpm-runner.ts` has no
  automated tests, consistent with every other DB-touching file in this project)

- [ ] **Step 6: Commit**

  ```bash
  git add lib/cpm-runner.ts
  git commit -m "feat: return shiftedCount from runCpmForLocation, add toCpmSummary helper"
  ```

---

## Task 3: Add shadcn `Tabs` Primitive

**Files:**
- Create: `components/ui/tabs.tsx` (generated)
- Modify: `package.json`, `package-lock.json` (new `@radix-ui/react-tabs` dependency)

**Interfaces:**
- Produces: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — consumed by `DependencyPanel.tsx`
  (Task 6)

- [ ] **Step 1: Run the shadcn CLI**

  ```bash
  npx shadcn@latest add tabs
  ```
  This project's `components.json` (`style: default`, `baseColor: slate`) is already configured,
  so this generates `components/ui/tabs.tsx` matching the existing primitives' style and adds
  `@radix-ui/react-tabs` to `package.json`/`package-lock.json` (mirrors how `select`/`dialog`
  were added in earlier weeks).

- [ ] **Step 2: Verify the file was created and the build passes**

  Confirm `components/ui/tabs.tsx` exists and exports `Tabs`, `TabsList`, `TabsTrigger`,
  `TabsContent`.

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 3: Commit**

  ```bash
  git add components/ui/tabs.tsx package.json package-lock.json
  git commit -m "feat: add shadcn Tabs primitive"
  ```

---

## Task 4: Surface CPM Shift Results from Activity Mutations

**Files:**
- Modify: `app/api/activities/[id]/route.ts`
- Modify: `components/activities/ActivityTable.tsx`
- Modify: `components/activities/DeleteActivityDialog.tsx`
- Modify: `components/activities/ActivityRow.tsx` (one-line type fix only)

**Interfaces:**
- Consumes: `toCpmSummary` from `lib/cpm-runner.ts` (Task 2), `CpmSummary` from `lib/types.ts`
  (Task 1)
- Produces: `PATCH /api/activities/[id]` and `DELETE /api/activities/[id]` now return `data: {
  activity, cpm }` / `data: { id, cpm }` instead of a bare entity; `ActivityTable`'s
  `applyCpmResult(cpm: CpmSummary | null): void` — reused by Task 6's dependency handlers

- [ ] **Step 1: Restructure `PATCH /api/activities/[id]`'s response**

  In `app/api/activities/[id]/route.ts`, change the import line:
  ```typescript
  import { extractLocationId, getActivityLocationId, runCpmForLocation } from '@/lib/cpm-runner'
  ```
  to:
  ```typescript
  import { extractLocationId, getActivityLocationId, runCpmForLocation, toCpmSummary } from '@/lib/cpm-runner'
  import type { CpmSummary } from '@/lib/types'
  ```

  Change:
  ```typescript
      const datesChanged =
        parsed.data.tanggal_mulai_rencana !== undefined || parsed.data.tanggal_selesai_rencana !== undefined
      if (datesChanged) {
        const locationId = await getActivityLocationId(supabase, params.id)
        if (locationId) {
          await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
        }
      }

      await insertAuditLog({
        userId: user.id, userEmail: profile.email, userName: profile.full_name,
        action: 'UPDATE', entityType: 'activities', entityId: params.id,
        entityDescription: `Update kegiatan: ${current.kegiatan}`,
        oldValue: current, newValue: updated,
      })

      return NextResponse.json({ data: updated, error: null })
  ```
  to:
  ```typescript
      const datesChanged =
        parsed.data.tanggal_mulai_rencana !== undefined || parsed.data.tanggal_selesai_rencana !== undefined
      let cpm: CpmSummary | null = null
      if (datesChanged) {
        const locationId = await getActivityLocationId(supabase, params.id)
        if (locationId) {
          const result = await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
          cpm = toCpmSummary(result)
        }
      }

      await insertAuditLog({
        userId: user.id, userEmail: profile.email, userName: profile.full_name,
        action: 'UPDATE', entityType: 'activities', entityId: params.id,
        entityDescription: `Update kegiatan: ${current.kegiatan}`,
        oldValue: current, newValue: updated,
      })

      return NextResponse.json({ data: { activity: updated, cpm }, error: null })
  ```

- [ ] **Step 2: Restructure `DELETE /api/activities/[id]`'s response**

  In the same file, change:
  ```typescript
      const locationId = extractLocationId(current.phases as { location_id: string } | { location_id: string }[] | null)

      const { error } = await supabase.from('activities').delete().eq('id', params.id)
      if (error) return serverError()

      if (locationId) {
        await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
      }

      await insertAuditLog({
        userId: user.id, userEmail: profile.email, userName: profile.full_name,
        action: 'DELETE', entityType: 'activities', entityId: params.id,
        entityDescription: `Hapus kegiatan: ${current.kegiatan}`,
        oldValue: current,
      })

      return NextResponse.json({ data: { id: params.id }, error: null })
  ```
  to:
  ```typescript
      const locationId = extractLocationId(current.phases as { location_id: string } | { location_id: string }[] | null)

      const { error } = await supabase.from('activities').delete().eq('id', params.id)
      if (error) return serverError()

      let cpm: CpmSummary | null = null
      if (locationId) {
        const result = await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
        cpm = toCpmSummary(result)
      }

      await insertAuditLog({
        userId: user.id, userEmail: profile.email, userName: profile.full_name,
        action: 'DELETE', entityType: 'activities', entityId: params.id,
        entityDescription: `Hapus kegiatan: ${current.kegiatan}`,
        oldValue: current,
      })

      return NextResponse.json({ data: { id: params.id, cpm }, error: null })
  ```

- [ ] **Step 3: Add `applyCpmResult` to `ActivityTable.tsx` and wire it into `flushSave`**

  In `components/activities/ActivityTable.tsx`, change the type import:
  ```typescript
  import type { Activity } from '@/lib/types'
  ```
  to:
  ```typescript
  import type { Activity, CpmSummary } from '@/lib/types'
  ```

  Add this new callback directly after `setRowStatus`'s definition (before `flushSave`):
  ```typescript
    const applyCpmResult = useCallback((cpm: CpmSummary | null) => {
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
    }, [])
  ```

  Change `flushSave`'s body:
  ```typescript
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
  ```
  to:
  ```typescript
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menyimpan perubahan')
        }
        const { activity: updated, cpm } = json.data as { activity: Activity; cpm: CpmSummary | null }
        savedSnapshots.current[id] = updated
        setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)))
        setRowStatus(id, 'saved')
        applyCpmResult(cpm)
      } catch (err) {
        const snapshot = savedSnapshots.current[id]
        setActivities((prev) => prev.map((a) => (a.id === id ? snapshot : a)))
        setRowStatus(id, 'error')
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan perubahan')
      }
    },
    [setRowStatus, applyCpmResult]
  )
  ```
  (The `setActivities((prev) => ... updated ...)` line runs first and applies every field the
  user just edited, including `catatan`/`status`/etc.; `applyCpmResult` then overwrites
  `tanggal_mulai_rencana`/`tanggal_selesai_rencana`/`is_on_critical_path` with CPM's final
  values, which is necessary because `updated` reflects the DB write from *before*
  `runCpmForLocation` ran its own second write — without this second step, a date edit on an
  activity with a predecessor would silently show the user's requested date instead of the
  CPM-adjusted one.)

  Change `handleDeleted`:
  ```typescript
    const handleDeleted = useCallback((id: string) => {
      delete savedSnapshots.current[id]
      setActivities((prev) => prev.filter((a) => a.id !== id))
    }, [])
  ```
  to:
  ```typescript
    const handleDeleted = useCallback(
      (id: string, cpm: CpmSummary | null) => {
        delete savedSnapshots.current[id]
        setActivities((prev) => prev.filter((a) => a.id !== id))
        applyCpmResult(cpm)
      },
      [applyCpmResult]
    )
  ```

- [ ] **Step 4: Update `DeleteActivityDialog.tsx`'s response handling**

  In `components/activities/DeleteActivityDialog.tsx`, add the import:
  ```typescript
  import type { CpmSummary } from '@/lib/types'
  ```

  Change the props interface:
  ```typescript
  interface DeleteActivityDialogProps {
    activityId: string
    activityName: string
    onDeleted: (id: string) => void
  }
  ```
  to:
  ```typescript
  interface DeleteActivityDialogProps {
    activityId: string
    activityName: string
    onDeleted: (id: string, cpm: CpmSummary | null) => void
  }
  ```

  Change `handleConfirm`:
  ```typescript
        const res = await fetch(`/api/activities/${activityId}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message ?? 'Gagal menghapus kegiatan')
          return
        }
        onDeleted(activityId)
        toast.success('Kegiatan dihapus')
        setOpen(false)
  ```
  to:
  ```typescript
        const res = await fetch(`/api/activities/${activityId}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message ?? 'Gagal menghapus kegiatan')
          return
        }
        const { cpm } = json.data as { id: string; cpm: CpmSummary | null }
        onDeleted(activityId, cpm)
        toast.success('Kegiatan dihapus')
        setOpen(false)
  ```

- [ ] **Step 5: Fix `ActivityRow.tsx`'s `onDeleted` prop type**

  In `components/activities/ActivityRow.tsx`, change the import:
  ```typescript
  import type { Activity } from '@/lib/types'
  ```
  to:
  ```typescript
  import type { Activity, CpmSummary } from '@/lib/types'
  ```

  Change the prop type in `ActivityRowProps`:
  ```typescript
    onDeleted: (id: string) => void
  ```
  to:
  ```typescript
    onDeleted: (id: string, cpm: CpmSummary | null) => void
  ```

  (No change to the function signature or body — `onDeleted` is only ever forwarded as-is to
  `<DeleteActivityDialog onDeleted={onDeleted} />`; this step only fixes the declared type to
  match what actually flows through.)

- [ ] **Step 6: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 7: Manual browser verification**

  Run: `npm run dev`, log in as admin, open any phase page with at least two activities where
  one is an FS predecessor of the other (create the dependency via curl if none exists yet —
  Task 5 hasn't shipped the UI for this):
  ```bash
  curl -s -c /tmp/dep-ui-cookies.txt -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@perumnas.co.id","password":"Admin123!"}'
  ```
  - Edit a plain text field (e.g. `catatan`) on any activity — confirm it still saves (no
    console errors, `SaveStatusBadge` shows "Tersimpan").
  - Edit the plan start date of an activity that has an FS successor — confirm a toast reading
    "N kegiatan ikut disesuaikan jadwalnya" appears and the successor's row updates to its new
    dates without a manual page reload.
  - Delete an activity that has no successors — confirm the row disappears with no console
    errors.

- [ ] **Step 8: Commit**

  ```bash
  git add app/api/activities/[id]/route.ts components/activities/ActivityTable.tsx components/activities/DeleteActivityDialog.tsx components/activities/ActivityRow.tsx
  git commit -m "feat: surface CPM shift results from activity mutations"
  ```

---

## Task 5: Surface CPM Shift Results from Dependency Mutations

**Files:**
- Modify: `app/api/dependencies/route.ts`
- Modify: `app/api/dependencies/[id]/route.ts`

**Interfaces:**
- Consumes: `toCpmSummary` from `lib/cpm-runner.ts` (Task 2), `CpmSummary` from `lib/types.ts`
  (Task 1)
- Produces: `POST /api/dependencies`, `PATCH /api/dependencies/[id]`, `DELETE
  /api/dependencies/[id]` now return `data: { dependency, cpm }` / `data: { id, cpm }` — consumed
  by `DependencyPanel.tsx` in Task 6

No UI currently calls these three routes (the dependency-management UI doesn't exist until Task
6), so this task is backend-only and verified via curl, same as every other DB-touching route in
this project.

- [ ] **Step 1: Restructure `POST /api/dependencies`'s response**

  In `app/api/dependencies/route.ts`, change the import line:
  ```typescript
  import { getActivityLocationId, runCpmForLocation } from '@/lib/cpm-runner'
  ```
  to:
  ```typescript
  import { getActivityLocationId, runCpmForLocation, toCpmSummary } from '@/lib/cpm-runner'
  import type { CpmSummary } from '@/lib/types'
  ```

  Change:
  ```typescript
      await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })

      await insertAuditLog({
        userId: user.id, userEmail: profile.email, userName: profile.full_name,
        action: 'CREATE', entityType: 'activity_dependencies', entityId: dep.id,
        entityDescription: `Tambah dependensi ${dep.dep_type}: ${dep.predecessor_id} → ${dep.successor_id}`,
        newValue: dep,
      })

      return NextResponse.json({ data: dep, error: null }, { status: 201 })
  ```
  to:
  ```typescript
      const result = await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
      const cpm: CpmSummary = toCpmSummary(result)

      await insertAuditLog({
        userId: user.id, userEmail: profile.email, userName: profile.full_name,
        action: 'CREATE', entityType: 'activity_dependencies', entityId: dep.id,
        entityDescription: `Tambah dependensi ${dep.dep_type}: ${dep.predecessor_id} → ${dep.successor_id}`,
        newValue: dep,
      })

      return NextResponse.json({ data: { dependency: dep, cpm }, error: null }, { status: 201 })
  ```

- [ ] **Step 2: Restructure `PATCH /api/dependencies/[id]`'s response**

  In `app/api/dependencies/[id]/route.ts`, change the import line:
  ```typescript
  import { getActivityLocationId, runCpmForLocation } from '@/lib/cpm-runner'
  ```
  to:
  ```typescript
  import { getActivityLocationId, runCpmForLocation, toCpmSummary } from '@/lib/cpm-runner'
  import type { CpmSummary } from '@/lib/types'
  ```

  In the `PATCH` handler, change:
  ```typescript
      if (error) return serverError()

      const locationId = await getActivityLocationId(supabase, current.predecessor_id)
      if (locationId) {
        await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
      }

      await insertAuditLog({
        userId: user.id, userEmail: profile.email, userName: profile.full_name,
        action: 'UPDATE', entityType: 'activity_dependencies', entityId: params.id,
        entityDescription: `Update dependensi ${updated.dep_type}`,
        oldValue: current, newValue: updated,
      })

      return NextResponse.json({ data: updated, error: null })
  ```
  to:
  ```typescript
      if (error) return serverError()

      const locationId = await getActivityLocationId(supabase, current.predecessor_id)
      let cpm: CpmSummary | null = null
      if (locationId) {
        const result = await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
        cpm = toCpmSummary(result)
      }

      await insertAuditLog({
        userId: user.id, userEmail: profile.email, userName: profile.full_name,
        action: 'UPDATE', entityType: 'activity_dependencies', entityId: params.id,
        entityDescription: `Update dependensi ${updated.dep_type}`,
        oldValue: current, newValue: updated,
      })

      return NextResponse.json({ data: { dependency: updated, cpm }, error: null })
  ```

- [ ] **Step 3: Restructure `DELETE /api/dependencies/[id]`'s response**

  In the same file, change the `DELETE` handler:
  ```typescript
      const { error } = await supabase.from('activity_dependencies').delete().eq('id', params.id)
      if (error) return serverError()

      const locationId = await getActivityLocationId(supabase, current.predecessor_id)
      if (locationId) {
        await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
      }

      await insertAuditLog({
        userId: user.id, userEmail: profile.email, userName: profile.full_name,
        action: 'DELETE', entityType: 'activity_dependencies', entityId: params.id,
        entityDescription: `Hapus dependensi ${current.dep_type}: ${current.predecessor_id} → ${current.successor_id}`,
        oldValue: current,
      })

      return NextResponse.json({ data: { id: params.id }, error: null })
  ```
  to:
  ```typescript
      const { error } = await supabase.from('activity_dependencies').delete().eq('id', params.id)
      if (error) return serverError()

      const locationId = await getActivityLocationId(supabase, current.predecessor_id)
      let cpm: CpmSummary | null = null
      if (locationId) {
        const result = await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
        cpm = toCpmSummary(result)
      }

      await insertAuditLog({
        userId: user.id, userEmail: profile.email, userName: profile.full_name,
        action: 'DELETE', entityType: 'activity_dependencies', entityId: params.id,
        entityDescription: `Hapus dependensi ${current.dep_type}: ${current.predecessor_id} → ${current.successor_id}`,
        oldValue: current,
      })

      return NextResponse.json({ data: { id: params.id, cpm }, error: null })
  ```

- [ ] **Step 4: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 5: curl verification**

  ```bash
  npm run dev
  ```
  In another terminal:
  ```bash
  curl -s -c /tmp/dep-ui-cookies.txt -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@perumnas.co.id","password":"Admin123!"}'
  ```
  Fetch a location's phases to get two activity IDs with no existing dependency between them
  (substitute a real `LOCATION_ID` from your seeded/test data):
  ```bash
  curl -s -b /tmp/dep-ui-cookies.txt "http://localhost:3000/api/locations/LOCATION_ID/phases"
  ```
  Create a dependency and confirm the new response shape:
  ```bash
  curl -s -b /tmp/dep-ui-cookies.txt -X POST http://localhost:3000/api/dependencies \
    -H "Content-Type: application/json" \
    -d '{"predecessor_id":"ACT_A","successor_id":"ACT_B","dep_type":"FS","lag_days":0}'
  ```
  Expected: `201`, body shaped `{ "data": { "dependency": { "id": ..., "predecessor_id": "ACT_A",
  ... }, "cpm": { "shiftedCount": ..., "hasCycle": false, "criticalPath": [...],
  "updatedActivities": [...] } }, "error": null }`.

  Update its lag and confirm the same shape:
  ```bash
  curl -s -b /tmp/dep-ui-cookies.txt -X PATCH "http://localhost:3000/api/dependencies/DEP_ID" \
    -H "Content-Type: application/json" \
    -d '{"lag_days":3}'
  ```
  Expected: `200`, `data.dependency.lag_days == 3`, `data.cpm` present.

  Delete it and confirm:
  ```bash
  curl -s -b /tmp/dep-ui-cookies.txt -X DELETE "http://localhost:3000/api/dependencies/DEP_ID"
  ```
  Expected: `200`, `data.id == "DEP_ID"`, `data.cpm` present.

  Re-attempt creating the same dependency, then a reverse one, to confirm cycle rejection is
  unaffected by this task's changes:
  ```bash
  curl -s -b /tmp/dep-ui-cookies.txt -X POST http://localhost:3000/api/dependencies \
    -H "Content-Type: application/json" \
    -d '{"predecessor_id":"ACT_B","successor_id":"ACT_A","dep_type":"FS","lag_days":0}'
  curl -s -b /tmp/dep-ui-cookies.txt -X POST http://localhost:3000/api/dependencies \
    -H "Content-Type: application/json" \
    -d '{"predecessor_id":"ACT_A","successor_id":"ACT_B","dep_type":"FS","lag_days":0}'
  ```
  Expected: the second call `422 CYCLE_DETECTED` (unchanged shape — cycle rejection returns
  `{ data: null, error: {...} }`, not touched by this task).

- [ ] **Step 6: Commit**

  ```bash
  git add app/api/dependencies/route.ts "app/api/dependencies/[id]/route.ts"
  git commit -m "feat: surface CPM shift results from dependency mutations"
  ```

---

## Task 6: Dependency Management Panel UI

**Files:**
- Modify: `app/(app)/dashboard/[locationCode]/[faseSlug]/page.tsx`
- Modify: `components/activities/ActivityTable.tsx`
- Create: `components/activities/DependencyPanel.tsx`
- Modify: `components/activities/ActivityRow.tsx`

**Interfaces:**
- Consumes: `Dependency`, `LocationActivitySummary`, `CpmSummary` from `lib/types.ts`; `Tabs`,
  `TabsList`, `TabsTrigger`, `TabsContent` from `components/ui/tabs.tsx` (Task 3); `POST
  /api/dependencies`, `DELETE /api/dependencies/[id]` (Task 5); `applyCpmResult` pattern
  established in `ActivityTable.tsx` (Task 4)
- Produces: `DependencyPanel` component; `ActivityTable`'s `handleDependencyAdded(dep:
  Dependency, cpm: CpmSummary | null)`, `handleDependencyDeleted(depId: string, cpm: CpmSummary |
  null)`

- [ ] **Step 1: Extend `page.tsx`'s query to include activity names and phase codes**

  In `app/(app)/dashboard/[locationCode]/[faseSlug]/page.tsx`, add the import:
  ```typescript
  import type { Dependency, LocationActivitySummary } from '@/lib/types'
  ```

  Change:
  ```typescript
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
  to:
  ```typescript
    const { data: allPhases } = await supabase
      .from('phases')
      .select('id')
      .eq('location_id', location.id)
    const phaseIds = (allPhases ?? []).map((p: { id: string }) => p.id)

    const { data: allActivityRows } = phaseIds.length
      ? await supabase
          .from('activities')
          .select('id, kegiatan, phases(phase_code)')
          .in('phase_id', phaseIds)
      : { data: [] }
    const locationActivities: LocationActivitySummary[] = (allActivityRows ?? []).map((a) => {
      const phaseEmbed = a.phases as { phase_code: string } | { phase_code: string }[] | null
      const phaseCode = Array.isArray(phaseEmbed) ? (phaseEmbed[0]?.phase_code ?? '') : (phaseEmbed?.phase_code ?? '')
      return { id: a.id, kegiatan: a.kegiatan, phaseCode }
    })
    const allActivityIds = locationActivities.map((a) => a.id)

    const { data: dependencyRows } = allActivityIds.length
      ? await supabase
          .from('activity_dependencies')
          .select('id, predecessor_id, successor_id, dep_type, lag_days')
          .in('predecessor_id', allActivityIds)
      : { data: [] }

    const { data: holidayRows } = await supabase.from('work_calendar').select('holiday_date')
    const holidays = (holidayRows ?? []).map((h: { holiday_date: string }) => h.holiday_date)

    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{phase.name}</h2>
        <ActivityTable
          phaseId={phase.id}
          initialActivities={phase.activities}
          dependencies={(dependencyRows ?? []) as Dependency[]}
          locationActivities={locationActivities}
          holidays={holidays}
          isAdmin={canEdit}
        />
      </div>
    )
  }
  ```

- [ ] **Step 2: Update `ActivityTable.tsx`'s props and state to hold `dependencies` and
      `locationActivities`**

  Change the import:
  ```typescript
  import type { Activity, CpmSummary } from '@/lib/types'
  ```
  to:
  ```typescript
  import type { Activity, CpmSummary, Dependency, LocationActivitySummary } from '@/lib/types'
  ```

  Change the props interface and function signature:
  ```typescript
  interface ActivityTableProps {
    phaseId: string
    initialActivities: Activity[]
    depCounts: Record<string, number>
    holidays: string[]
    isAdmin: boolean
  }

  export function ActivityTable({ phaseId, initialActivities, depCounts, holidays, isAdmin }: ActivityTableProps) {
    const [activities, setActivities] = useState<Activity[]>(initialActivities)
  ```
  to:
  ```typescript
  interface ActivityTableProps {
    phaseId: string
    initialActivities: Activity[]
    dependencies: Dependency[]
    locationActivities: LocationActivitySummary[]
    holidays: string[]
    isAdmin: boolean
  }

  export function ActivityTable({
    phaseId,
    initialActivities,
    dependencies: initialDependencies,
    locationActivities,
    holidays,
    isAdmin,
  }: ActivityTableProps) {
    const [activities, setActivities] = useState<Activity[]>(initialActivities)
    const [dependencies, setDependencies] = useState<Dependency[]>(initialDependencies)
  ```

- [ ] **Step 3: Add `handleDependencyAdded`/`handleDependencyDeleted` to `ActivityTable.tsx`**

  Add these two callbacks directly after `handleDeleted`'s definition:
  ```typescript
    const handleDependencyAdded = useCallback(
      (dep: Dependency, cpm: CpmSummary | null) => {
        setDependencies((prev) => [...prev, dep])
        applyCpmResult(cpm)
      },
      [applyCpmResult]
    )

    const handleDependencyDeleted = useCallback(
      (depId: string, cpm: CpmSummary | null) => {
        setDependencies((prev) => prev.filter((d) => d.id !== depId))
        applyCpmResult(cpm)
      },
      [applyCpmResult]
    )
  ```

  Also prune stale dependency references when an activity itself is deleted — change
  `handleDeleted` (from Task 4) from:
  ```typescript
    const handleDeleted = useCallback(
      (id: string, cpm: CpmSummary | null) => {
        delete savedSnapshots.current[id]
        setActivities((prev) => prev.filter((a) => a.id !== id))
        applyCpmResult(cpm)
      },
      [applyCpmResult]
    )
  ```
  to:
  ```typescript
    const handleDeleted = useCallback(
      (id: string, cpm: CpmSummary | null) => {
        delete savedSnapshots.current[id]
        setActivities((prev) => prev.filter((a) => a.id !== id))
        setDependencies((prev) => prev.filter((d) => d.predecessor_id !== id && d.successor_id !== id))
        applyCpmResult(cpm)
      },
      [applyCpmResult]
    )
  ```

- [ ] **Step 4: Pass the new props down to `ActivityRow` in the render**

  Change:
  ```typescript
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
                isMoving={movingIds.has(activity.id)}
                onFieldChange={handleFieldChange}
                onMove={handleMove}
                onToggleLock={handleToggleLock}
                onDeleted={handleDeleted}
              />
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
                isAdmin={isAdmin}
                saveStatus={saveStatuses[activity.id] ?? 'idle'}
                isMoving={movingIds.has(activity.id)}
                onFieldChange={handleFieldChange}
                onMove={handleMove}
                onToggleLock={handleToggleLock}
                onDeleted={handleDeleted}
                onDependencyAdded={handleDependencyAdded}
                onDependencyDeleted={handleDependencyDeleted}
              />
  ```

- [ ] **Step 5: Create `components/activities/DependencyPanel.tsx`**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { toast } from 'sonner'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from '@/components/ui/dialog'
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
  import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
  import type { Dependency, LocationActivitySummary, CpmSummary } from '@/lib/types'

  const DEP_TYPES: Array<Dependency['dep_type']> = ['FS', 'SS', 'FF', 'SF']

  interface DependencyPanelProps {
    activity: { id: string; kegiatan: string }
    dependencies: Dependency[]
    locationActivities: LocationActivitySummary[]
    isAdmin: boolean
    onDependencyAdded: (dep: Dependency, cpm: CpmSummary | null) => void
    onDependencyDeleted: (depId: string, cpm: CpmSummary | null) => void
  }

  function activityLabel(id: string, locationActivities: LocationActivitySummary[]): string {
    const found = locationActivities.find((a) => a.id === id)
    return found ? `${found.phaseCode} — ${found.kegiatan}` : id
  }

  export function DependencyPanel({
    activity,
    dependencies,
    locationActivities,
    isAdmin,
    onDependencyAdded,
    onDependencyDeleted,
  }: DependencyPanelProps) {
    const [open, setOpen] = useState(false)
    const [tab, setTab] = useState<'predecessor' | 'successor'>('predecessor')
    const [selectedActivityId, setSelectedActivityId] = useState('')
    const [depType, setDepType] = useState<Dependency['dep_type']>('FS')
    const [lagDays, setLagDays] = useState('0')
    const [submitting, setSubmitting] = useState(false)

    const predecessors = dependencies.filter((d) => d.successor_id === activity.id)
    const successors = dependencies.filter((d) => d.predecessor_id === activity.id)
    const depCount = predecessors.length + successors.length

    const relatedIds = new Set([
      activity.id,
      ...(tab === 'predecessor' ? predecessors.map((d) => d.predecessor_id) : successors.map((d) => d.successor_id)),
    ])
    const candidateActivities = locationActivities.filter((a) => !relatedIds.has(a.id))

    function resetForm() {
      setSelectedActivityId('')
      setDepType('FS')
      setLagDays('0')
    }

    async function handleAdd() {
      if (!selectedActivityId) {
        toast.error('Pilih kegiatan terlebih dahulu')
        return
      }
      const body =
        tab === 'predecessor'
          ? { predecessor_id: selectedActivityId, successor_id: activity.id, dep_type: depType, lag_days: Number(lagDays) || 0 }
          : { predecessor_id: activity.id, successor_id: selectedActivityId, dep_type: depType, lag_days: Number(lagDays) || 0 }

      setSubmitting(true)
      try {
        const res = await fetch('/api/dependencies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menambah dependensi')
        }
        const { dependency, cpm } = json.data as { dependency: Dependency; cpm: CpmSummary | null }
        onDependencyAdded(dependency, cpm)
        toast.success('Dependensi ditambahkan')
        resetForm()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menambah dependensi')
      } finally {
        setSubmitting(false)
      }
    }

    async function handleDelete(depId: string) {
      try {
        const res = await fetch(`/api/dependencies/${depId}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menghapus dependensi')
        }
        const { cpm } = json.data as { id: string; cpm: CpmSummary | null }
        onDependencyDeleted(depId, cpm)
        toast.success('Dependensi dihapus')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menghapus dependensi')
      }
    }

    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetForm()
        }}
      >
        <DialogTrigger asChild>
          <button type="button">
            <Badge variant="secondary">{depCount}</Badge>
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dependensi Kegiatan: {activity.kegiatan}</DialogTitle>
          </DialogHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'predecessor' | 'successor')}>
            <TabsList>
              <TabsTrigger value="predecessor">Predecessor ({predecessors.length})</TabsTrigger>
              <TabsTrigger value="successor">Successor ({successors.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="predecessor" className="space-y-2">
              {predecessors.length === 0 && <p className="text-sm text-gray-500">Belum ada predecessor.</p>}
              {predecessors.map((dep) => (
                <div key={dep.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>
                    {activityLabel(dep.predecessor_id, locationActivities)} — {dep.dep_type}, lag {dep.lag_days}
                  </span>
                  {isAdmin && (
                    <button type="button" onClick={() => handleDelete(dep.id)} className="text-gray-400 hover:text-red-600">
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </TabsContent>
            <TabsContent value="successor" className="space-y-2">
              {successors.length === 0 && <p className="text-sm text-gray-500">Belum ada successor.</p>}
              {successors.map((dep) => (
                <div key={dep.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>
                    {activityLabel(dep.successor_id, locationActivities)} — {dep.dep_type}, lag {dep.lag_days}
                  </span>
                  {isAdmin && (
                    <button type="button" onClick={() => handleDelete(dep.id)} className="text-gray-400 hover:text-red-600">
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </TabsContent>
          </Tabs>
          {isAdmin && (
            <div className="space-y-2 border-t pt-3">
              <Label>+ Tambah {tab === 'predecessor' ? 'Predecessor' : 'Successor'}</Label>
              <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kegiatan" />
                </SelectTrigger>
                <SelectContent>
                  {candidateActivities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.phaseCode} — {a.kegiatan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select value={depType} onValueChange={(v) => setDepType(v as Dependency['dep_type'])}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={lagDays}
                  onChange={(e) => setLagDays(e.target.value)}
                  placeholder="Lag (hari)"
                  className="w-28"
                />
                <Button onClick={handleAdd} disabled={submitting}>
                  {submitting ? 'Menyimpan…' : 'Tambah'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }
  ```

- [ ] **Step 6: Wire `DependencyPanel` into `ActivityRow.tsx`, replacing the static badge**

  Add the import:
  ```typescript
  import { DependencyPanel } from './DependencyPanel'
  ```

  Change the type import:
  ```typescript
  import type { Activity, CpmSummary } from '@/lib/types'
  ```
  to:
  ```typescript
  import type { Activity, CpmSummary, Dependency, LocationActivitySummary } from '@/lib/types'
  ```

  Change the props interface and function signature:
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
    isMoving: boolean
    onFieldChange: (id: string, changes: Partial<Activity>) => void
    onMove: (id: string, direction: 'up' | 'down') => void
    onToggleLock: (id: string) => void
    onDeleted: (id: string, cpm: CpmSummary | null) => void
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
    isMoving,
    onFieldChange,
    onMove,
    onToggleLock,
    onDeleted,
  }: ActivityRowProps) {
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
    isAdmin: boolean
    saveStatus: SaveStatus
    isMoving: boolean
    onFieldChange: (id: string, changes: Partial<Activity>) => void
    onMove: (id: string, direction: 'up' | 'down') => void
    onToggleLock: (id: string) => void
    onDeleted: (id: string, cpm: CpmSummary | null) => void
    onDependencyAdded: (dep: Dependency, cpm: CpmSummary | null) => void
    onDependencyDeleted: (depId: string, cpm: CpmSummary | null) => void
  }

  export function ActivityRow({
    activity,
    index,
    isFirst,
    isLast,
    dependencies,
    locationActivities,
    holidays,
    isAdmin,
    saveStatus,
    isMoving,
    onFieldChange,
    onMove,
    onToggleLock,
    onDeleted,
    onDependencyAdded,
    onDependencyDeleted,
  }: ActivityRowProps) {
  ```

  Change the Dep column cell:
  ```typescript
        <TableCell>
          <Badge variant="secondary">{depCount}</Badge>
        </TableCell>
  ```
  to:
  ```typescript
        <TableCell>
          <DependencyPanel
            activity={{ id: activity.id, kegiatan: activity.kegiatan }}
            dependencies={dependencies}
            locationActivities={locationActivities}
            isAdmin={isAdmin}
            onDependencyAdded={onDependencyAdded}
            onDependencyDeleted={onDependencyDeleted}
          />
        </TableCell>
  ```

- [ ] **Step 7: Verify build**

  Run: `npm run build`
  Expected: succeeds

- [ ] **Step 8: Manual browser verification**

  Run: `npm run dev`, open a phase page as admin with at least 3 activities in the same
  location (across any phases).
  - Click the "N dep" badge on an activity with 0 dependencies — confirm the panel opens with
    empty Predecessor/Successor tabs.
  - Add a predecessor: pick an activity from the dropdown, leave type FS / lag 0, click Tambah
    — confirm success toast, the row appears in the Predecessor tab, and both this activity's
    and the predecessor's "N dep" badges increment without a page reload.
  - Add a successor the same way — confirm the badge counts update correctly on both ends.
  - Attempt to add a dependency that would create a cycle (e.g. add the current activity's own
    successor back as its predecessor) — confirm a `toast.error` appears and nothing is added
    to the list.
  - Delete a dependency via its 🗑️ button — confirm both badges decrement.
  - Edit a date on an activity that has a dependent successor via the normal date input (not
    the panel) — confirm the auto-shift toast still fires (Task 4's behavior, now exercisable
    through the full dependency graph the panel builds).
  - Log in as a viewer (or check `isAdmin={false}` rendering) — confirm the panel opens
    read-only: no "+ Tambah" form, no 🗑️ delete buttons, both tabs still show existing
    dependencies.

- [ ] **Step 9: Commit**

  ```bash
  git add "app/(app)/dashboard/[locationCode]/[faseSlug]/page.tsx" components/activities/ActivityTable.tsx components/activities/DependencyPanel.tsx components/activities/ActivityRow.tsx
  git commit -m "feat: add dependency management panel per activity"
  ```

---

## Task 7: Final Manual E2E Pass and Progress Ledger

**Files:**
- Modify: `.superpowers/sdd/progress.md`

No code changes — this task re-verifies the full feature end-to-end in one pass (some scenarios
overlap with Tasks 4–6's per-task checks, but this confirms they still hold once every piece is
in place together) and records the outcome, matching the convention every prior week's plan
ended with.

- [ ] **Step 1: Full E2E pass**

  With `npm run dev` running and logged in as admin in the browser:
  1. Open a phase page. Confirm every activity's "N dep" badge reflects reality (cross-check
     against a `GET /api/locations/LOCATION_ID/dependencies` curl call for the same location).
  2. Add a predecessor dependency between two activities in the *same* phase — confirm badges
     update and, if the successor's dates were affected, the shift toast fires and its row
     updates live.
  3. Add a dependency between two activities in *different* phases of the same location (pick
     an activity from another phase in the dropdown) — confirm it saves correctly; navigate to
     the other phase's page and confirm the dependency and any shifted dates appear there too
     (after a page load — cross-phase live updates are not expected, only same-page ones).
  4. Attempt a cycle — confirm rejection with no partial state change.
  5. Attempt a duplicate dependency — confirm the existing "Dependensi ini sudah ada" toast.
  6. Delete a dependency, then delete an activity with no remaining successors — confirm both
     operations clean up dependency state correctly (badges, no orphaned rows).
  7. View the same phase page as a Viewer (non-admin) account — confirm the "N dep" badges are
     still visible and clickable, but read-only inside the panel.
  8. Run `npm run build` and `npm test` one final time — expected: build succeeds, 31/31 tests
     pass (unchanged from Week 4, no new automated tests this week per the spec's Testing
     section).

- [ ] **Step 2: Record the outcome in the SDD progress ledger**

  Append to `.superpowers/sdd/progress.md`:
  ```markdown

  ## Week 5
  # Plan: docs/superpowers/plans/2026-07-03-minggu5-dependensi-ui.md
  # Spec: docs/superpowers/specs/2026-07-03-minggu5-dependensi-ui-design.md
  - Task 1: complete
  - Task 2: complete
  - Task 3: complete
  - Task 4: complete
  - Task 5: complete
  - Task 6: complete
  - Task 7: COMPLETE via manual browser + curl E2E. [fill in actual findings here — any bugs
    found and fixed during verification, following the pattern of Weeks 1-4's ledger entries]
  - Week 5 implementation COMPLETE (fill in date)
  ```
  (Replace the bracketed placeholders with what actually happened during Step 1 — this mirrors
  every prior week's ledger entry, which records real findings, not a template.)

- [ ] **Step 3: Commit**

  ```bash
  git add .superpowers/sdd/progress.md
  git commit -m "chore: record Week 5 Dependensi UI E2E findings in SDD progress ledger"
  ```
