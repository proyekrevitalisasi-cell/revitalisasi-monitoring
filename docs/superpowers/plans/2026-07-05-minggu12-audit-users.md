# Minggu 12: Audit Log & Users/Lokasi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two whole-page-gated Admin+SA pages — `/audit-log` (filterable, paginated audit
trail with an old/new-value JSON diff modal) and `/users` (two tabs: Users table with
role-asymmetric activate/deactivate, and Lokasi cards with add/edit/deactivate).

**Architecture:** Backend already exists and is mostly untouched this week — `profiles`,
`locations`, `audit_logs` tables + RLS (Week 1/2 migrations), `GET/POST /api/users`,
`PATCH/DELETE /api/users/[id]`, `GET/POST /api/locations`, `PATCH/DELETE
/api/locations/[locationId]` (all Week 2). Two small, targeted backend fixes are needed on `GET
/api/audit-logs`: it currently doesn't select `old_value`/`new_value` (needed for the diff
modal) and doesn't support an `action` query filter (needed for the Aksi filter dropdown) — both
fixed in Task 1, everything else this week is UI. Both new pages use the established whole-page
`notFound()` gate (same pattern as Week 10's `/work-calendar`) since both are Admin+SA only, not
per-field-gated like most other pages.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase JS v2 · shadcn/ui (`Select`,
`Dialog`, `Table`, `Tabs`, `Card`, `Badge`, `Textarea` — all already installed, no new shadcn
components needed) · sonner (toasts) · date-fns (`format`, already a dependency)

## Global Constraints

- `npm run build` must pass before every commit; `npm test` must keep passing (83 existing tests
  — no new pure-logic module this week, so no new Vitest tests)
- TypeScript strict — no implicit `any`
- No semicolons, single quotes — match this project's existing style exactly
- No schema/migration changes this week. Only backend change: `app/api/audit-logs/route.ts`
  gains `old_value`/`new_value` in its select and an `action` query-param filter (Task 1) — no
  new endpoints, no validation schema changes
- API response shape is always `{ data: T | null, error: { code, message } | null }`
- Whole-page gate pattern (`notFound()` from `next/navigation`, NOT the same-named helper from
  `@/lib/auth-helpers` which returns a JSON 404 for API routes): `const { profile } =
  await getSession(); if (!profile || !isAdmin(profile.role)) notFound()` — exact pattern from
  `app/(app)/work-calendar/page.tsx`
- Role-asymmetric behavior for the Users tab's deactivate control: Admin can only
  activate/deactivate Viewer rows (via `PATCH /api/users/[id]` — the only endpoint Admin can call,
  `DELETE` 403s for Admin regardless of target); Super Admin can activate/deactivate anyone except
  themselves, using `DELETE /api/users/[id]` to deactivate (forces sign-out) and `PATCH { is_active:
  true }` to reactivate (there is no "un-delete" endpoint)
- Every git commit message follows the existing convention: `feat:`/`fix:`/`chore:` prefix, one line
- Spec: `docs/superpowers/specs/2026-07-05-minggu12-audit-users-design.md`

---

## Task 1: Types, and Two Small Fixes to `GET /api/audit-logs`

**Files:**
- Modify: `lib/types.ts` (append new section at end of file)
- Modify: `app/api/audit-logs/route.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `UserRole`, `Profile`, `ProfileOption`, `Location`, `AuditAction`, `AuditLogEntry`
  types — consumed by every task from Task 2 onward. The two `GET /api/audit-logs` fixes are
  consumed by Task 5 (`AuditLogClient`, which sends the `action` param) and Task 3
  (`AuditLogTable`, which reads `old_value`/`new_value` via Task 2's modal).

The two backend fixes: `app/api/audit-logs/route.ts`'s `GET` handler currently selects `id,
user_email, user_name, action, entity_type, entity_id, entity_description, created_at` (no
`old_value`/`new_value`, even though both columns exist on `audit_logs` since Week 1 — PRD §10.13
requires a diff modal that needs them) and only filters on `entity_type`, `user_id`, `from`, `to`
(no `action`, even though PRD §10.13 lists "action type" as a filter). Both are one-line additions
to an existing, working route — no new route, no schema change.

- [ ] **Step 1: Append types to `lib/types.ts`**

  Add at the end of `lib/types.ts` (after the existing `Holiday` interface — if Week 11's RACI
  types were added after `Holiday`, append after those instead; either way, append at the true end
  of the file):
  ```typescript

  export type UserRole = 'super_admin' | 'admin' | 'viewer'

  export interface Profile {
    id: string
    email: string
    full_name: string
    role: UserRole
    is_active: boolean
    created_by: string | null
    created_at: string
  }

  export interface ProfileOption {
    id: string
    full_name: string
    email: string
  }

  export interface Location {
    id: string
    name: string
    code: string
    description: string | null
    project_start_date: string
    created_at: string
  }

  export type AuditAction =
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'LOGIN'
    | 'LOGOUT'
    | 'BASELINE_SAVE'
    | 'RECALCULATE'

  export interface AuditLogEntry {
    id: string
    user_email: string
    user_name: string
    action: AuditAction
    entity_type: string
    entity_id: string | null
    entity_description: string | null
    old_value: unknown
    new_value: unknown
    created_at: string
  }
  ```

- [ ] **Step 2: Fix `app/api/audit-logs/route.ts`**

  Read the current file first (`app/api/audit-logs/route.ts`) to see exact current formatting,
  then apply these two changes:

  1. In the `.select(...)` call, add `old_value, new_value` to the column list, so it reads:
     ```typescript
     .select('id, user_email, user_name, action, entity_type, entity_id, entity_description, old_value, new_value, created_at', { count: 'exact' })
     ```

  2. Add an `action` query param read and filter, alongside the existing `entity_type`/`user_id`/
     `from`/`to` ones:
     ```typescript
     const action = searchParams.get('action')
     ```
     placed next to the existing `const entity_type = searchParams.get('entity_type')` line, and:
     ```typescript
     if (action) query = query.eq('action', action)
     ```
     placed next to the existing `if (entity_type) query = query.eq('entity_type', entity_type)`
     line.

  The full modified `GET` handler should read:
  ```typescript
  export async function GET(request: NextRequest) {
    try {
      const { user, profile, supabase } = await getSession()
      if (!user || !profile) return unauthorized()
      if (profile.role === 'viewer') return forbidden()

      const { searchParams } = request.nextUrl
      const entity_type = searchParams.get('entity_type')
      const user_id = searchParams.get('user_id')
      const action = searchParams.get('action')
      const from = searchParams.get('from')
      const to = searchParams.get('to')
      const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
      const offset = (page - 1) * limit

      let query = supabase
        .from('audit_logs')
        .select('id, user_email, user_name, action, entity_type, entity_id, entity_description, old_value, new_value, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (entity_type) query = query.eq('entity_type', entity_type)
      if (user_id) query = query.eq('user_id', user_id)
      if (action) query = query.eq('action', action)
      if (from) query = query.gte('created_at', from)
      if (to) query = query.lte('created_at', to)

      const { data, count, error } = await query
      if (error) return serverError()

      return NextResponse.json({
        data: { items: data, total: count ?? 0, page, limit },
        error: null,
      })
    } catch {
      return serverError()
    }
  }
  ```

- [ ] **Step 3: Verify manually with curl**

  Start the dev server (`npm run dev`) if not already running, log in as an admin account in a
  browser to get a session cookie, then in a terminal with that cookie (or via the browser's own
  fetch console):
  ```
  GET /api/audit-logs?limit=5
  ```
  Expected: `data.items[0]` now includes `old_value` and `new_value` keys (values will be `null`
  or a JSON object depending on what past actions logged). Then:
  ```
  GET /api/audit-logs?action=CREATE&limit=5
  ```
  Expected: every returned item has `"action":"CREATE"`.

- [ ] **Step 4: Run the full test suite and build**

  Run: `npm test`
  Expected: all 83 existing tests still passing (no new tests this task — types + a 2-line API
  fix, no new pure logic)

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

  ```bash
  git add lib/types.ts app/api/audit-logs/route.ts
  git commit -m "feat: add audit-log/user/location types and old_value/new_value + action filter to audit-logs API"
  ```

---

## Task 2: `components/audit-log/AuditDetailModal.tsx`

**Files:**
- Create: `components/audit-log/AuditDetailModal.tsx`

**Interfaces:**
- Consumes: `AuditLogEntry` (Task 1); `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`
  (`components/ui/dialog.tsx`)
- Produces: `AuditDetailModal({ entry, onOpenChange }: AuditDetailModalProps)` — consumed by
  `AuditLogClient` (Task 5). `entry: AuditLogEntry | null` — `null` means closed, a value means
  open showing that entry's diff.

Controlled-by-value dialog (`open={entry !== null}`), same pattern as `WorkloadHeatmap`'s
cell-detail dialog (`components/workload/WorkloadHeatmap.tsx`) rather than a separate boolean
`open` prop — there's nothing to show when there's no selected entry, so the entry itself doubles
as the open/closed signal.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog'
  import type { AuditLogEntry } from '@/lib/types'

  interface AuditDetailModalProps {
    entry: AuditLogEntry | null
    onOpenChange: (open: boolean) => void
  }

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '(kosong)'
    return JSON.stringify(value, null, 2)
  }

  export function AuditDetailModal({ entry, onOpenChange }: AuditDetailModalProps) {
    return (
      <Dialog open={entry !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{entry?.entity_description ?? 'Detail Audit Log'}</DialogTitle>
          </DialogHeader>
          {entry && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Nilai Lama</p>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-96 whitespace-pre-wrap">
                  {formatValue(entry.old_value)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Nilai Baru</p>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-96 whitespace-pre-wrap">
                  {formatValue(entry.new_value)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/audit-log/AuditDetailModal.tsx
  git commit -m "feat: add AuditDetailModal component"
  ```

---

## Task 3: `components/audit-log/AuditLogTable.tsx`

**Files:**
- Create: `components/audit-log/AuditLogTable.tsx`

**Interfaces:**
- Consumes: `AuditAction`, `AuditLogEntry` (Task 1); `Badge`, `Button`, `Table`/`TableBody`/
  `TableCell`/`TableHead`/`TableHeader`/`TableRow` (`components/ui/*`); `format` (`date-fns`)
- Produces: `AuditLogTable({ entries, page, limit, total, onPageChange, onRowClick }:
  AuditLogTableProps)` — consumed by `AuditLogClient` (Task 5). `onPageChange: (page: number) =>
  void`, `onRowClick: (entry: AuditLogEntry) => void`.

Each action type gets a distinct badge color (a plain `Record` lookup, same convention as
`RiskTable`'s `CATEGORY_LABELS`/`STATUS_LABELS` — not extracted to a lib helper, since there's no
computed banding logic here, just a static color-per-key map). Pagination is two `Button`s
("Sebelumnya"/"Berikutnya") plus a "Halaman X dari Y (Z total)" label — no page-number list, since
PRD only asks for prev/next-style navigation through 50-row pages.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { format } from 'date-fns'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table'
  import type { AuditAction, AuditLogEntry } from '@/lib/types'

  const ACTION_CLASSES: Record<AuditAction, string> = {
    CREATE: 'bg-green-50 text-green-700 border-green-200',
    UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
    DELETE: 'bg-red-50 text-red-700 border-red-200',
    LOGIN: 'bg-gray-50 text-gray-600 border-gray-200',
    LOGOUT: 'bg-gray-50 text-gray-600 border-gray-200',
    BASELINE_SAVE: 'bg-purple-50 text-purple-700 border-purple-200',
    RECALCULATE: 'bg-amber-50 text-amber-700 border-amber-200',
  }

  interface AuditLogTableProps {
    entries: AuditLogEntry[]
    page: number
    limit: number
    total: number
    onPageChange: (page: number) => void
    onRowClick: (entry: AuditLogEntry) => void
  }

  export function AuditLogTable({
    entries,
    page,
    limit,
    total,
    onPageChange,
    onRowClick,
  }: AuditLogTableProps) {
    const totalPages = Math.max(1, Math.ceil(total / limit))

    if (entries.length === 0) {
      return <p className="text-sm text-gray-500">Tidak ada log untuk filter ini.</p>
    }

    return (
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Entitas</TableHead>
              <TableHead>Perubahan Ringkas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => onRowClick(entry)}
              >
                <TableCell className="text-gray-500 whitespace-nowrap">
                  {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-gray-900">{entry.user_name}</div>
                  <div className="text-xs text-gray-500">{entry.user_email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={ACTION_CLASSES[entry.action]}>
                    {entry.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-gray-500">{entry.entity_type}</TableCell>
                <TableCell className="text-gray-600">{entry.entity_description ?? '–'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Halaman {page} dari {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/audit-log/AuditLogTable.tsx
  git commit -m "feat: add AuditLogTable component with pagination"
  ```

---

## Task 4: `components/audit-log/AuditLogFilters.tsx`

**Files:**
- Create: `components/audit-log/AuditLogFilters.tsx`

**Interfaces:**
- Consumes: `AuditAction`, `ProfileOption` (Task 1); `Select`/`SelectTrigger`/`SelectValue`/
  `SelectContent`/`SelectItem`, `Input`, `Label` (`components/ui/*`)
- Produces: `AuditLogFilterState` type (`{ entityType: string; userId: string; action: string;
  from: string; to: string }`), `AuditLogFilters({ filters, profiles, onChange }:
  AuditLogFiltersProps)` — both consumed by `AuditLogClient` (Task 5). `onChange: (filters:
  AuditLogFilterState) => void` fires on every individual filter change with the full merged
  state (not a partial patch).

The 12-value `ENTITY_TYPES` list is exactly every distinct `entityType:` string literal passed to
`insertAuditLog()` anywhere in this codebase today: `activities`, `baselines`, `kk_consent`,
`locations`, `reporting_items`, `stakeholders`, `activity_dependencies`, `risk_items`, `phases`,
`work_calendar`, `profiles`, `raci_entries`. This is a UI-only constant (the `entity_type` column
itself has no DB `CHECK` constraint), so it doesn't need to live in `lib/types.ts`.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  } from '@/components/ui/select'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import type { AuditAction, ProfileOption } from '@/lib/types'

  const ENTITY_TYPES = [
    'activities',
    'baselines',
    'kk_consent',
    'locations',
    'reporting_items',
    'stakeholders',
    'activity_dependencies',
    'risk_items',
    'phases',
    'work_calendar',
    'profiles',
    'raci_entries',
  ]

  const ACTIONS: AuditAction[] = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'BASELINE_SAVE',
    'RECALCULATE',
  ]

  export interface AuditLogFilterState {
    entityType: string
    userId: string
    action: string
    from: string
    to: string
  }

  interface AuditLogFiltersProps {
    filters: AuditLogFilterState
    profiles: ProfileOption[]
    onChange: (filters: AuditLogFilterState) => void
  }

  export function AuditLogFilters({ filters, profiles, onChange }: AuditLogFiltersProps) {
    function set<K extends keyof AuditLogFilterState>(key: K, value: AuditLogFilterState[K]) {
      onChange({ ...filters, [key]: value })
    }

    return (
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500">Entitas</Label>
          <Select value={filters.entityType} onValueChange={(v) => set('entityType', v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Entitas</SelectItem>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500">User</Label>
          <Select value={filters.userId} onValueChange={(v) => set('userId', v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua User</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500">Aksi</Label>
          <Select value={filters.action} onValueChange={(v) => set('action', v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Aksi</SelectItem>
              {ACTIONS.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500">Dari Tanggal</Label>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => set('from', e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500">Sampai Tanggal</Label>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => set('to', e.target.value)}
            className="w-40"
          />
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/audit-log/AuditLogFilters.tsx
  git commit -m "feat: add AuditLogFilters component"
  ```

---

## Task 5: `components/audit-log/AuditLogClient.tsx`

**Files:**
- Create: `components/audit-log/AuditLogClient.tsx`

**Interfaces:**
- Consumes: `AuditLogFilters`, `AuditLogFilterState` (Task 4); `AuditLogTable` (Task 3);
  `AuditDetailModal` (Task 2); `AuditLogEntry`, `ProfileOption` (Task 1); `toast` (`sonner`)
- Produces: `AuditLogClient({ initialEntries, initialTotal, profiles }: AuditLogClientProps)` —
  consumed by the page (Task 6).

Owns filter state, current page, the fetched entries/total, and the selected row for the detail
modal. Unlike every other page built so far in this project (which fetch everything once
server-side and filter in-memory client-side), this page's data changes on every filter/page
change — the underlying table can have thousands of rows, so re-fetching via
`GET /api/audit-logs` on each change (rather than fetching everything upfront) is the correct
choice here, not a deviation from convention but a deliberate difference in this task's
constraints.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useEffect, useState } from 'react'
  import { toast } from 'sonner'
  import { AuditLogFilters, type AuditLogFilterState } from './AuditLogFilters'
  import { AuditLogTable } from './AuditLogTable'
  import { AuditDetailModal } from './AuditDetailModal'
  import type { AuditLogEntry, ProfileOption } from '@/lib/types'

  interface AuditLogClientProps {
    initialEntries: AuditLogEntry[]
    initialTotal: number
    profiles: ProfileOption[]
  }

  const LIMIT = 50

  function emptyFilters(): AuditLogFilterState {
    return { entityType: 'all', userId: 'all', action: 'all', from: '', to: '' }
  }

  export function AuditLogClient({ initialEntries, initialTotal, profiles }: AuditLogClientProps) {
    const [entries, setEntries] = useState<AuditLogEntry[]>(initialEntries)
    const [total, setTotal] = useState(initialTotal)
    const [page, setPage] = useState(1)
    const [filters, setFilters] = useState<AuditLogFilterState>(emptyFilters())
    const [loading, setLoading] = useState(false)
    const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)

    useEffect(() => {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (filters.entityType !== 'all') params.set('entity_type', filters.entityType)
      if (filters.userId !== 'all') params.set('user_id', filters.userId)
      if (filters.action !== 'all') params.set('action', filters.action)
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)

      let cancelled = false
      setLoading(true)
      fetch(`/api/audit-logs?${params.toString()}`)
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return
          if (json.error) throw new Error(json.error.message)
          setEntries(json.data.items)
          setTotal(json.data.total)
        })
        .catch((err) => {
          if (!cancelled) toast.error(err instanceof Error ? err.message : 'Gagal memuat audit log')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })

      return () => {
        cancelled = true
      }
    }, [page, filters])

    function handleFiltersChange(next: AuditLogFilterState) {
      setFilters(next)
      setPage(1)
    }

    return (
      <div className="space-y-4">
        <AuditLogFilters filters={filters} profiles={profiles} onChange={handleFiltersChange} />
        {loading ? (
          <p className="text-sm text-gray-500">Memuat…</p>
        ) : (
          <AuditLogTable
            entries={entries}
            page={page}
            limit={LIMIT}
            total={total}
            onPageChange={setPage}
            onRowClick={setSelectedEntry}
          />
        )}
        <AuditDetailModal
          entry={selectedEntry}
          onOpenChange={(open) => !open && setSelectedEntry(null)}
        />
      </div>
    )
  }
  ```

  Note: on the very first render, this `useEffect` will immediately re-fetch page 1 with no
  filters — duplicating the server-provided `initialEntries`/`initialTotal` with an identical
  client request. This is intentional and harmless (a single extra fetch on mount, not a
  correctness issue) — simpler than adding a "skip the first effect run" guard for a page that
  isn't performance-sensitive.

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/audit-log/AuditLogClient.tsx
  git commit -m "feat: add AuditLogClient composing filters, table, and detail modal"
  ```

---

## Task 6: `app/(app)/audit-log/page.tsx` — New Page

**Files:**
- Create: `app/(app)/audit-log/page.tsx`

**Interfaces:**
- Consumes: `getSession`, `isAdmin` (`lib/auth-helpers.ts`); `createClient`
  (`lib/supabase/server.ts`); `AuditLogClient` (Task 5); `AuditLogEntry`, `ProfileOption` (Task 1);
  `notFound` (`next/navigation`)
- Produces: the route itself — `components/layout/Sidebar.tsx`'s existing `/audit-log` link
  (already present, Admin+SA only block) stops 404ing

Whole-page gate, exact same shape as `app/(app)/work-calendar/page.tsx` (Week 10): `notFound()`
from `next/navigation` (a real thrown 404, not the JSON-response helper of the same name from
`lib/auth-helpers`) before any data fetch or JSX.

- [ ] **Step 1: Create the page**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { getSession, isAdmin } from '@/lib/auth-helpers'
  import { AuditLogClient } from '@/components/audit-log/AuditLogClient'
  import type { AuditLogEntry, ProfileOption } from '@/lib/types'

  const LIMIT = 50

  export default async function AuditLogPage() {
    const { profile } = await getSession()
    if (!profile || !isAdmin(profile.role)) notFound()

    const supabase = createClient()

    const { data: entryRows, count } = await supabase
      .from('audit_logs')
      .select(
        'id, user_email, user_name, action, entity_type, entity_id, entity_description, old_value, new_value, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(0, LIMIT - 1)

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name')

    const entries = (entryRows ?? []) as AuditLogEntry[]
    const profiles = (profileRows ?? []) as ProfileOption[]

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-500 mt-1 mb-6">Riwayat perubahan data di seluruh sistem</p>
        <AuditLogClient initialEntries={entries} initialTotal={count ?? 0} profiles={profiles} />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the full build, lint, and test suite**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`, and the route list includes `/audit-log`

  Run: `npm run lint`
  Expected: no errors

  Run: `npm test`
  Expected: all 83 tests passing (unchanged from Task 1 — no new tests this task)

- [ ] **Step 3: Commit**

  ```bash
  git add "app/(app)/audit-log/page.tsx"
  git commit -m "feat: add Audit Log page"
  ```

---

## Task 7: `components/users/UserActiveToggle.tsx`

**Files:**
- Create: `components/users/UserActiveToggle.tsx`

**Interfaces:**
- Consumes: `Profile` (Task 1); `Button`, `Dialog`/`DialogContent`/`DialogFooter`/`DialogHeader`/
  `DialogTitle` (`components/ui/*`); `toast` (`sonner`)
- Produces: `UserActiveToggle({ targetUserId, targetRole, targetIsActive, targetLabel, actorRole,
  actorUserId, onToggled }: UserActiveToggleProps)` — consumed by `UsersTable` (Task 9). `onToggled:
  (id: string, isActive: boolean) => void`.

This is the component that encodes the role-asymmetric behavior from the Global Constraints:
- Renders **nothing** if `targetUserId === actorUserId` (no self-toggle — matches
  `DELETE /api/users/[id]`'s own server-side self-protection, this is the UI mirror of that).
- Renders **nothing** if `actorRole === 'admin'` and `targetRole !== 'viewer'` (Admin literally
  cannot call either endpoint successfully against a non-Viewer target — omit the control
  entirely, per this project's established "admin-only controls are omitted, not disabled"
  convention).
- Deactivating (`targetIsActive === true`, button reads "Nonaktifkan") opens a confirm dialog
  first (this revokes access and, for Super Admin, forces a sign-out — a destructive-enough
  action to warrant confirmation, unlike the plain toggle button PRD describes literally, but
  consistent with every other destructive action in this codebase using a confirm step).
  Confirming calls `DELETE /api/users/[targetUserId]` if `actorRole === 'super_admin'`, or
  `PATCH /api/users/[targetUserId]` with `{ is_active: false }` if `actorRole === 'admin'`
  (only reachable when `targetRole === 'viewer'`, per the render guard above).
- Reactivating (`targetIsActive === false`, button reads "Aktifkan") fires immediately, no
  confirm — this is non-destructive and fully reversible, unlike deactivation. Always
  `PATCH /api/users/[targetUserId]` with `{ is_active: true }` regardless of actor role (this is
  the only path available for reactivation; there is no `DELETE`-reverse endpoint).

- [ ] **Step 1: Create the component**

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
  } from '@/components/ui/dialog'
  import type { Profile } from '@/lib/types'

  interface UserActiveToggleProps {
    targetUserId: string
    targetRole: Profile['role']
    targetIsActive: boolean
    targetLabel: string
    actorRole: 'admin' | 'super_admin'
    actorUserId: string
    onToggled: (id: string, isActive: boolean) => void
  }

  export function UserActiveToggle({
    targetUserId,
    targetRole,
    targetIsActive,
    targetLabel,
    actorRole,
    actorUserId,
    onToggled,
  }: UserActiveToggleProps) {
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    if (targetUserId === actorUserId) return null
    if (actorRole === 'admin' && targetRole !== 'viewer') return null

    async function deactivate() {
      setSubmitting(true)
      try {
        const res =
          actorRole === 'super_admin'
            ? await fetch(`/api/users/${targetUserId}`, { method: 'DELETE' })
            : await fetch(`/api/users/${targetUserId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: false }),
              })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menonaktifkan user')
        }
        onToggled(targetUserId, false)
        toast.success('User dinonaktifkan')
        setConfirmOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menonaktifkan user')
      } finally {
        setSubmitting(false)
      }
    }

    async function reactivate() {
      setSubmitting(true)
      try {
        const res = await fetch(`/api/users/${targetUserId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal mengaktifkan user')
        }
        onToggled(targetUserId, true)
        toast.success('User diaktifkan kembali')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal mengaktifkan user')
      } finally {
        setSubmitting(false)
      }
    }

    if (!targetIsActive) {
      return (
        <Button size="sm" variant="outline" onClick={reactivate} disabled={submitting}>
          {submitting ? 'Memproses…' : 'Aktifkan'}
        </Button>
      )
    }

    return (
      <>
        <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)}>
          Nonaktifkan
        </Button>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nonaktifkan User</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Yakin ingin menonaktifkan <span className="font-medium">{targetLabel}</span>?
              {actorRole === 'super_admin' && ' User akan langsung ter-sign-out dari semua sesi.'}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                Batal
              </Button>
              <Button variant="destructive" onClick={deactivate} disabled={submitting}>
                {submitting ? 'Menonaktifkan…' : 'Nonaktifkan'}
              </Button>
            </DialogFooter>
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
  git add components/users/UserActiveToggle.tsx
  git commit -m "feat: add UserActiveToggle component with role-asymmetric deactivate path"
  ```

---

## Task 8: `components/users/AddUserModal.tsx`

**Files:**
- Create: `components/users/AddUserModal.tsx`

**Interfaces:**
- Consumes: `Profile` (Task 1); `Button`, `Input`, `Label`, `Dialog`/`DialogContent`/
  `DialogFooter`/`DialogHeader`/`DialogTitle`/`DialogTrigger`, `Select`/`SelectTrigger`/
  `SelectValue`/`SelectContent`/`SelectItem` (`components/ui/*`); `toast` (`sonner`)
- Produces: `AddUserModal({ actorRole, actorUserId, onAdded }: AddUserModalProps)` — consumed by
  `UsersTable` (Task 9). `onAdded: (profile: Profile) => void`.

Self-contained trigger (the "+ Buat User" button is the `DialogTrigger` itself), matching
`components/work-calendar/AddHolidayModal.tsx` and `components/raci/AddStakeholderModal.tsx` —
add-only, no edit mode (PRD only asks for create + the separate activate/deactivate toggle, no
"edit user" requirement). The role dropdown's available options depend on `actorRole`: Admin only
ever sees "Viewer" (matches `createUserSchema` + the API's own "Admin can only create Viewer"
check), Super Admin sees "Admin" and "Viewer" (never "Super Admin" as an option — nobody can
create a Super Admin through this UI, consistent with "no self-registration" from the PRD).

- [ ] **Step 1: Create the component**

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
  import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  } from '@/components/ui/select'
  import type { Profile } from '@/lib/types'

  interface AddUserModalProps {
    actorRole: 'admin' | 'super_admin'
    actorUserId: string
    onAdded: (profile: Profile) => void
  }

  export function AddUserModal({ actorRole, actorUserId, onAdded }: AddUserModalProps) {
    const [open, setOpen] = useState(false)
    const [email, setEmail] = useState('')
    const [fullName, setFullName] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState<'admin' | 'viewer'>('viewer')
    const [submitting, setSubmitting] = useState(false)

    const roleOptions: Array<{ value: 'admin' | 'viewer'; label: string }> =
      actorRole === 'super_admin'
        ? [
            { value: 'admin', label: 'Admin' },
            { value: 'viewer', label: 'Viewer' },
          ]
        : [{ value: 'viewer', label: 'Viewer' }]

    async function handleSubmit() {
      if (!email.includes('@')) {
        toast.error('Email tidak valid')
        return
      }
      if (fullName.trim().length < 2) {
        toast.error('Nama minimal 2 karakter')
        return
      }
      if (password.length < 8) {
        toast.error('Password minimal 8 karakter')
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, full_name: fullName, password, role }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal membuat user')
        }
        onAdded({
          id: json.data.id,
          email: json.data.email,
          full_name: json.data.full_name,
          role: json.data.role,
          is_active: true,
          created_by: actorUserId,
          created_at: new Date().toISOString(),
        })
        toast.success('User dibuat')
        setOpen(false)
        setEmail('')
        setFullName('')
        setPassword('')
        setRole('viewer')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal membuat user')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>+ Buat User</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nama Lengkap</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'viewer')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/users/AddUserModal.tsx
  git commit -m "feat: add AddUserModal component"
  ```

---

## Task 9: `components/users/UsersTable.tsx`

**Files:**
- Create: `components/users/UsersTable.tsx`

**Interfaces:**
- Consumes: `UserActiveToggle` (Task 7), `AddUserModal` (Task 8), `Profile` (Task 1); `Badge`,
  `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` (`components/ui/*`);
  `format` (`date-fns`)
- Produces: `UsersTable({ profiles, actorRole, actorUserId, onProfilesChange }: UsersTableProps)`
  — consumed by `UsersLokasiClient` (Task 12). `onProfilesChange: (updater: (prev: Profile[]) =>
  Profile[]) => void`.

Resolves the "Dibuat oleh" column by building a `Map<id, full_name>` from the same `profiles`
array the table already has — no self-referencing Supabase join needed (a self-join on
`profiles.created_by -> profiles.id` would need PostgREST's disambiguation hint syntax, which
isn't used anywhere else in this codebase; building the lookup map client-side from data that's
fetched anyway is simpler and has zero risk of an unfamiliar query failing).

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { format } from 'date-fns'
  import { Badge } from '@/components/ui/badge'
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table'
  import { UserActiveToggle } from './UserActiveToggle'
  import { AddUserModal } from './AddUserModal'
  import type { Profile } from '@/lib/types'

  const ROLE_LABELS: Record<Profile['role'], string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    viewer: 'Viewer',
  }

  interface UsersTableProps {
    profiles: Profile[]
    actorRole: 'admin' | 'super_admin'
    actorUserId: string
    onProfilesChange: (updater: (prev: Profile[]) => Profile[]) => void
  }

  export function UsersTable({
    profiles,
    actorRole,
    actorUserId,
    onProfilesChange,
  }: UsersTableProps) {
    const nameById = new Map(profiles.map((p) => [p.id, p.full_name]))

    function handleToggled(id: string, isActive: boolean) {
      onProfilesChange((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: isActive } : p)))
    }

    function handleAdded(profile: Profile) {
      onProfilesChange((prev) => [profile, ...prev])
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <AddUserModal actorRole={actorRole} actorUserId={actorUserId} onAdded={handleAdded} />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat oleh</TableHead>
              <TableHead>Tanggal Dibuat</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell className="text-gray-500">{p.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[p.role]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={p.is_active ? 'outline' : 'secondary'}>
                    {p.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500">
                  {p.created_by ? nameById.get(p.created_by) ?? '–' : '–'}
                </TableCell>
                <TableCell className="text-gray-500">
                  {format(new Date(p.created_at), 'dd MMM yyyy')}
                </TableCell>
                <TableCell>
                  <UserActiveToggle
                    targetUserId={p.id}
                    targetRole={p.role}
                    targetIsActive={p.is_active}
                    targetLabel={`${p.full_name} (${p.email})`}
                    actorRole={actorRole}
                    actorUserId={actorUserId}
                    onToggled={handleToggled}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/users/UsersTable.tsx
  git commit -m "feat: add UsersTable component"
  ```

---

## Task 10: `components/users/AddLocationModal.tsx` and `components/users/EditLocationModal.tsx`

**Files:**
- Create: `components/users/AddLocationModal.tsx`
- Create: `components/users/EditLocationModal.tsx`

**Interfaces:**
- Consumes: `Location` (Task 1); `Button`, `Input`, `Label`, `Textarea`, `Dialog`/`DialogContent`/
  `DialogFooter`/`DialogHeader`/`DialogTitle`/`DialogTrigger` (`components/ui/*`); `toast`
  (`sonner`)
- Produces: `AddLocationModal({ onAdded }: { onAdded: (location: Location) => void })` and
  `EditLocationModal({ open, onOpenChange, location, onSaved }: EditLocationModalProps)` — both
  consumed by `LokasiTab` (Task 11).

Two small, closely-related location-CRUD modals in one task (same review scope, same pattern,
neither is meaningfully approvable without the other since both feed `LokasiTab`). `AddLocationModal`
is self-contained-trigger + add-only (same shape as `AddStakeholderModal`/`AddHolidayModal`) with
all 4 `createLocationSchema` fields (`name`, `code`, `description` optional, `project_start_date`).
`EditLocationModal` is a controlled dialog (opened by the parent, same shape as `RiskFormModal`)
with only the 2 fields `updateLocationSchema` accepts (`name`, `description` — code and
`project_start_date` are immutable after creation, matching the schema exactly).

- [ ] **Step 1: Create `AddLocationModal.tsx`**

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
  import type { Location } from '@/lib/types'

  interface AddLocationModalProps {
    onAdded: (location: Location) => void
  }

  export function AddLocationModal({ onAdded }: AddLocationModalProps) {
    const [open, setOpen] = useState(false)
    const [name, setName] = useState('')
    const [code, setCode] = useState('')
    const [description, setDescription] = useState('')
    const [projectStartDate, setProjectStartDate] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit() {
      if (name.trim().length < 2) {
        toast.error('Nama minimal 2 karakter')
        return
      }
      if (code.trim().length < 1) {
        toast.error('Kode wajib diisi')
        return
      }
      if (!projectStartDate) {
        toast.error('Tanggal mulai proyek wajib diisi')
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            code,
            description: description || undefined,
            project_start_date: projectStartDate,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menambah lokasi')
        }
        onAdded({
          id: json.data.id,
          name: json.data.name,
          code: json.data.code,
          description: description || null,
          project_start_date: projectStartDate,
          created_at: new Date().toISOString(),
        })
        toast.success('Lokasi ditambahkan')
        setOpen(false)
        setName('')
        setCode('')
        setDescription('')
        setProjectStartDate('')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menambah lokasi')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>+ Tambah Lokasi</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Lokasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nama</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Tanah Abang" />
            </div>
            <div className="space-y-1">
              <Label>Kode</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="mis. TA" />
            </div>
            <div className="space-y-1">
              <Label>Deskripsi</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Tanggal Mulai Proyek</Label>
              <Input
                type="date"
                value={projectStartDate}
                onChange={(e) => setProjectStartDate(e.target.value)}
              />
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

- [ ] **Step 2: Create `EditLocationModal.tsx`**

  ```typescript
  'use client'

  import { useEffect, useState } from 'react'
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
  } from '@/components/ui/dialog'
  import type { Location } from '@/lib/types'

  interface EditLocationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    location: Location | null
    onSaved: (location: Location) => void
  }

  export function EditLocationModal({
    open,
    onOpenChange,
    location,
    onSaved,
  }: EditLocationModalProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
      if (open && location) {
        setName(location.name)
        setDescription(location.description ?? '')
      }
    }, [open, location])

    async function handleSubmit() {
      if (!location) return
      if (name.trim().length < 2) {
        toast.error('Nama minimal 2 karakter')
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch(`/api/locations/${location.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menyimpan lokasi')
        }
        onSaved({ ...location, ...json.data })
        toast.success('Lokasi diperbarui')
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan lokasi')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lokasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nama</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Deskripsi</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
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

- [ ] **Step 3: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

  ```bash
  git add components/users/AddLocationModal.tsx components/users/EditLocationModal.tsx
  git commit -m "feat: add AddLocationModal and EditLocationModal components"
  ```

---

## Task 11: `components/users/LokasiTab.tsx`

**Files:**
- Create: `components/users/LokasiTab.tsx`

**Interfaces:**
- Consumes: `AddLocationModal`, `EditLocationModal` (Task 10), `Location` (Task 1); `Button`,
  `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`, `Dialog`/`DialogContent`/
  `DialogFooter`/`DialogHeader`/`DialogTitle` (`components/ui/*`); `toast` (`sonner`)
- Produces: `LokasiTab({ initialLocations, actorRole }: LokasiTabProps)` — consumed by
  `UsersLokasiClient` (Task 12).

Cards (not a table — PRD §10.15 explicitly says "Kartu per lokasi"), one per location, each with
an Edit button (opens `EditLocationModal`) and — **only rendered when `actorRole ===
'super_admin'`** — a "Nonaktifkan" button with its own inline confirm dialog (same reasoning as
`UserActiveToggle`: `DELETE /api/locations/[locationId]` is destructive and permanent — no
reactivation path exists — so it gets a confirm step even though PRD's prose is terse ("SA: tombol
nonaktifkan lokasi")).

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { toast } from 'sonner'
  import { Button } from '@/components/ui/button'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
  import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog'
  import { AddLocationModal } from './AddLocationModal'
  import { EditLocationModal } from './EditLocationModal'
  import type { Location } from '@/lib/types'

  interface LokasiTabProps {
    initialLocations: Location[]
    actorRole: 'admin' | 'super_admin'
  }

  export function LokasiTab({ initialLocations, actorRole }: LokasiTabProps) {
    const [locations, setLocations] = useState<Location[]>(initialLocations)
    const [editingLocation, setEditingLocation] = useState<Location | null>(null)
    const [deactivatingLocation, setDeactivatingLocation] = useState<Location | null>(null)
    const [submitting, setSubmitting] = useState(false)

    function handleAdded(location: Location) {
      setLocations((prev) => [...prev, location])
    }

    function handleSaved(location: Location) {
      setLocations((prev) => prev.map((l) => (l.id === location.id ? location : l)))
    }

    async function handleDeactivateConfirm() {
      if (!deactivatingLocation) return
      setSubmitting(true)
      try {
        const res = await fetch(`/api/locations/${deactivatingLocation.id}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menonaktifkan lokasi')
        }
        setLocations((prev) => prev.filter((l) => l.id !== deactivatingLocation.id))
        toast.success('Lokasi dinonaktifkan')
        setDeactivatingLocation(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menonaktifkan lokasi')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <AddLocationModal onAdded={handleAdded} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((loc) => (
            <Card key={loc.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {loc.name} <span className="text-gray-400 font-normal">({loc.code})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-500 space-y-1">
                <p>{loc.description || '–'}</p>
                <p className="text-xs">Mulai: {loc.project_start_date}</p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setEditingLocation(loc)}>
                  Edit
                </Button>
                {actorRole === 'super_admin' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeactivatingLocation(loc)}
                  >
                    Nonaktifkan
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        <EditLocationModal
          open={editingLocation !== null}
          onOpenChange={(open) => !open && setEditingLocation(null)}
          location={editingLocation}
          onSaved={handleSaved}
        />

        <Dialog
          open={deactivatingLocation !== null}
          onOpenChange={(open) => !open && setDeactivatingLocation(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nonaktifkan Lokasi</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Yakin ingin menonaktifkan{' '}
              <span className="font-medium">{deactivatingLocation?.name}</span>? Lokasi ini tidak
              akan tampil lagi di manapun.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeactivatingLocation(null)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button variant="destructive" onClick={handleDeactivateConfirm} disabled={submitting}>
                {submitting ? 'Menonaktifkan…' : 'Nonaktifkan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/users/LokasiTab.tsx
  git commit -m "feat: add LokasiTab component"
  ```

---

## Task 12: `components/users/UsersLokasiClient.tsx`

**Files:**
- Create: `components/users/UsersLokasiClient.tsx`

**Interfaces:**
- Consumes: `UsersTable` (Task 9), `LokasiTab` (Task 11), `Profile`, `Location` (Task 1);
  `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (`components/ui/tabs.tsx`)
- Produces: `UsersLokasiClient({ initialProfiles, initialLocations, actorRole, actorUserId }:
  UsersLokasiClientProps)` — consumed by the page (Task 13).

Top-level composition: `Tabs` with 2 triggers ("Users", "Lokasi"), same `Tabs`/`TabsList`/
`TabsTrigger` shadcn primitives already used in `components/gantt/GanttControls.tsx` and
`components/activities/DependencyPanel.tsx`. Only the `profiles` list needs to live here as state
(so `UsersTable`'s add/toggle callbacks can update it) — `LokasiTab` owns its own `locations`
state internally since nothing outside it needs to react to location changes.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
  import { UsersTable } from './UsersTable'
  import { LokasiTab } from './LokasiTab'
  import type { Profile, Location } from '@/lib/types'

  interface UsersLokasiClientProps {
    initialProfiles: Profile[]
    initialLocations: Location[]
    actorRole: 'admin' | 'super_admin'
    actorUserId: string
  }

  export function UsersLokasiClient({
    initialProfiles,
    initialLocations,
    actorRole,
    actorUserId,
  }: UsersLokasiClientProps) {
    const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)

    return (
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="lokasi">Lokasi</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTable
            profiles={profiles}
            actorRole={actorRole}
            actorUserId={actorUserId}
            onProfilesChange={setProfiles}
          />
        </TabsContent>
        <TabsContent value="lokasi">
          <LokasiTab initialLocations={initialLocations} actorRole={actorRole} />
        </TabsContent>
      </Tabs>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/users/UsersLokasiClient.tsx
  git commit -m "feat: add UsersLokasiClient composing Users and Lokasi tabs"
  ```

---

## Task 13: `app/(app)/users/page.tsx` — New Page

**Files:**
- Create: `app/(app)/users/page.tsx`

**Interfaces:**
- Consumes: `getSession`, `isAdmin` (`lib/auth-helpers.ts`); `createClient`
  (`lib/supabase/server.ts`); `UsersLokasiClient` (Task 12); `Profile`, `Location` (Task 1);
  `notFound` (`next/navigation`)
- Produces: the route itself — `components/layout/Sidebar.tsx`'s existing `/users` link
  (labeled "Users & Lokasi", Admin+SA only block) stops 404ing

Whole-page gate, same shape as Task 6's `/audit-log` page. Two independent flat queries (no
nested embeds needed): all `profiles` (including inactive — the Users tab needs to show
deactivated accounts, unlike every other "active-only" list in this app) and active `locations`
(plain fields, no nested `phases`/`activities` — the Lokasi cards don't show progress stats).

- [ ] **Step 1: Create the page**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { getSession, isAdmin } from '@/lib/auth-helpers'
  import { UsersLokasiClient } from '@/components/users/UsersLokasiClient'
  import type { Profile, Location } from '@/lib/types'

  export default async function UsersPage() {
    const { user, profile } = await getSession()
    if (!user || !profile || !isAdmin(profile.role)) notFound()

    const supabase = createClient()

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_by, created_at')
      .order('created_at', { ascending: false })

    const { data: locationRows } = await supabase
      .from('locations')
      .select('id, name, code, description, project_start_date, created_at')
      .eq('is_active', true)
      .order('display_order')

    const profiles = (profileRows ?? []) as Profile[]
    const locations = (locationRows ?? []) as Location[]

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users & Lokasi</h1>
        <p className="text-gray-500 mt-1 mb-6">Manajemen akun pengguna dan lokasi proyek</p>
        <UsersLokasiClient
          initialProfiles={profiles}
          initialLocations={locations}
          actorRole={profile.role === 'super_admin' ? 'super_admin' : 'admin'}
          actorUserId={user.id}
        />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the full build, lint, and test suite**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`, and the route list includes `/users`

  Run: `npm run lint`
  Expected: no errors

  Run: `npm test`
  Expected: all 83 tests passing (unchanged from Task 1 — no new tests this task)

- [ ] **Step 3: Commit**

  ```bash
  git add "app/(app)/users/page.tsx"
  git commit -m "feat: add Users & Lokasi page"
  ```

---

## Task 14: Final Real-Browser E2E Pass and Progress Ledger

**Files:**
- Modify: `.superpowers/sdd/progress.md`

No code changes — this task verifies both pages end-to-end with a real headless browser (the
approach established since Week 5, driving Playwright's `chromium` module directly via
`require('playwright')`/`chromium.launch()`). This is the pass that has repeatedly caught real
integration bugs (Week 6: missing `TooltipProvider`; Week 10: a Sidebar regex bug plus a
cross-feature CPM bug; each prior week's role/whole-page-gate logic in particular has been a
recurring source of real bugs) that code review alone did not — do not substitute plain HTTP
requests for this task. This week's role matrix (Admin vs Super Admin vs Viewer, times two
features) makes this pass especially important.

- [ ] **Step 1: Prepare test data**

  You will need to create at least 1 disposable test user (role Viewer) and use the existing
  `superadmin@perumnas.co.id` / `admin@perumnas.co.id` / `viewer@perumnas.co.id` accounts for the
  role-matrix checks. Do not deactivate any of these 3 pre-existing seeded accounts — only the
  disposable test user you create in this pass.

- [ ] **Step 2: Real-browser pass — Audit Log**

  As admin, navigate to `/audit-log`. Confirm the table shows recent entries (there should be
  plenty from every prior week's work) with correct Waktu/User/Aksi/Entitas/Perubahan Ringkas
  columns and a distinct badge color per action type. Apply the Entitas filter to one specific
  type (e.g. `reporting_items`), confirm every visible row's Entitas column matches. Apply the
  Aksi filter to `DELETE`, confirm every row shows a DELETE badge. Apply a date range that
  excludes today, confirm the table empties or shows only older entries. Reset all filters. Click
  a row where you know a real change was recorded (e.g. any Week 11 RACI/Pelaporan edit), confirm
  the modal opens showing distinct Nilai Lama / Nilai Baru JSON that plausibly matches what
  changed. Click Berikutnya/Sebelumnya to page through results, confirm the "Halaman X dari Y"
  label updates and the row set changes. Log out, log in as `viewer@perumnas.co.id`, navigate
  directly to `/audit-log` by URL, confirm it 404s (not a redirect, not a rendered page with
  hidden controls).

- [ ] **Step 3: Real-browser pass — Users tab, role matrix**

  As `superadmin@perumnas.co.id`, navigate to `/users`, confirm the Users tab is active by
  default. Use "+ Buat User" to create a disposable Viewer account, confirm it appears in the
  table with correct Role/Status/Tanggal Dibuat, and confirm "Dibuat oleh" shows the Super Admin's
  name. Confirm no toggle button renders in your own row. Click "Nonaktifkan" on the disposable
  Viewer, confirm the dialog mentions forced sign-out, confirm, and confirm the Status badge
  flips to Nonaktif and the button now reads "Aktifkan". Click "Aktifkan", confirm it flips back
  immediately with no confirm dialog. Confirm you (as SA) see a Nonaktifkan/Aktifkan control on
  the `admin@perumnas.co.id` row too (SA can toggle anyone but self). Log out, log in as
  `admin@perumnas.co.id`, navigate to `/users`. Confirm the disposable Viewer row shows a
  toggle control but the `superadmin@perumnas.co.id` and other admin rows show none at all.
  Toggle the disposable Viewer off via the Admin account, confirm the dialog does NOT mention
  forced sign-out (Admin uses PATCH, not DELETE), confirm it succeeds. Confirm "+ Buat User" as
  Admin only offers "Viewer" in the role dropdown (no "Admin" option). Log out, log in as
  `viewer@perumnas.co.id`, navigate directly to `/users` by URL, confirm it 404s.

- [ ] **Step 4: Real-browser pass — Lokasi tab**

  As `superadmin@perumnas.co.id`, switch to the Lokasi tab, confirm existing active locations
  render as cards with name/code/description/tanggal mulai. Click "+ Tambah Lokasi", create a
  disposable test location, confirm it appears as a new card. Click its Edit button, change the
  description, save, confirm the card updates. Confirm the "Nonaktifkan" button is visible on
  cards as SA. Log in as `admin@perumnas.co.id`, switch to the Lokasi tab, confirm Edit is
  available but "Nonaktifkan" is NOT rendered anywhere (Admin can't deactivate locations, only
  SA can). Log back in as SA, click "Nonaktifkan" on the disposable test location, confirm the
  dialog, confirm, and confirm the card disappears from the grid.

- [ ] **Step 5: Cross-role and console check**

  Confirm zero browser console errors across the whole run.

- [ ] **Step 6: Clean up test data**

  As `superadmin@perumnas.co.id`: fully deactivate the disposable Viewer test user if it isn't
  already deactivated from Step 3's testing (confirm via `GET /api/users` that it shows
  `is_active: false`, or leave it deactivated — do not attempt to hard-delete a user, no such
  endpoint exists). Confirm the disposable test location from Step 4 was already deactivated
  during that step (confirm via `GET /api/locations` that it no longer appears in the active
  list).

- [ ] **Step 7: Record the ledger entry**

  Append to `.superpowers/sdd/progress.md`:
  ```markdown

  ## Week 12
  # Plan: docs/superpowers/plans/2026-07-05-minggu12-audit-users.md
  # Spec: docs/superpowers/specs/2026-07-05-minggu12-audit-users-design.md
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
  - Task 13: [fill in commit + review outcome]
  - Task 14: [fill in E2E findings — do not leave this as a template]
  - Week 12 Audit Log & Users/Lokasi COMPLETE (fill in date)
  ```

  ```bash
  git add .superpowers/sdd/progress.md
  git commit -m "chore: record Week 12 Task 14 E2E pass in SDD progress ledger"
  ```
