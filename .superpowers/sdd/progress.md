# Minggu 1 — SDD Progress Ledger
# Plan: docs/superpowers/plans/2026-07-01-minggu1-fondasi-db-auth.md
# Started: 2026-07-01

## Tasks

- Task 1: COMPLETE (commit 6330370, review clean)
- Task 2: COMPLETE (commits f31317f→21a66df, fix for style/baseColor, review clean)
- Task 3: COMPLETE (commit 7955ccf, supabase link skipped→SQL Editor fallback, review clean)
- Task 4: COMPLETE (commit e07b269, review clean)
- Task 5: COMPLETE (commit d10e101, review clean)
- Task 6: COMPLETE (commit 4ccc79f, review clean)
- Task 7: PENDING USER ACTION — run SQL in Supabase Dashboard (see instructions below)
- Task 8: COMPLETE (commit 3cdb92e, review clean)
- Task 9: COMPLETE (commit 49345f1, review clean)
- Task 10: COMPLETE (commit 186d194, review clean)
- Task 11: COMPLETE (commits 1c735f0+e576334, CSS fix included, review clean)
- Task 12: COMPLETE (commit 5b29565, review clean)
- Task 13: COMPLETE (commit 38eca70, review clean)
- Task 14: COMPLETE (commit 751fc7d, review clean)
- Task 15: COMPLETE (E2E verified — login/logout/middleware/sidebar/role guard all working)
- Middleware bugfix: commit 3455836 (exclude /api/auth/* from auth guard)
- Week 1 final commit: e2f4193
Task 1: COMPLETE (commit 4b14fb9, review clean)
## Week 2
# Plan: docs/superpowers/plans/2026-07-01-minggu2-data-layer-api.md
# Base: e2f4193
- Task 1: COMPLETE (commit 4b14fb9, review clean)
- Task 2: COMPLETE (commit 0fd6e28, review clean)
- Task 3: COMPLETE (commits 1d5366d+9e6c4cc, fix: double getSession + schema guard comment, review clean)
- Task 4: COMPLETE (commits 93d6848+faebf89, fix: holiday/kk_consent error handling + cleanup, review clean)
- Task 5: COMPLETE (commit ec9c087, review clean; noted: audit fetch-before-update race is accepted pattern for Week 2)
- Task 6: COMPLETE (commits 9491e8a+50f3f61, fix: updated_by in lock + reorder error check, review clean)
- Task 7: COMPLETE (commit 25161b4, review clean; minor: GET returns created_at, POST/PATCH don't — accepted)
- Task 8: COMPLETE (commits b71d736+3d0346f, fix: oldValue in DELETE audit, review clean)
- Task 9: COMPLETE (commit ac8651e, review clean; noted: [id] naming is codebase convention, insertAuditLog never throws by design)
- Task 10: COMPLETE (commit 990c415, review clean)
- Task 11: COMPLETE (commits e9c072b+6439a3b, fix: kk-consent notFound + reporting DELETE oldValue, review clean)
- Task 12: COMPLETE (commit 5d4e982, review clean; isAfter finding was false positive — not imported)

## Week 2 — POST-REVIEW FIXES
- Final whole-branch review: commit 57207b3 (Critical: admin privilege escalation fix; 5 Important: soft-delete error checks, baseline rollback, kk-consent 404, activate deactivate-all error check)
- Angle review + inline fixes: commit 6869433 (RACI null guard, stakeholders null guard, admin.ts env-var throw, ActivityItem hoist, double getSession removed, batch inserts in templates)
- Build: `npm run build` → ✓ Compiled successfully
- Week 2 COMPLETE (2026-07-01)

## Week 3
# Plan: docs/superpowers/plans/2026-07-02-minggu3-fase-crud.md
# Base: 0515cf5
- Task 1: complete (commits 0515cf5..294d4b3, review clean)
- Task 2: complete (commits 294d4b3..bada936, fix: missing package.json/lock deps committed separately, review clean)
- Task 3: complete (commit c1554c6, review clean)
- Task 4: complete (commit 48d3224, review clean)
- Task 5: complete (commit 1cbde34, review clean; reviewer noted depCounts predecessor_id-only filter — matches pre-existing, already-approved Week 2 pattern in /api/locations/[locationId]/dependencies, not a gap)
- Task 6: complete (commit d9cf5e7, review clean; disclosed deviation: unused-var lint fix via `void` statements instead of underscore-prefixed params — verified inert by reviewer)
- Task 7: complete (commit e1b8d9f, review clean; minor stale comment noted, not fixed)
- Task 8: complete (commits e1b8d9f..f77b5cf, fix: rapid-double-click race guard on reorder buttons, review clean)
- Task 9: complete (commit 4a353c0, review clean; minor: form not reset on cancel/dismiss, matches brief as-written, not fixed)
- Task 10: complete (commit 1a8662b, review clean)
- Task 11: COMPLETE. Verified via curl (routing, CRUD, validation, RBAC — see below) plus a user browser pass after the routing fix (dev server restarted, table renders, edit/auto-save/toggle/reorder/add/delete/Viewer-read-only all confirmed working visually). Found and fixed a CRITICAL routing bug live: the `fase-[phase]` folder is a hybrid dynamic segment (static prefix + `[param]`), which Next.js App Router does not support — `params.phase` was never populated, so every /dashboard/*/fase-N request 404'd. Renamed to `[faseSlug]`, strip `fase-` prefix in code (commit e770d4a). curl verification against a real Supabase Cloud test location ("TEST", created via POST /api/locations): fase-1..4 return 200 with real activity data, fase-0/fase-5 404, bare location redirects to fase-1, unknown location 404s, PATCH edit works, PATCH invalid date range correctly 400s (Task 1 fix confirmed), status->selesai auto-sets progress 100, lock toggle works, POST create works, PATCH reorder works, DELETE works, DELETE with successor correctly 409s (HAS_SUCCESSORS), Viewer role correctly 403s on mutation but 200s on GET.
- Week 3 FULLY COMPLETE (2026-07-02)

## Week 3 — FINAL WHOLE-BRANCH REVIEW
- Reviewed range 0515cf5..1a8662b (opus). Verdict: Ready to merge, with fixes.
- Important #1: progress_pct numeric input could send non-integer, rejected by server schema — FIXED (commit 940cd7d, Math.round added)
- Important #2: 🔒 lock toggle doesn't disable date inputs — assessed as by-design, not a bug: schema comment confirms date_locked is a flag for the Week 4 CPM engine (protects from auto-shift), not a UI edit-lock. No fix applied.
- Minor items (depCounts query count, holiday Date re-parsing per render, ActivityRow not memoized, unused ApiResponse<T> export): accepted as-is, no action.
- Week 3 implementation COMPLETE (2026-07-02) pending user's manual E2E pass (Task 11)

## Week 4
# Plan: docs/superpowers/plans/2026-07-02-minggu4-cpm-engine.md
# Base: f2e800d
- Task 1: complete (commit 661ef55, review clean; noted vitest ^4.1.9 installed, newer major version, flagged for awareness in later tasks)
- Task 2: complete (commit 9081817, review clean; reviewer independently traced detectCycle against 3 extra scenarios beyond given tests, confirmed correct)
- Task 3: complete (commit 5ce242f, review clean; disclosed deviation: added vitest.config.ts @ alias resolution (first @/-import under test), verified necessary and correctly matches tsconfig.json; reviewer hand-traced FF/SF forward-pass math, confirmed correct)
- Task 4: complete (commit 7552565, review clean; implementer caught and fixed a real arithmetic error in the plan's own test data (2026-07-01 to 2026-07-08 is 5 working days, not 3) — independently reverified by reviewer via doomsday algorithm, confirmed correct)
- Task 5: complete (commit d87d211, review clean; two disclosed deviations verified independently — same date-math fix as Task 4 applied consistently, Array.from() wrapping for tsconfig's implicit ES3 target confirmed necessary/behavior-preserving/precisely scoped; reviewer hand-traced backward pass + critical path for the diamond test, confirmed correct)
- Task 6: complete (commit 3f838a5, review clean; minor: generated dep count is 79 not 80, inherited off-by-one from plan's own test code, immaterial to test validity)
- Task 7: complete (commit 53be197, review clean; reviewer independently grepped whole repo, confirmed no other computeDurasiHK call site was missed)
- Task 8: complete (commit e7d184e, review clean; extractLocationId's dual object/array embed handling and await/audit-log discipline verified correct — first codebase usage of a child-selecting-parent PostgREST embed)
- Task 9: complete (commit 7a46188, review clean; DELETE's extract-locationId-before-delete ordering verified correct — the one real risk in this task)
- Task 10: complete (commits 7a46188..5abc071, fix: unchecked cycle-check query errors could silently mask existing deps from the cycle check — now short-circuit with serverError(), review clean)
- Task 11: complete (commit 068f891, review clean)
- Task 12: complete (commit e26b338, review clean)
- Task 13: COMPLETE via curl E2E. Found and fixed a CRITICAL schema bug live: lib/cpm-runner.ts queried locations.project_start_date, a column that was never actually added to the schema (Week 1 gap) — only ever a transient POST /api/locations input, never persisted. The query errored, error was silently swallowed, runCpmForLocation looked successful while doing nothing (updatedCount:0, criticalPath:[] for every trigger, every location). Fixed via migration 003 (new nullable column + backfill from earliest activity date per location), persisting the value in POST /api/locations, and making cpm-runner throw instead of silently no-op on this query's error (commit a433e13). User ran the migration via Supabase Dashboard SQL Editor.
  Verified after fix (fresh CPMTEST location, real Supabase Cloud data): FS dependency creation shifts successor dates correctly; reverse dependency correctly rejected 422 CYCLE_DETECTED with cycleIds; PATCH-ing a root activity's dates correctly cascades to its FS successor; date_locked activities correctly stay fixed while unlocked predecessors move; work-calendar holiday add/delete correctly triggers a cross-location cascade; DELETE with an existing successor still correctly 409s HAS_SUCCESSORS (pre-existing Week 2/3 behavior, unaffected by this week's changes). Also observed (not a bug): an unlocked root activity's duration is recomputed from its own current stored dates + current holiday list on every CPM run, so repeatedly editing/recalculating such an activity without locking it can cause its duration to visibly shrink — a faithful, if surprising, consequence of the PRD's own "duration always derived from current tanggal_mulai/selesai_rencana" rule combined with "unlocked root activities reset to epoch." Worth a UX note for a future week (e.g. nudge users to lock root activities they want to manually pin), not a defect in this week's implementation.
  npm test: 31/31 passing. npm run build: clean.
- Week 4 implementation COMPLETE (2026-07-02)

## Week 4 — FINAL WHOLE-BRANCH REVIEW
- Reviewed range f2e800d..e853047 (opus). Verdict: Ready to merge, with fixes.
- Important: the project_start_date fix (Task 13) only hardened one of five unchecked Supabase reads in runCpmForLocation/getActivityLocationId — depRows and holidayRows in particular could silently WRITE WRONG SCHEDULE DATA (not just no-op) on a transient query failure. FIXED (commit 7153b39): all five reads now check error and throw. Re-reviewed (opus): confirmed correct, ordering verified (throw before data use in every case), scope clean (only lib/cpm-runner.ts touched). Verdict: Ready to merge, Yes.
- Minor (not fixed, deferred): runCpmForAllActiveLocations's own `locations` read still unchecked — non-corrupting no-op only (loops over empty list on failure), not the write-wrong-data class. Follow-up candidate for a future week.
- Other minor items from the first pass (migration not re-runnable via ADD COLUMN IF NOT EXISTS, buildCriticalPath returns one representative path not all parallel critical chains, UTC timezone coupling, recalculate returns 500 not 404 for unknown locationId, "batch UPDATE" wording vs N-concurrent-updates implementation): accepted as-is, no action.
- Week 4 CPM Engine COMPLETE (2026-07-02)

## Week 5
# Plan: docs/superpowers/plans/2026-07-03-minggu5-dependensi-ui.md
# Spec: docs/superpowers/specs/2026-07-03-minggu5-dependensi-ui-design.md
# Base: 41e3cd9
- Task 1: complete (commit 9332583, review clean)
- Task 2: complete (commit 903929c, review clean; minor: implementer's own report miscounted 3 return sites as 4, code itself correct)
- Task 3: complete (commit f31aee6, review clean)
- Task 4: complete (commit e0a1cdc, review clean; curl-verified: catatan-only PATCH returns cpm:null, predecessor date PATCH returns cpm.shiftedCount>0 with successor's new dates, DELETE returns {id,cpm})
- Task 5: complete (commit 2232ff4, review clean; curl-verified POST/PATCH/DELETE new {dependency|id, cpm} shapes and unchanged 422 CYCLE_DETECTED; note: a leftover test location from verification remains in the dev Supabase DB, no code impact)
- Task 6: complete (commits 9d84cce+f2260b2, fix: stale selectedActivityId survived a Predecessor/Successor tab switch, could silently submit a dependency in the wrong direction — resetForm() now runs on Tabs onValueChange, review clean after fix; minor accepted: depType/lagDays also cleared on tab switch, small UX cost of the safety fix)
- Task 7: COMPLETE via real headless-Chromium (Playwright) browser E2E + curl, the first genuine
  browser-level verification this feature has had (Tasks 4-6 were curl/code-read-through only).
  All Step 1 scenarios passed on the live UI: badge cross-check against curl, same-phase
  predecessor add (live badge + toast update), cross-phase add (verified after page load in the
  other phase), cycle rejection (toast + no partial state), delete-dependency then
  delete-now-orphan-free-activity (live cleanup, no orphaned rows), and Viewer read-only (badge
  visible/clickable, no add form, no delete buttons). One scenario needed adaptation: the
  duplicate-dependency check could not be driven through the real UI because
  DependencyPanel's own "Pilih kegiatan" dropdown already filters out any activity already
  related in the current tab/direction — a true duplicate submission is unreachable via the panel
  as built (verified: 0 matching options once linked). Exercised the backend's own guard directly
  via an authenticated fetch instead, confirming the existing 400 "Dependensi ini sudah ada"
  path still works as a defense-in-depth check behind that already-preventive UI. Also
  investigated, and ruled out as a false alarm, a suspected uncontrolled-date-input staleness bug
  on CPM-shifted successor rows — confirmed live updates work correctly (React's defaultValue is
  re-applied on every render for inputs the user hasn't directly typed into; only the dirtied
  input itself is exempt). No bugs found or fixed. Cleaned up all 5 iterations of test locations
  created during the run (deactivated via DELETE as super_admin), unlike some earlier weeks'
  leftover test data. npm test: 31/31 passing. npm run build: clean (pre-existing Edge Runtime
  warning from @supabase/supabase-js unrelated to this week).
- Week 5 Dependensi UI implementation COMPLETE (2026-07-03)

## Week 5 — FINAL WHOLE-BRANCH REVIEW
- Reviewed range 41e3cd9..0ead5ab (opus). Verdict: Ready to merge, Yes.
- Confirmed all 5 reshaped API routes' new {activity|id|dependency, cpm} response shapes compose correctly end-to-end through ActivityTable/ActivityRow/DependencyPanel, with no surviving old-shape consumer anywhere in the diff. Auth (isAdmin) preserved on every touched route. The set of 5 CPM-surfacing routes is confirmed complete (lock/reorder routes correctly excluded, POST activities correctly excluded per justified reasoning).
- Minor (not fixed, accepted): PATCH /api/dependencies/[id]'s reshaped response has no client consumer yet (panel has no edit UI, only add/delete) — dead but harmless contract surface, revisit if a future week adds dependency editing.
- Minor (not fixed, accepted): ActivityTable's savedSnapshots can briefly hold pre-CPM dates after a shifting edit, causing a rare/transient rollback-to-stale-dates if a *subsequent* save on the same row fails — narrow, visual only, self-corrects on next successful save.
- Minor (recommended, not applied): add a one-line comment at ActivityRow's date <Input> or in applyCpmResult documenting that live successor-row date refresh relies on uncontrolled-input dirty-flag semantics — protects against a future controlled-input refactor silently breaking live updates.
- Week 5 Dependensi UI COMPLETE (2026-07-03)

## Week 6
# Plan: docs/superpowers/plans/2026-07-03-minggu6-gantt.md
# Spec: docs/superpowers/specs/2026-07-03-minggu6-gantt-design.md
# Base: bd47be1
- Task 1: complete (commit 2d731a4, review clean; PENDING USER ACTION — run supabase/migrations/004_activities_total_float_days.sql via Supabase Dashboard SQL Editor before Task 5+ live verification)
- Task 2: complete (commit 18171e3, review clean; TDD, 46/46 tests pass, computeDeviationDays sign convention hand-verified correct)
- Task 3: complete (commit 359e27d, review clean)
- Task 4: complete (commit 6f5fe2b, review clean; all 13 colors/sizing constants verified character-by-character against the validated dataviz palette)
