# Minggu 14 — QA & Polish — Design

**PRD milestone:** Minggu 14 = "QA & Polish — Performance check, edge cases, UI consistency pass."

**Approach:** Rather than a speculative fresh audit, this week closes the concrete backlog of
deferred items flagged by reviewers across Weeks 4-13 (each already named, with a file/line and a
reason — not guessed). Grouped into 4 buckets. No new features, no schema changes beyond
migration 005 (already written, only needs manual apply).

---

## 1. DB / security hygiene

- **Migration 005** (`supabase/migrations/005_fix_profiles_update_rls.sql`, already written since
  Week 12): verify the SQL still matches the current `profiles_update` policy in
  `002_rls_policies.sql`, then hand off to the user to run manually via Supabase Dashboard SQL
  Editor (same convention as migrations 003/004). Defense-in-depth only — the app-level fix
  (service-role client for profiles writes) already covers the functional gap, so this is not
  blocking.
- **Leftover test locations**: `CPMTEST`, `T5DEP`, `T11FIXA`, `T11FIXB`, `TEST` — accumulated from
  Weeks 5-13's manual Playwright verification passes, repeatedly flagged for cleanup and deferred.
  Deactivate via the existing `DELETE /api/locations/{id}` route as `super_admin` (soft-delete,
  no new code). Verify via a `GET /api/locations` sweep before and after.

## 2. Test coverage gaps

- **`lib/cpm-runner.ts`**: has zero unit tests since Week 4, despite non-trivial branching logic
  added in Week 10 (the `changed` predicate gating `updated_at`/`updated_by` writes). Extract the
  update-payload computation (current lines ~165-206: given an activity, its CPM result node, and
  whether it shifted, produce `{ updates, changed }`) into a pure function
  `computeActivityCpmUpdate`. `runCpmForLocation` calls it; behavior stays byte-identical.
  Vitest cases: shifted+unlocked → `changed=true`; locked, no critical-path/float change →
  `changed=false` and no `updated_at`/`updated_by` key in `updates`; critical-path flip alone with
  no date shift → `changed=true`.
- **`components/raci/RaciClient.tsx`**: `handleReorder`'s swap-and-sort math and
  `handleCellChanged`'s locations-array update are untested pure logic living inside a component —
  the same category of risk `lib/risk-utils.ts` and `lib/workload-metrics.ts` were already
  extracted-and-tested for in prior weeks (flagged as a direct precedent in Week 11's
  whole-branch review). Extract to new `lib/raci-utils.ts`:
  - `swapStakeholderOrder(stakeholders, stakeholderId, direction): Stakeholder[] | null` (`null` =
    no-op at a top/bottom boundary)
  - `applyRaciCellChange(locations, phaseId, stakeholderId, role): RaciLocation[]`
  Component keeps the fetch/toast/state wiring, calls these for the pure transform. Vitest cases:
  swap up/down, boundary no-ops, cell set/clear/replace, cross-phase isolation (a change to one
  phase's entries must not touch another phase's).

## 3. Polish — dedup, UI consistency, edge cases

- **`lib/risk-labels.ts`** (new): `RISK_CATEGORY_OPTIONS`, `RISK_STATUS_OPTIONS` + label lookup
  maps, replacing the literal arrays currently triplicated across `RiskFormModal.tsx`,
  `RiskTable.tsx`, `RiskRegisterClient.tsx` (flagged since Week 9).
- **`lib/dashboard-metrics.ts`**: add a shared `buildActivityIssueRows` helper, replacing the
  ActivityIssueRow-building logic currently duplicated between `app/(app)/page.tsx` and
  `app/(app)/dashboard/[locationCode]/page.tsx` (flagged since Week 8).
- **`lib/date-format.ts`** (new): `formatDateID(iso: string)` wrapping the
  `toLocaleDateString('id-ID', { day: 'numeric', month: 'short', ... })` pattern already used ad
  hoc in `BaselinePanel.tsx`/`GanttChart.tsx`. Apply to the raw-ISO-date spots flagged since Weeks
  7-9: `ActivityRow`'s Baseline Mulai cell, `ActivityIssueTable`, `UpcomingActivitiesPanel`,
  `CriticalPathCard`.
- **`isNeedsAttention`** (`lib/dashboard-metrics.ts`): same-day-due activities are flagged
  "needs attention, 0 hari telat" immediately past midnight (no start-of-day normalization).
  Confirmed intentional by the user this week — no code change, add a one-line comment
  documenting the intent so it doesn't get flagged as a bug again.
- **`KkConsentForm`**: on a failed save, currently leaves the unpersisted value on screen instead
  of reverting to the last-saved snapshot (a real parity gap vs `ActivityTable`'s existing
  snapshot-revert-on-error pattern, flagged since Week 8). Fix to match.
- **Accessibility / dark-mode odds and ends** (all previously flagged, none blocking on their
  own — bundled here since this is the designated polish week):
  - Workload heatmap's sticky PIC column: add a dark-mode background variant (currently hardcoded
    `bg-white`).
  - Kalender Kerja day-cells: add `tabIndex` so they're keyboard-focusable (currently mouse-only).
  - Gantt dependency arrows: arrowhead marker should follow the line's critical/non-critical color
    instead of staying hardcoded gray.
  - Gantt arrow/bar tooltips: currently mouse-only (Radix Tooltip triggers, no keyboard focus
    path) — add keyboard reachability.

## 4. Performance — measure first, build only if data shows it's needed

- **CPM benchmark for >200 activities**: PRD's own risk table calls for this at Week 4; never
  actually run. Create a disposable test location with ~200-250 synthetic activities and real
  dependencies, time `runCpmForLocation`, deactivate the location afterward. If comfortably fast
  (expected, since the algorithm is in-memory not query-per-node), document the measured number
  and close the risk — no code change. If it's actually slow, scope a follow-up as a flagged
  recommendation, out of this week's implementation.
- **Gantt virtualization for 60+ activities**: PRD's risk table flags this; never built. Query
  real data first — max activities in any single active location. If none currently approach 60,
  document "not yet triggered, defer until real usage nears the threshold" rather than building
  speculative virtualization now. If some already do, do a real Playwright render-time check
  before deciding whether to build it this week.

---

## Out of scope

- No new features, no new API routes, no schema changes beyond migration 005.
- No changes to CPM math itself (`lib/cpm.ts`), only the update-payload/logging wrapper around it.
- Delete-dialog duplication (`DeleteStakeholderDialog`/`DeleteReportingItemDialog`/etc.) — accepted
  established precedent per Week 11's whole-branch review, not new debt, not touched this week.
- Reorder non-transactionality (stakeholders/RACI reorder can leave a duplicate `display_order` on
  partial PATCH failure) — accepted since Week 11, would need a dedicated transactional reorder
  endpoint; out of scope for a polish week with a "no new endpoints" constraint.
- Any item where "measure first" (bucket 4) shows the current numbers don't warrant a code change.

## Testing

- Vitest: new tests for `computeActivityCpmUpdate` (cpm-runner) and `lib/raci-utils.ts`; existing
  suite (83 tests before this week) must stay green throughout.
- `npm run build` / `npm run lint` clean at the end, same bar as every prior week.
- Real-browser Playwright pass for the UI-facing fixes (KkConsentForm revert, dark-mode/a11y
  odds and ends, date-formatting spots) — same discipline as every prior week's final task.
