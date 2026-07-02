# Minggu 3 — Fase CRUD: Design

**Status:** Approved
**PRD ref:** §16 Estimasi Milestone (Minggu 3), §10.6 Halaman Fase (F1–F4)

## Goal

Build the Fase page (`/dashboard/[locationCode]/fase-[1-4]`): a full activities table with
add/edit/delete/reorder, auto-save, validation, status, and progress. All required backend
APIs already exist (built in Week 2) — this week is frontend-only, plus one small backend
validation gap-fix.

## Context / What already exists

- `GET /api/locations/[locationId]/phases` — returns all 4 phases with nested activities
  (already the right shape for this page).
- `GET /api/locations/[locationId]/dependencies` — returns all dependencies for a location.
- `POST /api/phases/[id]/activities`, `PATCH /api/activities/[id]`, `DELETE /api/activities/[id]`,
  `PATCH /api/activities/reorder`, `PATCH /api/activities/[id]/lock` — full activities CRUD,
  RBAC-gated to Admin/Super Admin via `isAdmin()`, with audit logging.
- `DELETE /api/activities/[id]` already returns `409 HAS_SUCCESSORS` with a count message when
  the activity has successors — it does not return successor names/list.
- shadcn/ui only has `button`, `card`, `input`, `label` installed so far. No table, select,
  dialog, textarea, badge, or toast component yet. No drag-and-drop or data-fetching library
  installed (`date-fns`, `zod` are the only relevant deps present).
- `app/(app)/page.tsx` (home) already links to `/dashboard/[locationCode]`, which doesn't
  exist yet — currently a 404.
- Schema: `activities.status` enum `belum_mulai | sedang_berjalan | selesai | ditunda`;
  `phases.phase_code` constrained to `F1..F4`.

## Gap found: PATCH validation

`PATCH /api/activities/[id]` (Week 2) does not enforce `tanggal_selesai_rencana >=
tanggal_mulai_rencana` — only the `POST` (create) route does. Since PRD's "Validasi" bullet
for the Fase page is explicit Week 3 scope, this PATCH route will be updated to merge partial
updates against the current row's existing values and reject if `selesai < mulai` (applies to
both rencana and, when both realisasi dates are present after merge, realisasi too).

## Routing

- `app/(app)/dashboard/[locationCode]/layout.tsx` — server component. Resolves `locationCode`
  → location row via Supabase (`.eq('code', ...)`), calls Next's `notFound()` if missing.
  Renders a phase tab bar (F1–F4, using phase names) + `children`.
- `app/(app)/dashboard/[locationCode]/page.tsx` — redirects to `fase-1`.
- `app/(app)/dashboard/[locationCode]/fase-[phase]/page.tsx` — server component. `[phase]` is
  `"1".."4"`. Fetches phases+activities for the location (same query shape as the phases API
  route) and location-wide dependencies; finds the phase where `phase_code === "F" + phase`
  (404 if missing); computes a `Map<activityId, depCount>` from dependencies (counting an
  activity as involved whether predecessor or successor). Passes `activities`, `depCounts`,
  `phaseId`, `locationId`, and `isAdmin` (from session role) to `<ActivityTable>`.

## Data flow / state (client component `ActivityTable`)

- `useState<Activity[]>(initialActivities)` holds the row data.
- Field edit → update local state immediately (optimistic) → debounce 600ms (per-row timeout
  ref, keyed by activity id) → `PATCH /api/activities/[id]` with only the changed field(s).
- Per-row save-status state (`idle | saving | saved | error`) drives an indicator:
  "Menyimpan…" / "✓ Tersimpan" / "⚠ Gagal".
- On success: merge the server's returned row (source of truth) into local state.
- On failure: revert the edited field to the last known-good server value, show an error toast
  with the API's error message, set row status to `error` briefly then back to `idle`.
- Uniform 600ms debounce applies to all editable fields (text, select, date, checkbox-style
  toggles), matching the PRD wording literally rather than special-casing discrete fields.

## Table columns (all from PRD §10.6)

| Column | Behavior |
|---|---|
| ⋮⋮ (drag handle) | Replaced with ▲▼ reorder buttons (Admin only) — see Reorder below |
| # | Row number (display order index, 1-based) |
| ♦ milestone | Icon toggle button (Admin), reads/writes `is_milestone` |
| 🔒 lock | Icon toggle button (Admin), calls `PATCH /api/activities/[id]/lock` |
| 🔴 critical | Read-only badge from `is_on_critical_path` (always false until Week 4 CPM runs) |
| Kegiatan | Inline editable text (Admin) / plain text (Viewer) |
| PIC | Inline editable text (Admin) |
| Dep | Badge showing count from `depCounts` map; click is a no-op placeholder until Week 5 builds the dependency panel |
| Rencana Mulai / Selesai | `<input type="date">` (Admin) |
| Durasi (HK) | Read-only, computed client-side via `lib/calendar.ts` working-days helper |
| Baseline Mulai | Always "–" (no baseline exists until Week 7) |
| Deviasi (hari) | Always "–" (depends on baseline) |
| Realisasi Mulai / Selesai | `<input type="date">` (Admin), nullable |
| Status | `<Select>` (Admin) / badge (Viewer); changing to `selesai` sets progress to 100 client-side optimistically (server already does this too) and to `belum_mulai` sets it to 0 |
| % | Quick buttons 0/25/50/75/100 + numeric input (Admin) |
| Catatan | Inline `<Textarea>` (Admin) / plain text (Viewer) |
| Risiko | Always "–" placeholder (Week 9 risk register) |
| 🗑️ delete | Icon button (Admin) → confirm dialog → see Delete below |

No date-picker library — native `<input type="date">` satisfies the "Date picker" requirement
without adding a dependency.

## Add row

"+ Tambah Kegiatan" button (Admin only, bottom of table) opens a `<Dialog>` with fields
matching `createActivitySchema`: kegiatan, pic, tanggal_mulai_rencana, tanggal_selesai_rencana,
is_milestone, catatan. On submit: client-side date validation, then
`POST /api/phases/[id]/activities`; appended to local list on success.

## Delete row

Trash icon → confirm `<Dialog>` ("Yakin hapus kegiatan ini?") → `DELETE /api/activities/[id]`.
If the response is `409 HAS_SUCCESSORS`, the dialog stays open and shows the API's message
(successor count) instead of closing — no list of successor names, since the API doesn't
provide one (documented limitation, consistent with other accepted gaps from Week 2).

## Reorder

▲▼ buttons per row (no drag-and-drop library — user's explicit choice over @dnd-kit).
Clicking swaps `display_order` with the adjacent row optimistically in local state, then fires
`PATCH /api/activities/reorder` with the changed items; reverts local order on error.

## New shadcn/ui components

`table`, `select`, `dialog`, `textarea`, `badge`, `toast` — added via the shadcn CLI, consistent
with how `button`/`card`/`input`/`label` were added in Week 1. No new npm dependencies beyond
what the shadcn CLI installs (Radix primitives).

## Out of scope (explicitly deferred to later weeks)

- Dependency panel content (Week 5)
- Baseline snapshot / deviation values (Week 7)
- Critical path highlighting logic (Week 4 — CPM engine)
- Risk register linkage (Week 9)
- CPM-triggered date-shift notifications (Week 4+; the `TODO Week 4` markers already in the
  API routes stay as-is)

## Testing

Manual E2E checklist as the final task, matching the Week 1/2 pattern: add/edit/delete/reorder,
status transitions, progress quick-buttons, date validation (client + server), milestone/lock
toggles, viewer-role read-only enforcement, auto-save indicator states (saving/saved/error).
