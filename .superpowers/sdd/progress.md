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
- Task 1: complete (commit 2d731a4, review clean; migration applied by user via Supabase Dashboard SQL Editor before Task 5 — confirmed live by every subsequent task's successful total_float_days selects/renders through Task 12)
- Task 2: complete (commit 18171e3, review clean; TDD, 46/46 tests pass, computeDeviationDays sign convention hand-verified correct)
- Task 3: complete (commit 359e27d, review clean)
- Task 4: complete (commit 6f5fe2b, review clean; all 13 colors/sizing constants verified character-by-character against the validated dataviz palette)
- Task 5: complete (commit 9af0c27, review clean; implementer caught and fixed a real bug in the plan's own sample code — baselineActivities was computed but never referenced, which next build's @typescript-eslint/no-unused-vars would reject as a build error; fixed by surfacing its .length in the placeholder text, independently re-verified by reviewer against .eslintrc.json)
- Task 6: complete (commit 4cec3a0, review clean)
- Task 7: complete (commit 6efdb6c, review clean; minor accepted: GanttMilestone's non-critical color is a hardcoded #0b0b0b rather than a gantt-constants.ts export -- matches the plan's own text as-written, not an implementer deviation, purely stylistic)
- Task 8: complete (commit 183adf6, review clean; reviewer hand-verified 2-lane stack centering math, no overlap, correct 2px gap)
- Task 9: complete (commit f77fddc, review clean; two minor design gaps traced to the plan's own code, not implementer deviations: (1) SVG <g> tooltip trigger has no tabIndex so arrow tooltips are mouse-only, not keyboard-reachable; (2) arrowhead marker fill is hardcoded gray even when the line itself turns critical-red. Both accepted for now, candidates for a follow-up polish task)
- Task 10: complete (commit 81c5e11, review clean)
- Task 11: complete (commit 7543164, review clean). Found and fixed two real integration bugs live via Playwright, only catchable once the full Gantt tree actually rendered in a browser: (1) app/layout.tsx never had a <TooltipProvider> anywhere in the app -- every Tooltip-using component (Tasks 8/9) would have crashed the page on load; added it at the root layout. (2) GanttArrows.tsx's dependency-arrow tooltip was anchored on an SVG <g>, which floating-ui/Radix cannot position (mounts with correct text but a {0,0,0,0} box, permanently invisible) -- fixed by keeping the <svg> purely visual and adding a sibling absolutely-positioned HTML <div> per dependency (same x1/y1/x2/y2 math, shared not duplicated) as the actual tooltip trigger. Both fixes independently re-verified by the reviewer against the diff (confirmed TooltipProvider was genuinely absent repo-wide before this change; confirmed the arrow math is unchanged and shared between the visual path and the new hit-target). Full E2E checklist (bars, all 3 toggles, both tooltip types, milestones, Minggu weekend shading) confirmed via real headless-Chromium Playwright pass against location CPMTEST (26 activities, 6 milestones, 1 dependency, 1 critical activity). npm test 46/46, npm run build clean, npm run lint clean.
- Task 12: COMPLETE via real headless-Chromium Playwright E2E. Covered the one scenario Task 11
  could not (no location had an active baseline yet): created a disposable test location (`T12BLF`,
  4 phases / 27 activities from the standard template), created a real baseline via
  `POST /api/locations/{id}/baselines`, then forced a known deviation by PATCHing one activity
  4 working days later. That PATCH needed `date_locked: true` in the same request — without it,
  the PATCH's own CPM recalculation (`runCpmForLocation`, triggered because dates changed) would
  have silently reset the activity's start straight back to the project start date before the
  response even returned, since this location's template creates no dependencies between
  activities and an unlocked node with no predecessor always resolves to `earliestStart = 0`. Not a
  Week 6 bug -- confirmed this is pre-existing Week 4 CPM engine behavior (standard CPM handling of
  unconstrained activities), already visible on CPMTEST itself (25 of its 26 activities now sit at
  `tanggal_mulai_rencana = 2026-07-01`, the project start, from earlier weeks' CPM runs) -- noted
  here for future weeks' awareness, not fixed (out of this task's scope). With that lock in place,
  the real-browser pass on `/dashboard/T12BLF/timeline` confirmed everything Task 11 couldn't:
  exactly 2 stacked bars (gray baseline behind, blue rencana shifted right of it) for the edited
  activity; hovering the rencana bar shows `"Baseline: 2026-07-10 (deviasi +4 hari kerja)"` --
  correct sign (later than baseline is positive) and exact expected magnitude; unchecking
  "Tampilkan Baseline" dropped the page's bar-trigger count from 48 to 27 (all 21 non-milestone
  activities' baseline bars disappearing, rencana bars staying), re-checking restored 48; the F1-F4
  phase legend rendered throughout. One suspicious console hydration warning appeared on the very
  first attempt (`Extra attributes from the server: %s%s style` on GanttControls' checkbox) --
  investigated rather than dismissed: reproduced the exact same flow three more times (fresh
  context, fresh dev-server restart, cold route compile) with zero recurrences, traced the actual
  cause to writing scratch `.js` files into `.superpowers/sdd/` while the Next.js dev server's
  file watcher was live (it watches the whole project tree, not just app/components), which
  triggered a Fast-Refresh full reload racing the in-flight Playwright navigation -- confirmed
  false alarm via one final completely clean run (dev server untouched by any file writes for its
  duration) showing 0 console errors. No product code changed by this task. Cleaned up: deactivated
  `T12BLF` (and an earlier same-purpose location `T12BL` from before the locking issue was
  understood) via `DELETE /api/locations/{id}` as `superadmin@perumnas.co.id` -- that route
  requires `super_admin`, and the seeded `admin@perumnas.co.id` account used throughout this task
  is role `admin`, so its own DELETE attempt correctly 403'd first. npm test: 46/46 passing (no new
  tests, none expected). npm run build: clean, all 17 routes generated.
- Week 6 implementation COMPLETE (2026-07-03)

## Week 6 — FINAL WHOLE-BRANCH REVIEW
- Reviewed range bd47be1..1fb5455 (opus). Verdict: With fixes -> fixed -> Ready to merge.
- Confirmed clean end-to-end prop wiring across all 12 tasks (GanttChart -> GanttRow -> GanttBar/GanttMilestone, GanttChart -> GanttArrows, GanttChart -> GanttControls), highlightCritical threaded consistently everywhere it's needed, TooltipProvider fix purely additive (zero Tooltip consumers existed before this week), total_float_days consumed only where needed, and zero scope creep against the plan's "Out of scope" list (no baseline UI, no ActivityRow columns, no virtualization, no drag-editing leaked in).
- Important (FIXED): GanttArrows.tsx's Task-11 fix for the SVG-anchored-tooltip bug had replaced the hit target with a per-dependency bounding-box <div>, which for long-spanning dependencies (predecessor/successor many rows apart) covered every row in between and swallowed those bars' own hover events -- a real regression no single-task review could see (Task 9's own dependency was between adjacent rows, too small to expose it). Fixed (commit 12246a6): dropped Radix Tooltip for arrows entirely, restored native SVG mouseenter/mouseleave on the original thin 10px invisible stroke (line-following, not bounding-box), and render the tooltip as a manually-positioned plain HTML div only while actively hovered. Verified live via Playwright with a dependency spanning ~24 rows apart: the bar in between is hoverable again, and the arrow's own tooltip still works.
- Important (resolved as documentation-only, no code issue): the migration's manual-apply nature means code deploying before the SQL runs would break Fase/phases/CPM writes -- confirmed this fails loudly (Supabase errors), not silently, so no data-corruption risk. Corrected the stale Task 1 ledger line above (it said "PENDING" from earlier in the week; it was applied before Task 5 and confirmed live since). Recommend adding "apply migration 004" to any future deploy checklist.
- Minor (not fixed, accepted, same as Task 9's own note): arrowhead marker stays gray even on critical-red arrows; arrow/bar tooltips are mouse-only, not keyboard-reachable. Both reasonable follow-up polish for a read-only internal dashboard.
- Minor (not fixed, accepted): month-gridline positions can drift ~1px from bars in WIB due to GanttChart.tsx's month-cursor math using local-time Date construction while bar offsets use UTC-parsed dates -- cosmetic, single-timezone.
- Cleanup note: two test locations created during the arrow-fix verification (T11FIXA/T11FIXB) could not be deleted with the admin test account (DELETE /api/locations requires super_admin) -- same precedent as Task 12's cleanup snag. Left inactive-but-undeleted in the dev Supabase project, no code impact.
- npm test: 46/46 passing. npm run build: clean.
- Week 6 Gantt 3 Lapis COMPLETE (2026-07-03)

## Week 7
# Plan: docs/superpowers/plans/2026-07-04-minggu7-baseline-kritis.md
# Spec: docs/superpowers/specs/2026-07-04-minggu7-baseline-kritis-design.md
- Task 1: complete (commit 3637d91, review clean)
- Task 2: complete (commit aa9dd8c, review clean)
- Task 3: complete (commit 640cec5, review clean; minor note: implementer's manual HTTP verification created a real "Baseline Awal Test" baseline against test location T11FIXB and left a dev server running on port 3000 -- flagged for Task 5's cleanup pass)
- Task 4: complete (commit 5bab9fb, review clean; minor notes: deviation recomputed on every render with no memoization -- matches existing durasiHK pattern, accepted; no-reload live-update behavior verified by inference from existing ActivityTable state pattern rather than direct browser observation, accepted; incidental discovery of pre-existing Week 4 CPM auto-scheduler resetting unlocked activities' dates on save -- out of scope, not fixed)
- Task 5: COMPLETE via real headless-Chromium Playwright E2E. Drove a real browser
  (`chromium.launch({ executablePath: ...chromium-1223\chrome-win64\chrome.exe, headless: true })`)
  through the full scenario end-to-end against a disposable test location (`T5BLK5`, standard
  4-phase/27-activity template): logged in as `admin@perumnas.co.id`, confirmed every Fase 1
  activity's Baseline Mulai/Deviasi read `–` before any baseline existed; opened "Kelola Baseline"
  on the Timeline page, typed and saved "Baseline Awal", confirmed it appeared marked "Aktif" in
  the list; back on Fase 1, confirmed every activity now showed a real Baseline Mulai date and
  `Deviasi = 0`; clicked the 🔒 lock icon on "Sosialisasi Tahap 1 – Pertemuan warga RT/RW" (required
  first, matching Week 6 Task 12's precedent, so the subsequent date PATCH's own CPM recalculation
  wouldn't reset it back to project start) then edited its Rencana Mulai +3 working days -- Deviasi
  correctly became `+3` while Baseline Mulai stayed unchanged; saved a second baseline "Baseline
  Rev-1" and confirmed both baselines listed, with Rev-1 "Aktif" and Awal showing an "Aktifkan"
  button; clicked "Aktifkan" on "Baseline Awal" and confirmed the list re-marked it "Aktif"; back
  on Fase 1, confirmed Baseline Mulai correctly reverted to "Baseline Awal"'s original snapshot
  date for the edited activity (not Rev-1's later snapshot), while Deviasi still correctly showed
  `+3`; used "+ Tambah Kegiatan" to add a brand-new activity and confirmed its Baseline Mulai/Deviasi
  both read `–` (no snapshot exists for an activity created after every baseline save); logged out
  via the real "Keluar" button, logged in as `viewer@perumnas.co.id`, confirmed "Kelola Baseline"
  is entirely absent on the Timeline page and Baseline Mulai/Deviasi render as plain text with no
  inputs on Fase 1 (same as every other read-only column for that role), and "+ Tambah Kegiatan"
  is likewise absent. Zero browser console errors across the whole run. Screenshots and the
  throwaway script are under `.superpowers/sdd/task-5-e2e.js` / `task-5-screenshots/` (gitignored
  scratch, not committed).
  One selector bug was found and fixed in the *test script itself* (not product code): the
  admin-view "Kegiatan" cell renders as an `<Input defaultValue=...>`, so a Playwright `text=`
  locator can't see activity names there (`text=` only matches text nodes, not input values) --
  switched to `input[value="..."]` matching with a `hasText` fallback for the Viewer's plain-text
  rendering of the same cell.
  Investigated, and ruled out as a false alarm (not a Task 5 bug), an apparent inconsistency where
  a fresh SSR page load showed several *other*, unrelated Fase 1 activities' Rencana Mulai reset to
  the project start date (with correspondingly large negative Deviasi, e.g. `-47`) after the
  Step-4 PATCH, while the *live, not-yet-reloaded* page had briefly still shown their old correct
  dates. A dedicated timing diagnostic (`task-5-diag.js`, not committed) polling both the live DOM
  and a direct server GET every 500ms proved this is pure eventual-consistency lag, not a stale-UI
  bug: the server-side value flips at ~1.5s post-PATCH (the 600ms debounce plus this environment's
  Supabase Cloud round-trip latency) and the client's own rendered state catches up roughly one
  render tick later, fully consistent by ~2.3s. The underlying reset itself is the same
  pre-existing Week 4 CPM auto-scheduler behavior already flagged (not newly introduced, not
  fixed) in Week 4/6 and this week's Task 4 ledger entries -- unlocked, no-predecessor activities
  always resolve to `earliestStart = 0` on any CPM run triggered by another activity's date change
  in the same location. This is the first time it's been visually confirmed to produce large,
  user-visible negative Deviasi values on unrelated rows through the new Task 4 column -- worth a
  UX callout for a future week (e.g. nudge admins to lock activities they don't want silently
  reset), still out of this task's scope to fix. Widened all post-PATCH waits in the final script
  to account for this latency so every assertion reads settled state.
  Cleanup: stopped two stray dev-server processes left running from Tasks 3 (port 3000, PID 5376)
  and 4 (port 3001, PID 25612) per the task brief's note, then started one fresh dev server for
  this task's own verification pass and stopped it again afterward. Deactivated (`DELETE
  /api/locations/{id}` as `superadmin@perumnas.co.id`, since `admin@perumnas.co.id` is role `admin`
  and that route requires `super_admin`, same precedent as Weeks 6-7) every disposable test
  location created while iterating on the script (`T5BLK`, `T5BLK2`, `T5BLK3`, `T5BLK4`, `T5BLK5`,
  `T5DIAG`) -- confirmed via a final `GET /api/locations` sweep that only the expected long-lived
  shared locations remain active (`TA`, `KK`, `KL`, `KMY`, `TEST`, `CPMTEST`, `T11FIXA`, `T11FIXB`,
  `T5DEP`). Did not touch the pre-existing leftover baselines on `T11FIXB` (Task 3) or `TEST` (Task
  4) or those locations themselves -- consistent with the same "left inactive-but-undeleted /
  harmless extra baseline, no code impact" precedent already recorded in the Week 5-7 ledger
  entries for those exact locations.
  npm test: 46/46 passing (unchanged). npm run build: clean, all 17 app routes generated.
- Week 7 implementation COMPLETE (2026-07-04)
- Task 5: complete (commit b4e50e0, review N/A -- verification-only task, no separate task reviewer per plan; real headless-Chromium Playwright pass, no product bugs found)

## Week 7 -- FINAL WHOLE-BRANCH REVIEW
- Reviewed range 378df2d..1307528 (opus). Verdict: Ready to merge, no fixes required.
- Confirmed clean cross-task prop wiring (TimelinePage -> GanttChart -> BaselinePanel; [faseSlug]/page.tsx -> ActivityTable -> ActivityRow), isAdmin kept off BaselinePanel's own prop surface per plan, BaselineActivitySnapshot type consistent at every hop, server-side isAdmin/super_admin enforcement backs every client gate (client checks are cosmetic only, not the sole control), zero scope creep against the spec's Out of scope list (no delete-baseline UI, no Kartu Jalur Kritis card, no CPM engine changes), no test files touched (correct reuse of Week 6's computeDeviationDays coverage), no migration added (correct reuse of Week 2 tables).
- Minor (not fixed, accepted): ActivityRow.tsx's Baseline Mulai cell renders a raw ISO date string instead of id-ID locale formatting like BaselinePanel's list -- matches the existing convention for adjacent Rencana date cells, defensible as-is.
- Minor (not fixed, accepted, same as Task 4's own note): baseline/deviation recomputed every render with no memoization -- mirrors existing durasiHK pattern, row counts are tiny.
- Recommendation for Week 8+ backlog (not a Week 7 blocker): the new Deviasi column now visibly surfaces the pre-existing Week 4 CPM auto-scheduler's silent reset of unlocked, no-predecessor activities to earliestStart=0 on any recalculation triggered elsewhere in the location -- previously invisible, now renders as large negative Deviasi values on unrelated rows that will read as data corruption to an admin. Week 7's code is correct (faithfully reporting stored dates); the underlying engine behavior is out of this week's scope per the spec. Recommend a dedicated fix/UX item (e.g. auto-lock or warn on silent resets) for a future week.
- npm test: 46/46 passing. npm run build: clean.
- Week 7 Baseline & Kritis COMPLETE (2026-07-04)

## Week 8
# Plan: docs/superpowers/plans/2026-07-04-minggu8-dashboard.md
# Spec: docs/superpowers/specs/2026-07-04-minggu8-dashboard-design.md
- Task 1: complete (commit 6e58fad, review clean; note: plan prose said "61 total" tests but the plan's own code block has 16 test cases not 15, so 46+16=62 is correct -- not a spec deviation, just an arithmetic slip in the plan text, acknowledged and non-blocking)
- Task 2: complete (commit 44c86e7, review clean)
- Task 3: complete (commit 6d7b53a, review clean)
- Task 4: complete (commit c672605, review clean)
- Task 5: complete (commit e2607f9, review clean)
- Task 6: complete (commit 1350af9, review clean)
- Task 7: complete (commit a611fc7, review clean; minor notes: sort-order manual verification only spanned 3 distinct overdueDays values (weak but adequate sample, deeper check deferred to Task 12); location.description threaded through but not yet rendered by LocationSummaryCard, harmless inert data)
