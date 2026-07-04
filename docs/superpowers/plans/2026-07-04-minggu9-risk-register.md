# Minggu 9: Risk Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Risk Register page at `/dashboard/[locationCode]/risks` — a table of risks
across all 4 phases with inline probability/impact editing, a full add/edit modal, delete
confirmation, Fase/Status/Kategori filters, and a click-to-filter Risk Matrix 5×5 heatmap.

**Architecture:** The backend already exists and is untouched this week — `risk_items` table + RLS
(Week 1/2 migrations), `GET/POST /api/phases/[id]/risks`, `PATCH/DELETE /api/risks/[id]`
(Week 2). This is a pure UI week: one small pure-logic module (`lib/risk-utils.ts`, Vitest-tested)
computes the score-band/color used by both the matrix cells and the table's Skor column; a new
`components/risks/` directory holds the presentational/interactive pieces; one new server-component
page fetches phases with a nested `risk_items` embed (same query shape as the Week 8 dashboard page)
and passes plain data down to a client component that owns all filter/modal state.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase JS v2 · shadcn/ui (`Select`, `Dialog`,
`Table`, `Badge`, `Textarea` — all already installed, no new shadcn components needed) · sonner
(toasts)

## Global Constraints

- `npm run build` must pass before every commit; `npm test` must keep passing (62 existing tests
  from Week 8 plus this week's new `lib/risk-utils.test.ts` cases)
- TypeScript strict — no implicit `any`
- No semicolons, single quotes — match this project's existing style exactly
- No API routes, validation schemas, RLS policies, or migrations change this week — `risk_items`,
  its RLS, and both API routes have been fully working and unused since Week 2
- API response shape is always `{ data: T | null, error: { code, message } | null }` — every
  fetch call in this plan follows the same `if (!res.ok || json.error) throw ...` pattern already
  used in `components/kk-consent/KkConsentForm.tsx` and `components/activities/DependencyPanel.tsx`
- Role gating follows the established per-page convention (`KkConsentForm.tsx`,
  `ActivityRow.tsx`): admin-only **action** buttons/dialogs (Edit pencil, Delete trash icon, "+
  Tambah Risiko") are omitted entirely for non-admins; admin-only **inline edit controls inside an
  always-visible row** (Probabilitas/Dampak `Select`s) render as plain text for non-admins instead
  of a control
- Every git commit message follows the existing convention: `feat:`/`fix:`/`chore:` prefix, one line
- Spec: `docs/superpowers/specs/2026-07-04-minggu9-risk-register-design.md`

---

## Task 1: `lib/risk-utils.ts` — Score Band Helper, and Risk Types

**Files:**
- Create: `lib/risk-utils.ts`
- Create: `lib/risk-utils.test.ts`
- Modify: `lib/types.ts` (append new section at end of file)

**Interfaces:**
- Consumes: nothing new
- Produces: `getScoreBand(score: number): 'low' | 'medium' | 'high'`,
  `getScoreBandClasses(score: number): string` — consumed by `RiskMatrix` (Task 4) and `RiskTable`
  (Task 5). `RiskCategory`, `RiskStatus`, `RiskItem`, `RiskWithPhase`, `RiskPhaseOption` types from
  `lib/types.ts` — consumed by every task from Task 2 onward.

- [ ] **Step 1: Write the failing tests**

  Create `lib/risk-utils.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import { getScoreBand } from './risk-utils'

  describe('getScoreBand', () => {
    it('returns low at the bottom of the range (score 1)', () => {
      expect(getScoreBand(1)).toBe('low')
    })

    it('returns low at the low/medium boundary (score 6)', () => {
      expect(getScoreBand(6)).toBe('low')
    })

    it('returns medium just above the low/medium boundary (score 7)', () => {
      expect(getScoreBand(7)).toBe('medium')
    })

    it('returns medium at the medium/high boundary (score 12)', () => {
      expect(getScoreBand(12)).toBe('medium')
    })

    it('returns high just above the medium/high boundary (score 13)', () => {
      expect(getScoreBand(13)).toBe('high')
    })

    it('returns high at the top of the range (score 25)', () => {
      expect(getScoreBand(25)).toBe('high')
    })
  })
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npm test -- risk-utils`
  Expected: FAIL — `Cannot find module './risk-utils'` (file doesn't exist yet)

- [ ] **Step 3: Write `lib/risk-utils.ts`**

  ```typescript
  export type ScoreBand = 'low' | 'medium' | 'high'

  export function getScoreBand(score: number): ScoreBand {
    if (score <= 6) return 'low'
    if (score <= 12) return 'medium'
    return 'high'
  }

  export function getScoreBandClasses(score: number): string {
    const band = getScoreBand(score)
    if (band === 'low') return 'bg-green-50 text-green-600 border-green-200'
    if (band === 'medium') return 'bg-amber-50 text-amber-600 border-amber-200'
    return 'bg-red-50 text-red-600 border-red-200'
  }
  ```

- [ ] **Step 4: Run the test to verify it passes**

  Run: `npm test -- risk-utils`
  Expected: PASS — 6/6 tests passing

- [ ] **Step 5: Append risk types to `lib/types.ts`**

  Add at the end of `lib/types.ts` (after the existing `KkConsent` interface):
  ```typescript

  export type RiskCategory = 'teknis' | 'hukum' | 'keuangan' | 'sosial' | 'lingkungan' | 'lainnya'
  export type RiskStatus = 'open' | 'mitigated' | 'closed'

  export interface RiskItem {
    id: string
    phase_id: string
    title: string
    description: string | null
    category: RiskCategory
    probability: number
    impact: number
    score: number
    mitigation: string | null
    owner: string | null
    status: RiskStatus
    display_order: number
    created_at: string
    updated_at: string
  }

  export interface RiskWithPhase extends RiskItem {
    phaseCode: string
  }

  export interface RiskPhaseOption {
    id: string
    phase_code: string
    name: string
  }
  ```

- [ ] **Step 6: Run the full test suite and build**

  Run: `npm test`
  Expected: all tests passing (62 existing + 6 new = 68)

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 7: Commit**

  ```bash
  git add lib/risk-utils.ts lib/risk-utils.test.ts lib/types.ts
  git commit -m "feat: add risk score-band utility and risk types"
  ```

---

## Task 2: `components/risks/DeleteRiskDialog.tsx`

**Files:**
- Create: `components/risks/DeleteRiskDialog.tsx`

**Interfaces:**
- Consumes: `Button` (`components/ui/button.tsx`), `Dialog`/`DialogContent`/`DialogFooter`/
  `DialogHeader`/`DialogTitle`/`DialogTrigger` (`components/ui/dialog.tsx`), `toast` (`sonner`)
- Produces: `DeleteRiskDialog({ riskId, riskTitle, onDeleted }: { riskId: string; riskTitle:
  string; onDeleted: (id: string) => void })` — consumed by `RiskTable` (Task 5)

This component is structurally identical to the existing
`components/activities/DeleteActivityDialog.tsx`, targeting `DELETE /api/risks/[id]` instead of
`DELETE /api/activities/[id]`.

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

  interface DeleteRiskDialogProps {
    riskId: string
    riskTitle: string
    onDeleted: (id: string) => void
  }

  export function DeleteRiskDialog({ riskId, riskTitle, onDeleted }: DeleteRiskDialogProps) {
    const [open, setOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    async function handleConfirm() {
      setSubmitting(true)
      setErrorMessage(null)
      try {
        const res = await fetch(`/api/risks/${riskId}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message ?? 'Gagal menghapus risiko')
          return
        }
        onDeleted(riskId)
        toast.success('Risiko dihapus')
        setOpen(false)
      } catch {
        setErrorMessage('Gagal menghapus risiko')
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
          <button type="button" className="text-gray-400 hover:text-red-600" title="Hapus risiko">
            🗑️
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Risiko</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Yakin ingin menghapus <span className="font-medium">{riskTitle}</span>?
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
  Expected: `✓ Compiled successfully` (this component isn't imported anywhere yet, so this only
  checks it's syntactically and structurally valid TypeScript/JSX)

- [ ] **Step 3: Commit**

  ```bash
  git add components/risks/DeleteRiskDialog.tsx
  git commit -m "feat: add DeleteRiskDialog component"
  ```

---

## Task 3: `components/risks/RiskFormModal.tsx`

**Files:**
- Create: `components/risks/RiskFormModal.tsx`

**Interfaces:**
- Consumes: `RiskCategory`, `RiskStatus`, `RiskWithPhase`, `RiskPhaseOption` (Task 1);
  `Button`, `Input`, `Label`, `Textarea`, `Dialog`/`DialogContent`/`DialogFooter`/`DialogHeader`/
  `DialogTitle`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`
  (all `components/ui/*`); `toast` (`sonner`)
- Produces: `RiskFormModal({ open, onOpenChange, phases, risk, onSaved }: RiskFormModalProps)` —
  consumed by `RiskRegisterClient` (Task 6). `risk: RiskWithPhase | null` — `null` means create
  mode, a value means edit mode. `onSaved: (risk: RiskWithPhase, phaseId: string) => void`.

This is a controlled dialog (no `DialogTrigger` — the parent opens/closes it via the `open` prop,
since it's triggered both by a "+ Tambah Risiko" button and by a row-level Edit pencil icon).

For create, `POST /api/phases/[phaseId]/risks` uses `createRiskSchema` (`lib/validations.ts`),
where `description`/`mitigation`/`owner` are plain `.optional()` (no `.nullable()`) — so empty
strings must be converted to `undefined` before sending, or the API would store an empty string
instead of leaving the column at its `NULL` default.

For edit, `PATCH /api/risks/[id]` uses `updateRiskSchema`, where those same three fields are
`.nullable().optional()` — so an emptied field must be sent as explicit `null` to actually clear a
previously-set value, not `undefined` (which the API would treat as "don't touch this field").

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
  import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  } from '@/components/ui/select'
  import type { RiskCategory, RiskStatus, RiskWithPhase, RiskPhaseOption } from '@/lib/types'

  const CATEGORIES: Array<{ value: RiskCategory; label: string }> = [
    { value: 'teknis', label: 'Teknis' },
    { value: 'hukum', label: 'Hukum' },
    { value: 'keuangan', label: 'Keuangan' },
    { value: 'sosial', label: 'Sosial' },
    { value: 'lingkungan', label: 'Lingkungan' },
    { value: 'lainnya', label: 'Lainnya' },
  ]

  const STATUSES: Array<{ value: RiskStatus; label: string }> = [
    { value: 'open', label: 'Open' },
    { value: 'mitigated', label: 'Mitigated' },
    { value: 'closed', label: 'Closed' },
  ]

  const LEVELS = [1, 2, 3, 4, 5]

  interface RiskFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    phases: RiskPhaseOption[]
    risk: RiskWithPhase | null
    onSaved: (risk: RiskWithPhase, phaseId: string) => void
  }

  interface FormState {
    phaseId: string
    title: string
    description: string
    category: RiskCategory
    probability: number
    impact: number
    mitigation: string
    owner: string
    status: RiskStatus
  }

  function emptyForm(defaultPhaseId: string): FormState {
    return {
      phaseId: defaultPhaseId,
      title: '',
      description: '',
      category: 'teknis',
      probability: 1,
      impact: 1,
      mitigation: '',
      owner: '',
      status: 'open',
    }
  }

  function formFromRisk(risk: RiskWithPhase): FormState {
    return {
      phaseId: risk.phase_id,
      title: risk.title,
      description: risk.description ?? '',
      category: risk.category,
      probability: risk.probability,
      impact: risk.impact,
      mitigation: risk.mitigation ?? '',
      owner: risk.owner ?? '',
      status: risk.status,
    }
  }

  export function RiskFormModal({ open, onOpenChange, phases, risk, onSaved }: RiskFormModalProps) {
    const isEdit = risk !== null
    const [form, setForm] = useState<FormState>(() =>
      risk ? formFromRisk(risk) : emptyForm(phases[0]?.id ?? '')
    )
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
      if (open) {
        setForm(risk ? formFromRisk(risk) : emptyForm(phases[0]?.id ?? ''))
      }
    }, [open, risk, phases])

    async function handleSubmit() {
      if (form.title.trim().length < 2) {
        toast.error('Judul risiko minimal 2 karakter')
        return
      }
      if (!form.phaseId) {
        toast.error('Pilih fase terlebih dahulu')
        return
      }

      setSubmitting(true)
      try {
        const body = isEdit
          ? {
              title: form.title,
              description: form.description || null,
              category: form.category,
              probability: form.probability,
              impact: form.impact,
              mitigation: form.mitigation || null,
              owner: form.owner || null,
              status: form.status,
            }
          : {
              title: form.title,
              description: form.description || undefined,
              category: form.category,
              probability: form.probability,
              impact: form.impact,
              mitigation: form.mitigation || undefined,
              owner: form.owner || undefined,
              status: form.status,
            }

        const res =
          isEdit && risk
            ? await fetch(`/api/risks/${risk.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              })
            : await fetch(`/api/phases/${form.phaseId}/risks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              })

        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menyimpan risiko')
        }

        const phaseCode = phases.find((p) => p.id === form.phaseId)?.phase_code ?? ''
        onSaved({ ...json.data, phaseCode }, form.phaseId)
        toast.success(isEdit ? 'Risiko diperbarui' : 'Risiko ditambahkan')
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan risiko')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Risiko' : 'Tambah Risiko'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!isEdit && (
              <div className="space-y-1">
                <Label>Fase</Label>
                <Select
                  value={form.phaseId}
                  onValueChange={(v) => setForm((f) => ({ ...f, phaseId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih fase" />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map((phase) => (
                      <SelectItem key={phase.id} value={phase.id}>
                        {phase.phase_code} — {phase.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Judul</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Kategori</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v as RiskCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Probabilitas</Label>
                <Select
                  value={String(form.probability)}
                  onValueChange={(v) => setForm((f) => ({ ...f, probability: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={String(level)}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Dampak</Label>
                <Select
                  value={String(form.impact)}
                  onValueChange={(v) => setForm((f) => ({ ...f, impact: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={String(level)}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Mitigasi</Label>
              <Textarea
                value={form.mitigation}
                onChange={(e) => setForm((f) => ({ ...f, mitigation: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Owner</Label>
                <Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
              </div>
              {isEdit && (
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v as RiskStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
  git add components/risks/RiskFormModal.tsx
  git commit -m "feat: add RiskFormModal component"
  ```

---

## Task 4: `components/risks/RiskMatrix.tsx`

**Files:**
- Create: `components/risks/RiskMatrix.tsx`

**Interfaces:**
- Consumes: `getScoreBandClasses` (Task 1, `lib/risk-utils.ts`), `cn` (`lib/utils.ts`)
- Produces: `RiskMatrix({ risks, activeCell, onCellClick }: RiskMatrixProps)` — consumed by
  `RiskRegisterClient` (Task 6). `risks: Array<{ probability: number; impact: number }>`,
  `activeCell: { probability: number; impact: number } | null`,
  `onCellClick: (probability: number, impact: number) => void`.

Rows are probability 1–5 (rendered top-to-bottom as 5→1, so higher-probability risks read at the
top), columns are impact 1–5 (left-to-right). Each cell shows the count of risks with that exact
`(probability, impact)` pair (from the already-Fase/Status/Kategori-filtered `risks` prop — the
matrix's own click-filter is applied by the parent to the *table*, not back onto the matrix's own
counts) and is colored by `getScoreBandClasses(probability * impact)`. Clicking a cell always
calls `onCellClick` — toggling logic (click active cell again → clear) lives in the parent
(`RiskRegisterClient`, Task 6), not here.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { cn } from '@/lib/utils'
  import { getScoreBandClasses } from '@/lib/risk-utils'

  interface RiskMatrixProps {
    risks: Array<{ probability: number; impact: number }>
    activeCell: { probability: number; impact: number } | null
    onCellClick: (probability: number, impact: number) => void
  }

  const LEVELS = [1, 2, 3, 4, 5]

  export function RiskMatrix({ risks, activeCell, onCellClick }: RiskMatrixProps) {
    function countFor(probability: number, impact: number): number {
      return risks.filter((r) => r.probability === probability && r.impact === impact).length
    }

    return (
      <div>
        <p className="text-xs text-gray-500 mb-2">
          Baris = Probabilitas, Kolom = Dampak. Klik sel untuk memfilter tabel.
        </p>
        <div className="inline-block">
          <div className="flex gap-1 mb-1 ml-8">
            {LEVELS.map((impact) => (
              <div key={impact} className="w-14 text-center text-xs font-medium text-gray-400">
                D{impact}
              </div>
            ))}
          </div>
          {[...LEVELS].reverse().map((probability) => (
            <div key={probability} className="flex items-center gap-1 mb-1">
              <div className="w-8 text-center text-xs font-medium text-gray-400">P{probability}</div>
              {LEVELS.map((impact) => {
                const score = probability * impact
                const count = countFor(probability, impact)
                const isActive =
                  activeCell?.probability === probability && activeCell?.impact === impact
                return (
                  <button
                    key={impact}
                    type="button"
                    onClick={() => onCellClick(probability, impact)}
                    className={cn(
                      'w-14 h-10 flex items-center justify-center text-sm font-semibold rounded-md border transition-colors',
                      getScoreBandClasses(score),
                      isActive && 'ring-2 ring-blue-600 ring-offset-1'
                    )}
                    title={`Probabilitas ${probability} × Dampak ${impact} = Skor ${score}`}
                  >
                    {count > 0 ? count : ''}
                  </button>
                )
              })}
            </div>
          ))}
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
  git add components/risks/RiskMatrix.tsx
  git commit -m "feat: add RiskMatrix 5x5 heatmap component"
  ```

---

## Task 5: `components/risks/RiskTable.tsx`

**Files:**
- Create: `components/risks/RiskTable.tsx`

**Interfaces:**
- Consumes: `getScoreBandClasses` (Task 1), `cn` (`lib/utils.ts`), `DeleteRiskDialog` (Task 2),
  `RiskWithPhase` (Task 1), `Badge`, `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/
  `TableRow`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` (`components/ui/*`)
- Produces: `RiskTable({ risks, isAdmin, onUpdated, onDeleted, onEditRequested }: RiskTableProps)`
  — consumed by `RiskRegisterClient` (Task 6). `onUpdated: (risk: RiskWithPhase) => void`,
  `onDeleted: (id: string) => void`, `onEditRequested: (risk: RiskWithPhase) => void`.

Admins see inline `Select` controls for Probabilitas/Dampak that fire an immediate
`PATCH /api/risks/[id]` on change (no debounce — a discrete selection, not free text, matching how
`DependencyPanel.tsx` fires its mutations immediately rather than debouncing). Viewers see plain
numbers. The Skor cell and its color are derived, not stored input.

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { toast } from 'sonner'
  import { Badge } from '@/components/ui/badge'
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table'
  import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  } from '@/components/ui/select'
  import { DeleteRiskDialog } from './DeleteRiskDialog'
  import { getScoreBandClasses } from '@/lib/risk-utils'
  import { cn } from '@/lib/utils'
  import type { RiskWithPhase } from '@/lib/types'

  const CATEGORY_LABELS: Record<RiskWithPhase['category'], string> = {
    teknis: 'Teknis',
    hukum: 'Hukum',
    keuangan: 'Keuangan',
    sosial: 'Sosial',
    lingkungan: 'Lingkungan',
    lainnya: 'Lainnya',
  }

  const STATUS_LABELS: Record<RiskWithPhase['status'], string> = {
    open: 'Open',
    mitigated: 'Mitigated',
    closed: 'Closed',
  }

  const LEVELS = [1, 2, 3, 4, 5]

  interface RiskTableProps {
    risks: RiskWithPhase[]
    isAdmin: boolean
    onUpdated: (risk: RiskWithPhase) => void
    onDeleted: (id: string) => void
    onEditRequested: (risk: RiskWithPhase) => void
  }

  export function RiskTable({ risks, isAdmin, onUpdated, onDeleted, onEditRequested }: RiskTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [savingId, setSavingId] = useState<string | null>(null)

    async function handleFieldChange(
      risk: RiskWithPhase,
      changes: { probability?: number; impact?: number }
    ) {
      setSavingId(risk.id)
      try {
        const res = await fetch(`/api/risks/${risk.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menyimpan perubahan')
        }
        onUpdated({ ...risk, ...json.data })
        toast.success('Risiko diperbarui')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan perubahan')
      } finally {
        setSavingId(null)
      }
    }

    if (risks.length === 0) {
      return <p className="text-sm text-gray-500">Tidak ada risiko.</p>
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Risiko</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Fase</TableHead>
            <TableHead>Probabilitas</TableHead>
            <TableHead>Dampak</TableHead>
            <TableHead>Skor</TableHead>
            <TableHead>Mitigasi</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
            {isAdmin && <TableHead>Aksi</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {risks.map((risk, index) => {
            const isExpanded = expandedId === risk.id
            return (
              <TableRow key={risk.id}>
                <TableCell className="text-gray-400">{index + 1}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : risk.id)}
                    className="text-left font-medium text-gray-900 hover:text-blue-700"
                  >
                    {risk.title}
                  </button>
                  {isExpanded && risk.description && (
                    <p className="text-xs text-gray-500 mt-1">{risk.description}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{CATEGORY_LABELS[risk.category]}</Badge>
                </TableCell>
                <TableCell className="text-xs text-gray-500">{risk.phaseCode}</TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Select
                      value={String(risk.probability)}
                      onValueChange={(v) => handleFieldChange(risk, { probability: Number(v) })}
                      disabled={savingId === risk.id}
                    >
                      <SelectTrigger className="w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((level) => (
                          <SelectItem key={level} value={String(level)}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    risk.probability
                  )}
                </TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Select
                      value={String(risk.impact)}
                      onValueChange={(v) => handleFieldChange(risk, { impact: Number(v) })}
                      disabled={savingId === risk.id}
                    >
                      <SelectTrigger className="w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((level) => (
                          <SelectItem key={level} value={String(level)}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    risk.impact
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-8 h-8 rounded-md border text-sm font-semibold',
                      getScoreBandClasses(risk.score)
                    )}
                  >
                    {risk.score}
                  </span>
                </TableCell>
                <TableCell className="text-gray-500 max-w-xs truncate">
                  {risk.mitigation ?? '–'}
                </TableCell>
                <TableCell className="text-gray-500">{risk.owner ?? '–'}</TableCell>
                <TableCell>
                  <Badge variant={risk.status === 'closed' ? 'secondary' : 'outline'}>
                    {STATUS_LABELS[risk.status]}
                  </Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEditRequested(risk)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Edit risiko"
                      >
                        ✏️
                      </button>
                      <DeleteRiskDialog riskId={risk.id} riskTitle={risk.title} onDeleted={onDeleted} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

  ```bash
  git add components/risks/RiskTable.tsx
  git commit -m "feat: add RiskTable component"
  ```

---

## Task 6: `components/risks/RiskRegisterClient.tsx`

**Files:**
- Create: `components/risks/RiskRegisterClient.tsx`

**Interfaces:**
- Consumes: `RiskMatrix` (Task 4), `RiskTable` (Task 5), `RiskFormModal` (Task 3), `RiskWithPhase`/
  `RiskCategory`/`RiskStatus`/`RiskPhaseOption` (Task 1), `Button`, `Select`/`SelectTrigger`/
  `SelectValue`/`SelectContent`/`SelectItem` (`components/ui/*`)
- Produces: `RiskRegisterClient({ initialRisks, phases, isAdmin }: RiskRegisterClientProps)` —
  consumed by the page (Task 7). `initialRisks: RiskWithPhase[]`, `phases: RiskPhaseOption[]`,
  `isAdmin: boolean`.

Owns all client-side state: the three filter dropdowns, the matrix's click-filter, and the
add/edit modal's open/editing state. Filtering is layered: `baseFiltered` applies Fase/Status/
Kategori (this is what the matrix counts against); `tableFiltered` additionally applies the
matrix's own click-filter (this is what the table renders).

- [ ] **Step 1: Create the component**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { Button } from '@/components/ui/button'
  import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  } from '@/components/ui/select'
  import { RiskMatrix } from './RiskMatrix'
  import { RiskTable } from './RiskTable'
  import { RiskFormModal } from './RiskFormModal'
  import type { RiskWithPhase, RiskCategory, RiskStatus, RiskPhaseOption } from '@/lib/types'

  const CATEGORY_OPTIONS: Array<{ value: RiskCategory; label: string }> = [
    { value: 'teknis', label: 'Teknis' },
    { value: 'hukum', label: 'Hukum' },
    { value: 'keuangan', label: 'Keuangan' },
    { value: 'sosial', label: 'Sosial' },
    { value: 'lingkungan', label: 'Lingkungan' },
    { value: 'lainnya', label: 'Lainnya' },
  ]

  const STATUS_OPTIONS: Array<{ value: RiskStatus; label: string }> = [
    { value: 'open', label: 'Open' },
    { value: 'mitigated', label: 'Mitigated' },
    { value: 'closed', label: 'Closed' },
  ]

  interface RiskRegisterClientProps {
    initialRisks: RiskWithPhase[]
    phases: RiskPhaseOption[]
    isAdmin: boolean
  }

  export function RiskRegisterClient({ initialRisks, phases, isAdmin }: RiskRegisterClientProps) {
    const [risks, setRisks] = useState<RiskWithPhase[]>(initialRisks)
    const [faseFilter, setFaseFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [matrixFilter, setMatrixFilter] = useState<{ probability: number; impact: number } | null>(
      null
    )
    const [modalOpen, setModalOpen] = useState(false)
    const [editingRisk, setEditingRisk] = useState<RiskWithPhase | null>(null)

    const baseFiltered = risks.filter((r) => {
      if (faseFilter !== 'all' && r.phaseCode !== faseFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      return true
    })

    const tableFiltered = baseFiltered.filter((r) => {
      if (!matrixFilter) return true
      return r.probability === matrixFilter.probability && r.impact === matrixFilter.impact
    })

    function handleCellClick(probability: number, impact: number) {
      setMatrixFilter((prev) =>
        prev && prev.probability === probability && prev.impact === impact
          ? null
          : { probability, impact }
      )
    }

    function handleUpdated(updated: RiskWithPhase) {
      setRisks((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
    }

    function handleDeleted(id: string) {
      setRisks((prev) => prev.filter((r) => r.id !== id))
    }

    function handleSaved(saved: RiskWithPhase) {
      setRisks((prev) => {
        const exists = prev.some((r) => r.id === saved.id)
        return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved]
      })
    }

    function openCreateModal() {
      setEditingRisk(null)
      setModalOpen(true)
    }

    function openEditModal(risk: RiskWithPhase) {
      setEditingRisk(risk)
      setModalOpen(true)
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Fase</label>
              <Select value={faseFilter} onValueChange={setFaseFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Fase</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.phase_code}>
                      {phase.phase_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Kategori</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isAdmin && <Button onClick={openCreateModal}>+ Tambah Risiko</Button>}
        </div>

        <RiskMatrix risks={baseFiltered} activeCell={matrixFilter} onCellClick={handleCellClick} />

        <RiskTable
          risks={tableFiltered}
          isAdmin={isAdmin}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onEditRequested={openEditModal}
        />

        {isAdmin && (
          <RiskFormModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            phases={phases}
            risk={editingRisk}
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
  git add components/risks/RiskRegisterClient.tsx
  git commit -m "feat: add RiskRegisterClient composing filters, matrix, table, and modal"
  ```

---

## Task 7: `app/(app)/dashboard/[locationCode]/risks/page.tsx` — New Page

**Files:**
- Create: `app/(app)/dashboard/[locationCode]/risks/page.tsx`

**Interfaces:**
- Consumes: `getSession`, `isAdmin` (`lib/auth-helpers.ts`); `createClient`
  (`lib/supabase/server.ts`); `RiskRegisterClient` (Task 6); `RiskItem`, `RiskWithPhase`,
  `RiskPhaseOption` (Task 1)
- Produces: the route itself — `components/layout/Sidebar.tsx`'s existing
  `/dashboard/{code}/risks` link (already present since Week 1) stops 404ing

Same query shape as `app/(app)/dashboard/[locationCode]/page.tsx` (Week 8): one Supabase query on
`phases` with a nested embed, this time `risk_items ( * )` instead of `activities (...)`. Risks are
sorted by `display_order` client-side within each phase before flattening (the query itself doesn't
need a nested `.order()` — matching the existing precedent that dashboard pages don't bother
ordering nested embeds when the page immediately re-sorts or doesn't care).

- [ ] **Step 1: Create the page**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { getSession, isAdmin } from '@/lib/auth-helpers'
  import { RiskRegisterClient } from '@/components/risks/RiskRegisterClient'
  import type { RiskItem, RiskWithPhase, RiskPhaseOption } from '@/lib/types'

  export default async function RiskRegisterPage({
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

    const { data: phaseRows } = await supabase
      .from('phases')
      .select(`id, phase_code, name, risk_items ( * )`)
      .eq('location_id', location.id)
      .order('display_order')

    const phases = (phaseRows ?? []) as Array<{
      id: string
      phase_code: string
      name: string
      risk_items: RiskItem[]
    }>

    const phaseOptions: RiskPhaseOption[] = phases.map((p) => ({
      id: p.id,
      phase_code: p.phase_code,
      name: p.name,
    }))

    const risks: RiskWithPhase[] = phases.flatMap((phase) =>
      phase.risk_items
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((risk) => ({ ...risk, phaseCode: phase.phase_code }))
    )

    return <RiskRegisterClient initialRisks={risks} phases={phaseOptions} isAdmin={canEdit} />
  }
  ```

- [ ] **Step 2: Verify the full build, lint, and test suite**

  Run: `npm run build`
  Expected: `✓ Compiled successfully`, and the route list includes
  `/dashboard/[locationCode]/risks`

  Run: `npm run lint`
  Expected: no errors

  Run: `npm test`
  Expected: all 68 tests passing (unchanged from Task 1 — no new tests this task)

- [ ] **Step 3: Commit**

  ```bash
  git add "app/(app)/dashboard/[locationCode]/risks/page.tsx"
  git commit -m "feat: add Risk Register page"
  ```

---

## Task 8: Final Real-Browser E2E Pass and Progress Ledger

**Files:**
- Modify: `.superpowers/sdd/progress.md`

No code changes — this task verifies the full feature end-to-end with a real headless browser
(the approach established in Weeks 5-8 — drive Playwright's `chromium` module directly via
`require('playwright')`/`chromium.launch()`, since `chromium-cli` isn't available in this
environment; Chromium is already downloaded at `%LOCALAPPDATA%\ms-playwright\chromium-1223`, and
`playwright` is already an installed dependency in `package.json`). This is the pass that actually
clicks through the UI — do not substitute plain HTTP requests for this task.

- [ ] **Step 1: Prepare test data**

  Using an existing or new disposable test location with all 4 phases: as admin, use
  "+ Tambah Risiko" to create at least 6 risks spread across at least 2 different phases and at
  least 2 different categories, with probability/impact combinations that land in all three score
  bands (e.g. (1,2)→low, (3,4)→medium, (5,5)→high), and at least one risk in each of the three
  statuses (open/mitigated/closed — set via the edit modal after creation, since create always
  starts at `open`).

- [ ] **Step 2: Real-browser pass**

  Write a throwaway Playwright script (Node, using the `chromium` module directly) to, as admin:
  - Navigate to `/dashboard/{code}/risks`. Confirm the page renders inside the existing `PhaseTabs`
    bar (same location layout as `kk-consent`). Confirm the table shows all created risks with
    correct Kategori badge, Fase, Skor value and color, and Status badge. Screenshot.
  - Confirm the Risk Matrix shows a nonzero count in the cells matching each created risk's exact
    (probability, impact), colored according to score band (green/amber/red), and zero/blank in
    every other cell.
  - Click a matrix cell with a known count > 0. Confirm the table below now shows only that exact
    probability×impact combination, and the cell shows an active-ring highlight. Click the same
    cell again. Confirm the table returns to showing all (Fase/Status/Kategori-filtered) risks and
    the ring disappears.
  - Use the Fase filter to narrow to one phase. Confirm both the table and the matrix's counts
    update to reflect only that phase's risks. Reset to "Semua Fase".
  - Change a risk's Probabilitas via its inline `Select`. Confirm a success toast appears, the
    Skor cell updates its number and color immediately, and the matrix's cell counts shift
    accordingly after a reload.
  - Click a risk's Edit pencil. Confirm the modal opens pre-filled with that risk's current values
    (Fase selector absent in edit mode), with Status now editable. Change the Mitigasi text and
    Status, save, confirm a success toast and the table row reflects both changes.
  - Click a risk's Hapus (delete) icon. Confirm the confirmation dialog names the correct risk,
    confirm, and verify the row disappears from the table and the matrix's corresponding cell
    count decrements.
  - Log out, log in as Viewer. Confirm `/dashboard/{code}/risks` shows the same table and matrix
    with no `Select` controls for Probabilitas/Dampak (plain numbers instead), no Aksi column, and
    no "+ Tambah Risiko" button. Confirm clicking a matrix cell still filters the table (read-only
    interaction, not gated by role).
  - Confirm zero browser console errors across the whole run.

- [ ] **Step 3: Clean up test data**

  Deactivate any disposable test location created for this pass (`DELETE
  /api/locations/{id}` as a `super_admin` account, per the established precedent from Weeks 5-8),
  or delete the individual test risks via the UI's own delete flow if an existing shared location
  was used instead.

- [ ] **Step 4: Record the ledger entry**

  Append to `.superpowers/sdd/progress.md`:
  ```markdown

  ## Week 9
  # Plan: docs/superpowers/plans/2026-07-04-minggu9-risk-register.md
  # Spec: docs/superpowers/specs/2026-07-04-minggu9-risk-register-design.md
  - Task 1: [fill in commit + review outcome]
  - Task 2: [fill in commit + review outcome]
  - Task 3: [fill in commit + review outcome]
  - Task 4: [fill in commit + review outcome]
  - Task 5: [fill in commit + review outcome]
  - Task 6: [fill in commit + review outcome]
  - Task 7: [fill in commit + review outcome]
  - Task 8: [fill in E2E findings]
  - Week 9 Risk Register COMPLETE (fill in date)
  ```

  ```bash
  git add .superpowers/sdd/progress.md
  git commit -m "chore: record Week 9 Task 8 E2E pass in SDD progress ledger"
  ```
