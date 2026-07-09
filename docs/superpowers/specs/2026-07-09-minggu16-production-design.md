# Minggu 16 — Production — Design

**PRD milestone:** Minggu 16 = "Production — Fix UAT issues, deploy production, handover & dokumentasi."

**Deviation from PRD wording:** Stakeholder UAT (Minggu 15's guide, `docs/uat-guide-minggu15.md`)
has not run yet as of this week — confirmed with user. "Fix UAT issues" is replaced with fixing
the 2 real bugs already flagged-but-deferred from Minggu 15 (`cpmFinishToDate` zero-duration bug,
E2ESH's corrupted activities). Actual stakeholder UAT proceeds separately, outside this session;
any findings from it become a future fix pass, not part of this week.

**User decisions locked in during brainstorming:**
- Supabase: reuse the same Cloud project used since Minggu 1 (no new project, no data migration).
- Domain: default `*.vercel.app`, no custom domain.
- Handover docs: both a Perumnas user guide and a technical maintainer runbook.

---

## 1. Fix `cpmFinishToDate` zero-duration bug

`lib/cpm.ts:187-189`:
```ts
export function cpmFinishToDate(earliestFinish: number, projectStart: Date, holidays: Date[]): Date {
  return addWorkingDays(projectStart, earliestFinish - 1, holidays)
}
```
The `- 1` converts a working-day *count* to a 0-indexed *offset*, correct only when
`duration >= 1` (so `earliestFinish > earliestStart`). For a zero-duration activity (milestone),
`earliestFinish === earliestStart` (see `forwardPass`, `lib/cpm.ts:146`), so the result lands one
working day *before* the start date — an invalid `mulai > selesai` pair.

**Fix:** change the offset to `Math.max(earliestFinish - 1, earliestStart)`. For `duration >= 1`
this is unchanged (`earliestFinish - 1 >= earliestStart` always holds). For `duration === 0` it
collapses to `earliestStart`, giving finish === start, correct for a milestone.

Signature changes to take `earliestStart` as well:
```ts
export function cpmFinishToDate(earliestStart: number, earliestFinish: number, projectStart: Date, holidays: Date[]): Date
```
One real caller (`lib/cpm-runner.ts:67`), which already has `node.earliestStart` in scope — trivial
update. Test file `lib/cpm.test.ts` (2 call sites) updated to match.

New Vitest case: zero-duration activity's start and finish dates are equal (currently would fail
against the unfixed code — the regression test for this exact bug).

## 2. Repair E2ESH's corrupted activities

17 of E2ESH's activities currently carry CPM-derived `mulai > selesai` from before this fix
existed — and are permanently un-PATCHable (the PATCH route's date-order validation rejects any
further edit once the stored dates are already invalid, a pre-existing separate gap that stays
out of scope this week). Once the engine fix lands, trigger `POST /api/locations/{E2ESH-id}/recalculate`
— CPM is the sole writer of these fields, so a fresh run overwrites the bad values with correct
ones. Verify via `GET` that no activity in E2ESH has `mulai > selesai` afterward.

## 3. Deploy production

Follow the PRD's own Go-Live checklist (§16) against the existing Vercel project, promoting it
from staging to Production rather than creating a new one:

- [ ] `npm test` — all CPM/calendar/etc. unit tests pass (baseline before touching anything)
- [ ] Playwright E2E — full local run green (file-by-file per the Minggu 13 execution-pattern note)
- [ ] Migration state clean — confirm no pending migrations (005 already applied per Minggu 14)
- [ ] RLS active on every table — spot-check via Supabase Dashboard → Authentication → Policies
- [ ] Super Admin login works against the live URL
- [ ] One CPM recalculate round-trips correctly in production (simple single-dependency case)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` not present in any `NEXT_PUBLIC_` env var or client bundle
- [ ] **Default seed passwords rotated** — `superadmin@perumnas.co.id` / `admin@perumnas.co.id` /
      `viewer@perumnas.co.id` currently use the PRD's published defaults (`SuperAdmin123!` etc.,
      literally printed in the PRD). This is a real credential change for accounts stakeholders
      will use — new passwords come from the user at execution time (not invented by the agent,
      not committed to the repo). Documented in the handover doc's private distribution, not in
      any tracked file.
- [ ] Production URL reachable by stakeholders (smoke pass, same shape as Minggu 15 Section 3)

Vercel-side: promote the existing deployment to the Production environment (Vercel's own
staging→production promotion, not a new import) — env vars already set from Minggu 15, verified
unchanged since they point at the same Supabase project either way.

## 4. Handover documentation

Two documents, both in `docs/`:

- **User guide (Bahasa Indonesia, non-technical)** — how Perumnas admin/staff use the dashboard
  day to day: login, per-lokasi fase/kegiatan entry, dependency panel, Gantt reading, risk
  register, RACI, pelaporan, weekly summary. Builds on `docs/uat-guide-minggu15.md`'s scenario
  language but reframed as ongoing reference, not a one-time test script.
- **Technical runbook** — for whoever maintains this after handoff: repo/stack overview, how to
  deploy (Vercel + Supabase Cloud, env vars, migration workflow), DB structure summary (13 tables,
  RLS model, service-role vs session-client usage), how CPM/Gantt/audit-log work at a high level,
  known deferred items (E2E `kk-consent.spec.ts` revert-path gap, Gantt arrow focus-ring, PATCH
  bypass on CPM-written dates), where to find prior weeks' plans/specs for history.

---

## Out of scope

- Actual stakeholder UAT execution — happens separately; any findings are a future fix pass.
- New/separate Supabase project for production — explicit user call, reuses the Minggu 1 project.
- Custom domain — explicit user call, default `*.vercel.app` stays.
- PATCH route's date-order-validation bypass for CPM writes (flagged Minggu 15, still real, not
  triggered again once the zero-duration bug itself is fixed) — recorded as a known-deferred item
  in the runbook, not fixed this week.
- `kk-consent.spec.ts`'s missing revert-path E2E coverage (flagged Minggu 14) — recorded, not fixed.

## Testing

- New Vitest case for `cpmFinishToDate` zero-duration (this week's regression test).
- Existing `npm test` / Playwright suites re-run as part of the Go-Live checklist, not expanded
  further.
- Live verification: E2ESH repair confirmed via API read, production smoke pass per checklist.
