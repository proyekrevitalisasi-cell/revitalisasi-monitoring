# Minggu 11: RACI & Pelaporan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two global pages — `/raci` (RACI matrix: fase × stakeholder, editable by admin,
column reorder + soft-delete + add-stakeholder) and `/pelaporan` (rencana pelaporan table, editable
by admin via add/edit modal).

**Architecture:** Backend already exists and is untouched this week — `raci_entries` and
`reporting_items` tables + RLS (Week 1/2 migrations), `stakeholders` table + full CRUD API
(Week 2), `GET /api/phases/[id]/raci` + `PUT /api/phases/[id]/raci/[stakeholderId]`,
`GET/POST /api/reporting-items` + `PATCH/DELETE /api/reporting-items/[id]`. This is a pure UI week:
two new server-component pages fetch everything up front (locations nested with phases nested with
raci_entries, in one query — same shape as the Week 10 Workload page, which fetches all
locations+phases+activities in one query and does all filtering client-side) and pass plain data
down to client components that own all interactive state. Stakeholder column reorder reuses the
existing `PATCH /api/stakeholders/[id]` twice (swap `display_order` between the moved column and
its neighbor) — no new reorder endpoint, matching Task Right-Sizing (the only new "backend" write
this week is calling an existing endpoint from a new place).

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase JS v2 · shadcn/ui (`Select`, `Dialog`,
`Table`, `Input`, `Label`, `Textarea`, `Button` — all already installed, no new shadcn components
needed) · sonner (toasts)

## Global Constraints

