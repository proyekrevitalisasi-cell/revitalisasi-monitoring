# Minggu 9 — Risk Register: Design

**Status:** Approved
**Date:** 2026-07-04

## Context

Weeks 1–8 delivered Fondasi, Data Layer, Fase CRUD, CPM Engine, Dependensi UI, Gantt 3 Lapis, Baseline & Kritis, dan Dashboard. Per `PRD_Dashboard_Revitalisasi_Perumnas_v2.md` §16 (Estimasi Milestone), Minggu 9 = **Risk Register**: Tabel risiko CRUD, Risk Matrix 5×5, filter.

The backend for this feature already exists from Week 2:
- `risk_items` table (migration `001_initial_schema.sql`), RLS policies (migration `002_rls_policies.sql`) — SELECT open to all authenticated, write restricted to admin/super_admin.
- `GET/POST /api/phases/[id]/risks`, `PATCH/DELETE /api/risks/[id]` (`app/api/phases/[id]/risks/route.ts`, `app/api/risks/[id]/route.ts`).
- `createRiskSchema`/`updateRiskSchema` in `lib/validations.ts`.
- Sidebar nav link already points to `/dashboard/${currentCode}/risks` (`components/layout/Sidebar.tsx:121`).

Week 9 is therefore **UI-only**: no new migration, no new API routes, no schema changes.

## Scope decisions (from brainstorming)