- `npm run build` must pass before every commit; `npm test` must keep passing (83 existing tests —
  no new Vitest tests this week, since there's no new pure-logic module like `risk-utils.ts` or
  `workload-metrics.ts` to unit-test; everything here is CRUD wiring + a display_order swap,
  already covered by the existing Zod schemas and this week's own E2E pass)
- TypeScript strict — no implicit `any`
- No semicolons, single quotes — match this project's existing style exactly
- No API routes, validation schemas, RLS policies, or migrations change this week —
  `raci_entries`, `reporting_items`, `stakeholders`, their RLS, and all their API routes have been
  fully working and unused (RACI/Pelaporan pages didn't exist yet) since Week 2
- API response shape is always `{ data: T | null, error: { code, message } | null }` — every fetch
  call in this plan follows the same `if (!res.ok || json.error) throw ...` pattern already used
  in `components/risks/RiskFormModal.tsx` and `components/work-calendar/AddHolidayModal.tsx`
- Role gating follows the established per-page convention: admin-only **action** controls (Edit
  pencil, delete dialogs, "+ Tambah Stakeholder", "+ Tambah Baris", reorder ▲▼) are omitted
  entirely for non-admins; the RACI cell itself (an always-visible piece of data) renders as plain
  text for non-admins instead of a `Select`
- Reorder uses ▲▼ buttons, not drag-and-drop — `@dnd-kit` is installed but intentionally unused
  project-wide since Week 3's explicit choice to avoid it; this week does not change that
- Every git commit message follows the existing convention: `feat:`/`fix:`/`chore:` prefix, one line
- Spec: `docs/superpowers/specs/2026-07-05-minggu11-raci-pelaporan-design.md`

---

## Task 1: RACI and Reporting Types

**Files:**
- Modify: `lib/types.ts` (append new section at end of file)

**Interfaces:**
- Consumes: nothing new
- Produces: `Stakeholder`, `RaciRole`, `RaciEntry`, `RaciPhase`, `RaciLocation`, `ReportingItem`
  types — consumed by every task from Task 2 onward.

- [ ] **Step 1: Append types to `lib/types.ts`**

  Add at the end of `lib/types.ts` (after the existing `Holiday` interface):
  ```typescript

  export interface Stakeholder {
    id: string
    code: string
    name: string
    group_name: string
    display_order: number
  }

  export type RaciRole = 'R' | 'A' | 'C' | 'I'

  export interface RaciEntry {
    stakeholder_id: string
    role: RaciRole
  }

  export interface RaciPhase {
    id: string
    phase_code: string
    name: string
    display_order: number
    raci_entries: RaciEntry[]
  }

  export interface RaciLocation {
    id: string
    code: string
    name: string
    phases: RaciPhase[]
  }

  export interface ReportingItem {
    id: string
    display_order: number
    jenis_laporan: string
    dari_pic: string
    kepada: string
    frekuensi: string
    isi_konten: string
    format_media: string
  }
  ```

- [ ] **Step 2: Run the full test suite and build**

  Run: `npm test`
  Expected: all 83 existing tests still passing (no new tests this task — types only)

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add lib/types.ts
  git commit -m "feat: add RACI and reporting item types"
  ```

---

## Task 2: `components/raci/DeleteStakeholderDialog.tsx`

**Files:**
- Create: `components/raci/DeleteStakeholderDialog.tsx`

**Interfaces:**
- Consumes: `Button` (`components/ui/button.tsx`), `Dialog`/`DialogContent`/`DialogFooter`/
  `DialogHeader`/`DialogTitle`/`DialogTrigger` (`components/ui/dialog.tsx`), `toast` (`sonner`)
- Produces: `DeleteStakeholderDialog({ stakeholderId, stakeholderLabel, onDeleted }: {
  stakeholderId: string; stakeholderLabel: string; onDeleted: (id: string) => void })` — consumed
  by `RaciMatrix` (Task 5)

Structurally identical to `components/risks/DeleteRiskDialog.tsx`, targeting
`DELETE /api/stakeholders/[id]` (a soft delete — sets `is_active = false`, `raci_entries` for this
stakeholder are left untouched in the DB, they just stop rendering since the matrix only shows
active stakeholders). Trigger is a plain "×" character per PRD §10.9 ("Ikon × di header kolom"),
not the 🗑️ emoji used elsewhere, since this sits inline in a narrow table header cell.

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
    DialogTrigger,
  } from '@/components/ui/dialog'

  interface DeleteStakeholderDialogProps {
    stakeholderId: string
    stakeholderLabel: string
    onDeleted: (id: string) => void
  }

  export function DeleteStakeholderDialog({
    stakeholderId,
    stakeholderLabel,
    onDeleted,
  }: DeleteStakeholderDialogProps) {
    const [open, setOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    async function handleConfirm() {
      setSubmitting(true)
      setErrorMessage(null)
      try {
        const res = await fetch(`/api/stakeholders/${stakeholderId}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message ?? 'Gagal menonaktifkan stakeholder')
          return
        }
        onDeleted(stakeholderId)
        toast.success('Stakeholder dinonaktifkan')
        setOpen(false)
      } catch {
        setErrorMessage('Gagal menonaktifkan stakeholder')
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
          <button
            type="button"
            className="text-gray-400 hover:text-red-600 text-sm leading-none px-1"
            title={`Nonaktifkan ${stakeholderLabel}`}
          >
            ×
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonaktifkan Stakeholder</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Yakin ingin menonaktifkan <span className="font-medium">{stakeholderLabel}</span>? Nilai
            RACI stakeholder ini di semua fase tetap tersimpan, tapi kolomnya tidak akan tampil lagi
            di matriks.
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
              {submitting ? 'Menonaktifkan…' : 'Nonaktifkan'}
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
  git add components/raci/DeleteStakeholderDialog.tsx
  git commit -m "feat: add DeleteStakeholderDialog component"
  ```

---

## Task 3: `components/raci/AddStakeholderModal.tsx`

**Files:**
- Create: `components/raci/AddStakeholderModal.tsx`

**Interfaces:**
- Consumes: `Stakeholder` (Task 1); `Button`, `Input`, `Label`, `Dialog`/`DialogContent`/
  `DialogFooter`/`DialogHeader`/`DialogTitle`/`DialogTrigger` (`components/ui/*`); `toast` (`sonner`)
- Produces: `AddStakeholderModal({ nextDisplayOrder, onAdded }: { nextDisplayOrder: number; onAdded:
  (stakeholder: Stakeholder) => void })` — consumed by `RaciClient` (Task 6)

Self-contained trigger (the "+ Tambah Stakeholder" button is the `DialogTrigger` itself), matching
`components/work-calendar/AddHolidayModal.tsx` — this is add-only (RACI has no "edit stakeholder"
requirement in the PRD, only add/soft-delete/reorder), unlike `RiskFormModal` which is
create+edit combined. `nextDisplayOrder` is computed by the parent (`RaciClient`, Task 6) so new
stakeholders are appended at the end of the column order, not defaulted to `0` by the API.

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
  import type { Stakeholder } from '@/lib/types'

  interface AddStakeholderModalProps {
    nextDisplayOrder: number
    onAdded: (stakeholder: Stakeholder) => void
  }

  export function AddStakeholderModal({ nextDisplayOrder, onAdded }: AddStakeholderModalProps) {
    const [open, setOpen] = useState(false)
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [groupName, setGroupName] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit() {
      if (code.trim().length < 1 || name.trim().length < 2 || groupName.trim().length < 1) {
        toast.error('Kode, nama, dan grup wajib diisi')
        return
      }
      setSubmitting(true)
      try {
        const res = await fetch('/api/stakeholders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            name,
            group_name: groupName,
            display_order: nextDisplayOrder,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menambah stakeholder')
        }
        onAdded(json.data as Stakeholder)
        toast.success('Stakeholder ditambahkan')
        setOpen(false)
        setCode('')
        setName('')
        setGroupName('')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menambah stakeholder')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>+ Tambah Stakeholder</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Stakeholder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Kode</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="mis. BAPPENAS" />
            </div>
            <div className="space-y-1">
              <Label>Nama</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mis. Kementerian PPN/Bappenas"
              />
            </div>
            <div className="space-y-1">
              <Label>Grup</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="mis. Bappenas"
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

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/raci/AddStakeholderModal.tsx
  git commit -m "feat: add AddStakeholderModal component"
  ```

---

## Task 4: `components/raci/RaciCell.tsx`

**Files:**
- Create: `components/raci/RaciCell.tsx`

**Interfaces:**
- Consumes: `RaciRole` (Task 1); `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/
  `SelectItem` (`components/ui/select.tsx`); `toast` (`sonner`)
- Produces: `RaciCell({ phaseId, stakeholderId, role, canEdit, onChanged }: RaciCellProps)` —
  consumed by `RaciMatrix` (Task 5). `role: RaciRole | null`, `onChanged: (role: RaciRole | null)
  => void`.

One matrix cell. Owns its own `PUT /api/phases/[phaseId]/raci/[stakeholderId]` call, firing
immediately on selection change (a discrete dropdown pick, not free text — same immediate-fire
convention as `RiskTable`'s Probabilitas/Dampak `Select`s). shadcn's `Select` can't use an empty
string as an item value, so the "hapus/kosongkan" option uses the sentinel value `'NONE'`, mapped
to `null` before the request is sent and before calling `onChanged`.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { toast } from 'sonner'
  import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  } from '@/components/ui/select'
  import type { RaciRole } from '@/lib/types'

  const ROLE_LABELS: Record<RaciRole, string> = { R: 'R', A: 'A', C: 'C', I: 'I' }

  interface RaciCellProps {
    phaseId: string
    stakeholderId: string
    role: RaciRole | null
    canEdit: boolean
    onChanged: (role: RaciRole | null) => void
  }

  export function RaciCell({ phaseId, stakeholderId, role, canEdit, onChanged }: RaciCellProps) {
    const [saving, setSaving] = useState(false)

    async function handleChange(value: string) {
      const nextRole = value === 'NONE' ? null : (value as RaciRole)
      setSaving(true)
      try {
        const res = await fetch(`/api/phases/${phaseId}/raci/${stakeholderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: nextRole }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menyimpan RACI')
        }
        onChanged(nextRole)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan RACI')
      } finally {
        setSaving(false)
      }
    }

    if (!canEdit) {
      return (
        <span className="flex items-center justify-center text-sm font-medium text-gray-600">
          {role ? ROLE_LABELS[role] : '–'}
        </span>
      )
    }

    return (
      <Select value={role ?? 'NONE'} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="w-14 h-8 mx-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">–</SelectItem>
          <SelectItem value="R">R</SelectItem>
          <SelectItem value="A">A</SelectItem>
          <SelectItem value="C">C</SelectItem>
          <SelectItem value="I">I</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/raci/RaciCell.tsx
  git commit -m "feat: add RaciCell component"
  ```

---

## Task 5: `components/raci/RaciMatrix.tsx`

**Files:**
- Create: `components/raci/RaciMatrix.tsx`

**Interfaces:**
- Consumes: `RaciCell` (Task 4), `DeleteStakeholderDialog` (Task 2), `RaciPhase`/`RaciRole`/
  `Stakeholder` (Task 1), `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow`
  (`components/ui/table.tsx`)
- Produces: `RaciMatrix({ phases, stakeholders, isAdmin, onCellChanged, onReorder, onDeleted }:
  RaciMatrixProps)` — consumed by `RaciClient` (Task 6). `onCellChanged: (phaseId: string,
  stakeholderId: string, role: RaciRole | null) => void`, `onReorder: (stakeholderId: string,
  direction: 'up' | 'down') => void`, `onDeleted: (stakeholderId: string) => void`.

Rows = fase (already sorted by `display_order` by the caller), columns = stakeholders (already
sorted by `display_order` by the caller — this component does not re-sort, it trusts the order
it's given, so `RaciClient`'s optimistic reorder is what actually moves the column). The first
column ("Fase") is sticky-left, same pattern as `WorkloadHeatmap`'s sticky "PIC" column. Below the
table: the R/A/C/I legend and the full stakeholder code→name→group list, per PRD §10.9 ("Bawah
tabel: Legend RACI + daftar kode lengkap").

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
  import { RaciCell } from './RaciCell'
  import { DeleteStakeholderDialog } from './DeleteStakeholderDialog'
  import type { RaciPhase, RaciRole, Stakeholder } from '@/lib/types'

  const ROLE_LEGEND: Array<{ code: RaciRole; label: string }> = [
    { code: 'R', label: 'Responsible — pelaksana' },
    { code: 'A', label: 'Accountable — penanggung jawab' },
    { code: 'C', label: 'Consulted — dikonsultasikan' },
    { code: 'I', label: 'Informed — diinformasikan' },
  ]

  interface RaciMatrixProps {
    phases: RaciPhase[]
    stakeholders: Stakeholder[]
    isAdmin: boolean
    onCellChanged: (phaseId: string, stakeholderId: string, role: RaciRole | null) => void
    onReorder: (stakeholderId: string, direction: 'up' | 'down') => void
    onDeleted: (stakeholderId: string) => void
  }

  function roleOf(phase: RaciPhase, stakeholderId: string): RaciRole | null {
    return phase.raci_entries.find((e) => e.stakeholder_id === stakeholderId)?.role ?? null
  }

  export function RaciMatrix({
    phases,
    stakeholders,
    isAdmin,
    onCellChanged,
    onReorder,
    onDeleted,
  }: RaciMatrixProps) {
    if (phases.length === 0) {
      return <p className="text-sm text-gray-500">Lokasi ini belum punya fase.</p>
    }

    return (
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-white">Fase</TableHead>
                {stakeholders.map((sh, index) => (
                  <TableHead key={sh.id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span title={`${sh.name} (${sh.group_name})`}>{sh.code}</span>
                      {isAdmin && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <button
                            type="button"
                            onClick={() => onReorder(sh.id, 'up')}
                            disabled={index === 0}
                            className="hover:text-gray-900 disabled:opacity-30"
                            title="Geser kiri"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => onReorder(sh.id, 'down')}
                            disabled={index === stakeholders.length - 1}
                            className="hover:text-gray-900 disabled:opacity-30"
                            title="Geser kanan"
                          >
                            ▼
                          </button>
                          <DeleteStakeholderDialog
                            stakeholderId={sh.id}
                            stakeholderLabel={`${sh.code} — ${sh.name}`}
                            onDeleted={onDeleted}
                          />
                        </div>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {phases.map((phase) => (
                <TableRow key={phase.id}>
                  <TableCell className="sticky left-0 bg-white font-medium whitespace-nowrap">
                    {phase.phase_code} — {phase.name}
                  </TableCell>
                  {stakeholders.map((sh) => (
                    <TableCell key={sh.id} className="text-center p-1">
                      <RaciCell
                        phaseId={phase.id}
                        stakeholderId={sh.id}
                        role={roleOf(phase, sh.id)}
                        canEdit={isAdmin}
                        onChanged={(role) => onCellChanged(phase.id, sh.id, role)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="text-xs text-gray-500 space-y-2 border-t pt-3">
          <div className="flex flex-wrap gap-4">
            {ROLE_LEGEND.map((r) => (
              <span key={r.code}>
                <span className="font-semibold">{r.code}</span> = {r.label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {stakeholders.map((sh) => (
              <span key={sh.id}>
                <span className="font-medium">{sh.code}</span> — {sh.name} ({sh.group_name})
              </span>
            ))}
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
  git add components/raci/RaciMatrix.tsx
  git commit -m "feat: add RaciMatrix component with legend"
  ```

---

## Task 6: `components/raci/RaciClient.tsx`

**Files:**
- Create: `components/raci/RaciClient.tsx`

**Interfaces:**
- Consumes: `RaciMatrix` (Task 5), `AddStakeholderModal` (Task 3), `RaciLocation`/`RaciRole`/
  `Stakeholder` (Task 1); `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`,
  `Label` (`components/ui/*`); `toast` (`sonner`)
- Produces: `RaciClient({ locations, initialStakeholders, isAdmin }: RaciClientProps)` — consumed
  by the page (Task 7).

Owns all client-side state: the location selector (filters in-memory — `locations` already has
every location's phases and RACI entries loaded by the server page, per the design doc's "fetch
everything up front" decision, so switching locations here is a pure re-render, not a fetch), the
stakeholder list (for reorder/add/delete), and the RACI entries themselves (for optimistic cell
updates). Reorder swaps `display_order` between the moved stakeholder and its immediate neighbor
via two parallel `PATCH /api/stakeholders/[id]` calls, optimistically reordering the local array
first and reverting it if either call fails.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { toast } from 'sonner'
  import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
  import { Label } from '@/components/ui/label'
  import { RaciMatrix } from './RaciMatrix'
  import { AddStakeholderModal } from './AddStakeholderModal'
  import type { RaciLocation, RaciRole, Stakeholder } from '@/lib/types'

  interface RaciClientProps {
    locations: RaciLocation[]
    initialStakeholders: Stakeholder[]
    isAdmin: boolean
  }

  export function RaciClient({ locations, initialStakeholders, isAdmin }: RaciClientProps) {
    const [locationsState, setLocationsState] = useState<RaciLocation[]>(locations)
    const [stakeholders, setStakeholders] = useState<Stakeholder[]>(
      [...initialStakeholders].sort((a, b) => a.display_order - b.display_order)
    )
    const [selectedCode, setSelectedCode] = useState(locations[0]?.code ?? '')

    if (locationsState.length === 0) {
      return <p className="text-sm text-gray-500">Tidak ada lokasi aktif.</p>
    }

    const selectedLocation = locationsState.find((loc) => loc.code === selectedCode) ?? null
    const phases = selectedLocation
      ? [...selectedLocation.phases].sort((a, b) => a.display_order - b.display_order)
      : []

    function handleCellChanged(phaseId: string, stakeholderId: string, role: RaciRole | null) {
      setLocationsState((prev) =>
        prev.map((loc) => ({
          ...loc,
          phases: loc.phases.map((phase) => {
            if (phase.id !== phaseId) return phase
            const withoutEntry = phase.raci_entries.filter((e) => e.stakeholder_id !== stakeholderId)
            return {
              ...phase,
              raci_entries: role
                ? [...withoutEntry, { stakeholder_id: stakeholderId, role }]
                : withoutEntry,
            }
          }),
        }))
      )
    }

    async function handleReorder(stakeholderId: string, direction: 'up' | 'down') {
      const index = stakeholders.findIndex((s) => s.id === stakeholderId)
      const neighborIndex = direction === 'up' ? index - 1 : index + 1
      if (index === -1 || neighborIndex < 0 || neighborIndex >= stakeholders.length) return

      const current = stakeholders[index]
      const neighbor = stakeholders[neighborIndex]
      const previous = stakeholders

      const swapped = [...stakeholders]
      swapped[index] = { ...neighbor, display_order: current.display_order }
      swapped[neighborIndex] = { ...current, display_order: neighbor.display_order }
      setStakeholders(swapped.sort((a, b) => a.display_order - b.display_order))

      try {
        const [res1, res2] = await Promise.all([
          fetch(`/api/stakeholders/${current.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_order: neighbor.display_order }),
          }),
          fetch(`/api/stakeholders/${neighbor.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_order: current.display_order }),
          }),
        ])
        const [json1, json2] = await Promise.all([res1.json(), res2.json()])
        if (!res1.ok || json1.error || !res2.ok || json2.error) {
          throw new Error(json1.error?.message ?? json2.error?.message ?? 'Gagal menukar urutan')
        }
      } catch (err) {
        setStakeholders(previous)
        toast.error(err instanceof Error ? err.message : 'Gagal menukar urutan')
      }
    }

    function handleStakeholderDeleted(id: string) {
      setStakeholders((prev) => prev.filter((s) => s.id !== id))
    }

    function handleStakeholderAdded(stakeholder: Stakeholder) {
      setStakeholders((prev) =>
        [...prev, stakeholder].sort((a, b) => a.display_order - b.display_order)
      )
    }

    const nextDisplayOrder =
      stakeholders.length === 0 ? 0 : Math.max(...stakeholders.map((s) => s.display_order)) + 1

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-500">Lokasi</Label>
            <Select value={selectedCode} onValueChange={setSelectedCode}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locationsState.map((loc) => (
                  <SelectItem key={loc.code} value={loc.code}>
                    {loc.name} ({loc.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <AddStakeholderModal nextDisplayOrder={nextDisplayOrder} onAdded={handleStakeholderAdded} />
          )}
        </div>

        <RaciMatrix
          phases={phases}
          stakeholders={stakeholders}
          isAdmin={isAdmin}
          onCellChanged={handleCellChanged}
          onReorder={handleReorder}
          onDeleted={handleStakeholderDeleted}
        />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/raci/RaciClient.tsx
  git commit -m "feat: add RaciClient composing location filter, matrix, and add-stakeholder modal"
  ```

---

## Task 7: `app/(app)/raci/page.tsx` — New Page

**Files:**
- Create: `app/(app)/raci/page.tsx`

**Interfaces:**
- Consumes: `getSession`, `isAdmin` (`lib/auth-helpers.ts`); `createClient`
  (`lib/supabase/server.ts`); `RaciClient` (Task 6); `RaciLocation`, `Stakeholder` (Task 1)
- Produces: the route itself — `components/layout/Sidebar.tsx`'s existing `/raci` link (already
  present, added when the nav was built) stops 404ing

Same "fetch everything in one nested query" shape as `app/(app)/workload/page.tsx` (Week 10):
`locations` nested with `phases` nested with `raci_entries`. `stakeholders` is a second, separate
query (not nested under locations — it's a flat, location-independent list).

- [ ] **Step 1: Create the page**

  ```typescript
  import { createClient } from '@/lib/supabase/server'
  import { getSession, isAdmin } from '@/lib/auth-helpers'
  import { RaciClient } from '@/components/raci/RaciClient'
  import type { RaciLocation, Stakeholder } from '@/lib/types'

  export default async function RaciPage() {
    const supabase = createClient()
    const { profile } = await getSession()
    const canEdit = profile ? isAdmin(profile.role) : false

    const { data: locationRows } = await supabase
      .from('locations')
      .select(
        `
        id, code, name,
        phases (
          id, phase_code, name, display_order,
          raci_entries ( stakeholder_id, role )
        )
      `
      )
      .eq('is_active', true)
      .order('display_order')

    const { data: stakeholderRows } = await supabase
      .from('stakeholders')
      .select('id, code, name, group_name, display_order')
      .eq('is_active', true)
      .order('display_order')

    const locations = (locationRows ?? []) as RaciLocation[]
    const stakeholders = (stakeholderRows ?? []) as Stakeholder[]

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">RACI</h1>
        <p className="text-gray-500 mt-1 mb-6">
          Matriks Responsible / Accountable / Consulted / Informed per fase dan stakeholder
        </p>
        <RaciClient locations={locations} initialStakeholders={stakeholders} isAdmin={canEdit} />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the full build, lint, and test suite**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`, and the route list includes `/raci`

  Run: `npm run lint`
  Expected: no errors

  Run: `npm test`
  Expected: all 83 tests passing (unchanged — no new tests this task)

- [ ] **Step 3: Commit**

  ```bash
  git add "app/(app)/raci/page.tsx"
  git commit -m "feat: add RACI page"
  ```

---

## Task 8: `components/pelaporan/DeleteReportingItemDialog.tsx`

**Files:**
- Create: `components/pelaporan/DeleteReportingItemDialog.tsx`

**Interfaces:**
- Consumes: `Button` (`components/ui/button.tsx`), `Dialog`/`DialogContent`/`DialogFooter`/
  `DialogHeader`/`DialogTitle`/`DialogTrigger` (`components/ui/dialog.tsx`), `toast` (`sonner`)
- Produces: `DeleteReportingItemDialog({ itemId, itemLabel, onDeleted }: { itemId: string;
  itemLabel: string; onDeleted: (id: string) => void })` — consumed by `PelaporanClient` (Task 10)

Structurally identical to `components/risks/DeleteRiskDialog.tsx`, targeting
`DELETE /api/reporting-items/[id]` (a hard delete — unlike stakeholders, `reporting_items` has no
`is_active` column).

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
    DialogTrigger,
  } from '@/components/ui/dialog'

  interface DeleteReportingItemDialogProps {
    itemId: string
    itemLabel: string
    onDeleted: (id: string) => void
  }

  export function DeleteReportingItemDialog({
    itemId,
    itemLabel,
    onDeleted,
  }: DeleteReportingItemDialogProps) {
    const [open, setOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    async function handleConfirm() {
      setSubmitting(true)
      setErrorMessage(null)
      try {
        const res = await fetch(`/api/reporting-items/${itemId}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message ?? 'Gagal menghapus item pelaporan')
          return
        }
        onDeleted(itemId)
        toast.success('Item pelaporan dihapus')
        setOpen(false)
      } catch {
        setErrorMessage('Gagal menghapus item pelaporan')
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
          <button type="button" className="text-gray-400 hover:text-red-600" title="Hapus item pelaporan">
            🗑️
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Item Pelaporan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Yakin ingin menghapus <span className="font-medium">{itemLabel}</span>?
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

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/pelaporan/DeleteReportingItemDialog.tsx
  git commit -m "feat: add DeleteReportingItemDialog component"
  ```

---

## Task 9: `components/pelaporan/ReportingItemFormModal.tsx`

**Files:**
- Create: `components/pelaporan/ReportingItemFormModal.tsx`

**Interfaces:**
- Consumes: `ReportingItem` (Task 1); `Button`, `Input`, `Label`, `Textarea`, `Dialog`/
  `DialogContent`/`DialogFooter`/`DialogHeader`/`DialogTitle` (`components/ui/*`); `toast` (`sonner`)
- Produces: `ReportingItemFormModal({ open, onOpenChange, item, nextDisplayOrder, onSaved }:
  ReportingItemFormModalProps)` — consumed by `PelaporanClient` (Task 10). `item: ReportingItem |
  null` — `null` means create mode, a value means edit mode.

Controlled dialog (no `DialogTrigger` — opened by the parent, same pattern as `RiskFormModal`),
one modal for create+edit. Unlike `RiskFormModal`, there's no null/undefined subtlety here:
`createReportingItemSchema`'s six text fields are all plain (non-nullable) strings, and
`updateReportingItemSchema` is just `createReportingItemSchema.partial()` — so both create and
edit send the same flat `form` object as the body, no per-mode field transformation needed.
`nextDisplayOrder` is only used in create mode (sent as an extra field alongside `form`).

- [ ] **Step 1: Create the component**

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
  import type { ReportingItem } from '@/lib/types'

  interface ReportingItemFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    item: ReportingItem | null
    nextDisplayOrder: number
    onSaved: (item: ReportingItem) => void
  }

  interface FormState {
    jenis_laporan: string
    dari_pic: string
    kepada: string
    frekuensi: string
    isi_konten: string
    format_media: string
  }

  function emptyForm(): FormState {
    return {
      jenis_laporan: '',
      dari_pic: '',
      kepada: '',
      frekuensi: '',
      isi_konten: '',
      format_media: '',
    }
  }

  function formFromItem(item: ReportingItem): FormState {
    return {
      jenis_laporan: item.jenis_laporan,
      dari_pic: item.dari_pic,
      kepada: item.kepada,
      frekuensi: item.frekuensi,
      isi_konten: item.isi_konten,
      format_media: item.format_media,
    }
  }

  export function ReportingItemFormModal({
    open,
    onOpenChange,
    item,
    nextDisplayOrder,
    onSaved,
  }: ReportingItemFormModalProps) {
    const isEdit = item !== null
    const [form, setForm] = useState<FormState>(() => (item ? formFromItem(item) : emptyForm()))
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
      if (open) setForm(item ? formFromItem(item) : emptyForm())
    }, [open, item])

    async function handleSubmit() {
      if (Object.values(form).some((v) => v.trim().length === 0)) {
        toast.error('Semua kolom wajib diisi')
        return
      }

      setSubmitting(true)
      try {
        const res =
          isEdit && item
            ? await fetch(`/api/reporting-items/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
              })
            : await fetch('/api/reporting-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, display_order: nextDisplayOrder }),
              })

        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menyimpan item pelaporan')
        }
        onSaved(json.data as ReportingItem)
        toast.success(isEdit ? 'Item pelaporan diperbarui' : 'Item pelaporan ditambahkan')
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan item pelaporan')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Item Pelaporan' : 'Tambah Item Pelaporan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Jenis Laporan</Label>
              <Input
                value={form.jenis_laporan}
                onChange={(e) => setForm((f) => ({ ...f, jenis_laporan: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Dari (PIC)</Label>
                <Input
                  value={form.dari_pic}
                  onChange={(e) => setForm((f) => ({ ...f, dari_pic: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Kepada</Label>
                <Input
                  value={form.kepada}
                  onChange={(e) => setForm((f) => ({ ...f, kepada: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Frekuensi</Label>
                <Input
                  value={form.frekuensi}
                  onChange={(e) => setForm((f) => ({ ...f, frekuensi: e.target.value }))}
                  placeholder="mis. Mingguan"
                />
              </div>
              <div className="space-y-1">
                <Label>Format/Media</Label>
                <Input
                  value={form.format_media}
                  onChange={(e) => setForm((f) => ({ ...f, format_media: e.target.value }))}
                  placeholder="mis. WhatsApp"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Isi Konten</Label>
              <Textarea
                value={form.isi_konten}
                onChange={(e) => setForm((f) => ({ ...f, isi_konten: e.target.value }))}
                rows={3}
              />
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

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/pelaporan/ReportingItemFormModal.tsx
  git commit -m "feat: add ReportingItemFormModal component"
  ```

---

## Task 10: `components/pelaporan/PelaporanClient.tsx`

**Files:**
- Create: `components/pelaporan/PelaporanClient.tsx`

**Interfaces:**
- Consumes: `ReportingItemFormModal` (Task 9), `DeleteReportingItemDialog` (Task 8),
  `ReportingItem` (Task 1); `Button`, `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/
  `TableRow` (`components/ui/*`)
- Produces: `PelaporanClient({ initialItems, isAdmin }: PelaporanClientProps)` — consumed by the
  page (Task 11).

Owns the items list and the add/edit modal's open/editing state — same shape as
`RiskRegisterClient` (Task 6 of the Week 9 plan), minus the filters and matrix (Pelaporan has
neither). New rows are appended at the end: `nextDisplayOrder = max(existing display_order) + 1`
(or `0` if the table is empty), computed here and passed down to `ReportingItemFormModal`.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { Button } from '@/components/ui/button'
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table'
  import { ReportingItemFormModal } from './ReportingItemFormModal'
  import { DeleteReportingItemDialog } from './DeleteReportingItemDialog'
  import type { ReportingItem } from '@/lib/types'

  interface PelaporanClientProps {
    initialItems: ReportingItem[]
    isAdmin: boolean
  }

  export function PelaporanClient({ initialItems, isAdmin }: PelaporanClientProps) {
    const [items, setItems] = useState<ReportingItem[]>(initialItems)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<ReportingItem | null>(null)

    function handleSaved(saved: ReportingItem) {
      setItems((prev) => {
        const exists = prev.some((i) => i.id === saved.id)
        return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]
      })
    }

    function handleDeleted(id: string) {
      setItems((prev) => prev.filter((i) => i.id !== id))
    }

    function openCreateModal() {
      setEditingItem(null)
      setModalOpen(true)
    }

    function openEditModal(item: ReportingItem) {
      setEditingItem(item)
      setModalOpen(true)
    }

    const nextDisplayOrder =
      items.length === 0 ? 0 : Math.max(...items.map((i) => i.display_order)) + 1

    return (
      <div className="space-y-6">
        {isAdmin && (
          <div className="flex justify-end">
            <Button onClick={openCreateModal}>+ Tambah Baris</Button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada rencana pelaporan.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jenis Laporan</TableHead>
                <TableHead>Dari</TableHead>
                <TableHead>Kepada</TableHead>
                <TableHead>Frekuensi</TableHead>
                <TableHead>Isi Konten</TableHead>
                <TableHead>Format/Media</TableHead>
                {isAdmin && <TableHead>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.jenis_laporan}</TableCell>
                  <TableCell>{item.dari_pic}</TableCell>
                  <TableCell>{item.kepada}</TableCell>
                  <TableCell>{item.frekuensi}</TableCell>
                  <TableCell className="max-w-md whitespace-pre-wrap text-gray-600">
                    {item.isi_konten}
                  </TableCell>
                  <TableCell>{item.format_media}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Edit item pelaporan"
                        >
                          ✏️
                        </button>
                        <DeleteReportingItemDialog
                          itemId={item.id}
                          itemLabel={item.jenis_laporan}
                          onDeleted={handleDeleted}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {isAdmin && (
          <ReportingItemFormModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            item={editingItem}
            nextDisplayOrder={nextDisplayOrder}
            onSaved={handleSaved}
          />
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
  git add components/pelaporan/PelaporanClient.tsx
  git commit -m "feat: add PelaporanClient composing table and add/edit modal"
  ```

---

## Task 11: `app/(app)/pelaporan/page.tsx` — New Page

**Files:**
- Create: `app/(app)/pelaporan/page.tsx`

**Interfaces:**
- Consumes: `getSession`, `isAdmin` (`lib/auth-helpers.ts`); `createClient`
  (`lib/supabase/server.ts`); `PelaporanClient` (Task 10); `ReportingItem` (Task 1)
- Produces: the route itself — `components/layout/Sidebar.tsx`'s existing `/pelaporan` link stops
  404ing

Flat query, no nested embed (`reporting_items` has no location/phase FK) — same shape as
`app/(app)/work-calendar/page.tsx` (Week 10), which is also a flat, non-nested, single-table fetch.

- [ ] **Step 1: Create the page**

  ```typescript
  import { createClient } from '@/lib/supabase/server'
  import { getSession, isAdmin } from '@/lib/auth-helpers'
  import { PelaporanClient } from '@/components/pelaporan/PelaporanClient'
  import type { ReportingItem } from '@/lib/types'

  export default async function PelaporanPage() {
    const supabase = createClient()
    const { profile } = await getSession()
    const canEdit = profile ? isAdmin(profile.role) : false

    const { data: itemRows } = await supabase
      .from('reporting_items')
      .select('id, display_order, jenis_laporan, dari_pic, kepada, frekuensi, isi_konten, format_media')
      .order('display_order')

    const items = (itemRows ?? []) as ReportingItem[]

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pelaporan</h1>
        <p className="text-gray-500 mt-1 mb-6">Rencana pelaporan: jenis, PIC, frekuensi, dan format</p>
        <PelaporanClient initialItems={items} isAdmin={canEdit} />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the full build, lint, and test suite**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`, and the route list includes `/pelaporan`

  Run: `npm run lint`
  Expected: no errors

  Run: `npm test`
  Expected: all 83 tests passing (unchanged — no new tests this task)

- [ ] **Step 3: Commit**

  ```bash
  git add "app/(app)/pelaporan/page.tsx"
  git commit -m "feat: add Pelaporan page"
  ```

---

## Task 12: Final Real-Browser E2E Pass and Progress Ledger

**Files:**
- Modify: `.superpowers/sdd/progress.md`

No code changes — this task verifies both pages end-to-end with a real headless browser (the
approach established since Week 5 — drive Playwright's `chromium` module directly via
`require('playwright')`/`chromium.launch()`; Chromium is already downloaded at
`%LOCALAPPDATA%\ms-playwright\chromium-1223`, `playwright` is already a dependency). This is the
pass that has caught real integration bugs in prior weeks (Week 6: missing `TooltipProvider`,
Radix Tooltip not anchoring to SVG; Week 10: a Sidebar regex bug and a cross-feature CPM bug) that
code review alone did not — do not substitute plain HTTP requests for this task.

- [ ] **Step 1: Prepare test data**

  As `superadmin@perumnas.co.id`, pick an existing location (or create a disposable one with all
  4 phases active). As admin, use "+ Tambah Stakeholder" on `/raci` to add at least 2 new
  stakeholders with distinct `group_name` values, alongside whatever stakeholders already exist
  from seed data.

- [ ] **Step 2: Real-browser pass — RACI**

  As admin, navigate to `/raci`. Confirm the location `<select>` defaults to the first active
  location and the matrix shows one row per fase (F1–F4) and one column per active stakeholder,
  with the legend and full stakeholder list rendered below. Click a cell's dropdown, set it to
  `R`, confirm a success toast, the cell shows "R", and re-fetching
  `GET /api/phases/{phaseId}/raci` (via `page.evaluate(fetch(...))` or a direct curl in a separate
  terminal) confirms the entry persisted. Set the same cell back to "–", confirm the entry is
  gone from that same GET. Switch the location `<select>` to a second location, confirm the
  matrix's rows swap to that location's fases with independent RACI values (no leakage between
  locations), and confirm this happens instantly with no network request (check the browser's
  network panel/`page.on('request')` shows nothing fired). Click a stakeholder column's ▲ button,
  confirm the column visibly moves left and a success toast appears (or none, per plan — no toast
  on success for reorder, only on failure); reload the page and confirm the new order persisted.
  Click a stakeholder's "×", confirm the confirmation dialog names it correctly, confirm, and
  confirm its column disappears from the matrix. Log out, log in as
  `viewer@perumnas.co.id`, navigate to `/raci`, confirm cells render as plain "R/A/C/I/–" text
  with no dropdowns, no ▲▼/× controls in the header, and no "+ Tambah Stakeholder" button.

- [ ] **Step 3: Real-browser pass — Pelaporan**

  As admin, navigate to `/pelaporan`. Confirm existing seeded rows (if any) render correctly in
  all 6 columns. Click "+ Tambah Baris", fill all 6 fields, save, confirm a success toast and the
  new row appears at the bottom of the table. Click that row's Edit pencil, confirm the modal
  opens pre-filled with the just-entered values, change the Isi Konten text, save, confirm the
  table cell updates. Click the row's Hapus (delete) icon, confirm the confirmation dialog names
  the correct jenis_laporan, confirm, and confirm the row disappears. Log out, log in as
  `viewer@perumnas.co.id`, navigate to `/pelaporan`, confirm the table renders with no Aksi column
  and no "+ Tambah Baris" button.

- [ ] **Step 4: Cross-role and console check**

  Confirm zero browser console errors across the whole run on both pages. Confirm the Sidebar's
  "RACI" and "Pelaporan" links are visible and navigate correctly for both admin and viewer.

- [ ] **Step 5: Clean up test data**

  Delete the disposable test rows added in Step 3 if any weren't already removed during the pass
  (confirm via `GET /api/reporting-items`). Deactivate the test stakeholders added in Step 1 via
  their "×" delete control if not already done during Step 2's reorder/delete testing (confirm via
  `GET /api/stakeholders` no longer lists them). Deactivate any disposable test location created
  for Step 1 (`DELETE /api/locations/{id}` as `superadmin@perumnas.co.id`, same precedent as every
  prior week).

- [ ] **Step 6: Record the ledger entry**

  Append to `.superpowers/sdd/progress.md`:
  ```markdown

  ## Week 11
  # Plan: docs/superpowers/plans/2026-07-05-minggu11-raci-pelaporan.md
  # Spec: docs/superpowers/specs/2026-07-05-minggu11-raci-pelaporan-design.md
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
  - Task 12: [fill in E2E findings — do not leave this as a template]
  - Week 11 RACI & Pelaporan COMPLETE (fill in date)
  ```

  ```bash
  git add .superpowers/sdd/progress.md
  git commit -m "chore: record Week 11 Task 12 E2E pass in SDD progress ledger"
  ```