1. **Page scope:** one page per location covering all 4 phases (`/dashboard/[locationCode]/risks`), not a per-phase sub-route. Matches the existing sidebar link and the established one-page-per-location convention (`timeline`, `kk-consent`).
2. **Edit interaction:** Probabilitas and Dampak are inline auto-save `Select` dropdowns in the table row (per PRD's literal wording). All other fields (title, description, category, mitigation, owner, status) are edited through a shared Add/Edit modal, not inline — keeps the row compact and matches the PRD's explicit "Aksi: Edit" button.
3. **Matrix interactivity:** clicking a Risk Matrix cell filters the table to that exact probability×impact combination; clicking the same cell again clears the filter.

## Routes & data fetching

New page: `app/(app)/dashboard/[locationCode]/risks/page.tsx` — server component, sits inside the existing `[locationCode]/layout.tsx` (inherits `PhaseTabs` automatically, same as `kk-consent/page.tsx` today).

Query pattern (mirrors `app/(app)/dashboard/[locationCode]/page.tsx`):
```ts
const { data: phaseRows } = await supabase
  .from('phases')
  .select(`id, phase_code, name, risk_items ( * )`)
  .eq('location_id', location.id)
  .order('display_order')
```
Flatten into `RiskRow[]` (risk fields + `phaseId`, `phaseCode`) and pass to a client component along with `isAdmin` (resolved server-side from session, same pattern as every other admin-gated page in this codebase) and the 4 phases (`{id, phase_code, name}`) for the modal's Fase selector.

## Components (new, under `components/risks/`)

### `RiskRegisterClient` (client component, top-level)
Owns filter state:
- `faseFilter: string | 'all'`
- `statusFilter: RiskStatus | 'all'`
- `categoryFilter: RiskCategory | 'all'`
- `matrixFilter: { probability: number; impact: number } | null`

Renders, top to bottom: filter bar (3 `Select`s), `RiskMatrix`, "+ Tambah Risiko" button (admin only), `RiskTable`. Holds the risk list in local state (seeded from server props) and applies optimistic updates from create/update/delete callbacks — same pattern as `ActivityTable`'s local-state-plus-callback approach.

### `RiskMatrix`
Presentational. 5×5 grid: rows = probability 1–5 (labeled), columns = impact 1–5 (labeled). Each cell:
- Count = number of currently-Fase/Status/Kategori-filtered risks with that exact (probability, impact) pair. **Not** filtered by `matrixFilter` itself (a cell showing its own filtered-out count would be circular/confusing).
- Background color by score band (probability × impact): green 1–6, yellow 7–12, red 13–25 (exact PRD bands).
- `onClick` toggles `matrixFilter` for that cell (click active cell again → clear).
- Active cell gets a visible ring/border to show it's the active filter.

### `RiskTable`
Presentational, receives the fully filtered rows (Fase + Status + Kategori + matrix all applied).
Columns per PRD: #, Risiko (title, with an expand toggle for description), Kategori (badge), Fase, Probabilitas, Dampak, Skor (colored by band, same helper as matrix), Mitigasi, Owner, Status (badge), Aksi.
- Admin: Probabilitas/Dampak render as `Select`, `onChange` fires an immediate `PATCH /api/risks/[id]` (no debounce — discrete selection, not free text), toast on success/error, optimistic row update. Aksi column shows Edit (opens `RiskFormModal` in edit mode) and `DeleteRiskDialog`.
- Viewer: Probabilitas/Dampak/Status render as plain text/badges, no Aksi column content.
- Empty state: "Tidak ada risiko" text, matching `ActivityIssueTable`'s empty-state convention.

### `RiskFormModal`
Shared Dialog for create and edit (`mode: 'create' | 'edit'`).
- Create: shows a Fase `Select` (required, drives which `POST /api/phases/[phaseId]/risks` is called). Judul, Deskripsi (optional), Kategori, Probabilitas, Dampak, Mitigasi (optional), Owner (optional), Status (defaults to `open`, hidden on create since there's nothing to transition from — PRD's status enum starts at open).
- Edit: Fase not shown/editable (immutable). All other fields pre-filled, Status now shown as editable.
- Submit calls `POST`/`PATCH` accordingly, closes on success, toast, bubbles the new/updated row up to `RiskRegisterClient` via callback.

### `DeleteRiskDialog`
Structurally identical to `components/activities/DeleteActivityDialog.tsx`: trigger button (🗑️) → `Dialog` → confirm text → destructive `Button` → `DELETE /api/risks/[id]` → toast → callback to remove the row from local state.

## Shared logic: `lib/risk-utils.ts`

```ts
export function getScoreBand(score: number): 'low' | 'medium' | 'high'
// low: 1-6, medium: 7-12, high: 13-25
```
Plus a small map/helper from band → Tailwind classes (bg/text/border), consumed by both `RiskMatrix` cells and `RiskTable`'s Skor cell so the color logic lives in exactly one place.

`lib/risk-utils.test.ts`: Vitest coverage for the two boundaries (score 6 vs 7, score 12 vs 13) plus the extremes (1, 25). Consistent with this project's existing convention of unit-testing pure `lib/` functions (`lib/cpm.ts`, `lib/calendar.ts`, `lib/gantt-layout.ts`, `lib/dashboard-metrics.ts`).

## Error handling

Follows established convention throughout this codebase: server routes already return `{ data, error }`; client components surface `error.message` via `toast.error` and leave prior state intact on failure (no product code changes needed here — purely consuming the existing contract).

## Out of scope

- Per-phase risk sub-route (`/dashboard/[locationCode]/fase-[1-4]/risks`) — PRD's alternative URL, not used.
- Risk data feeding into the cross-location Dashboard (Week 8) or a future Pelaporan page — no changes to `lib/dashboard-metrics.ts`.
- Changing existing API contracts, validation schemas, or RLS policies for `risk_items`.
- Bulk/multi-select actions, CSV export, or audit-log UI for risk changes (audit rows are already written server-side by the existing routes; no dedicated risk audit view this week).

## Testing plan

- Vitest: new `lib/risk-utils.test.ts` (score-band boundaries).
- Manual/Playwright E2E (final task of the week, per established pattern): create a risk via the modal for each of the 4 phases, verify matrix counts and colors, click a matrix cell and confirm table filters, clear the filter, edit Probabilitas/Dampak inline and confirm Skor/color updates live, edit other fields via the modal, delete a risk with confirmation, and verify Viewer role sees a fully read-only page (no Select controls, no Aksi column, no "+ Tambah Risiko" button).
