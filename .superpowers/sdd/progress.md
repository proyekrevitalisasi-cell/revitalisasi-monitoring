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
- Task 8: complete (commit 1d3d792, review clean)
- Task 9: complete (commit ef6c813, review clean; verified via real Playwright browser session across two seeded locations since none had both full 4-phase data and target_kk>0; minor note: ActivityIssueRow-building logic duplicated between this page and Task 7's landing page, pre-existing pattern not introduced by this task, worth a future lib/dashboard-metrics.ts helper extraction; no error handling on Supabase queries, consistent with every other page in this codebase)
- Task 10: complete (commit 2d4437b, review clean; reviewer flagged "Important": overlapping in-flight PATCH requests aren't guarded (a save fired while a prior one is still in-flight could let a stale response stomp newer state) -- verified this is not a new defect: components/activities/ActivityTable.tsx's own established flushSave/debouncedFlush pattern (Week 3) has the exact same characteristic with no in-flight guard, so this is consistent with this codebase's existing debounced-autosave architecture rather than a regression introduced by this task. Accepted as-is, not fixed, same as prior weeks' precedent of accepting issues consistent with established codebase conventions. Minor notes also accepted: setStatus's setTimeout not cleared on unmount; EditableFields could be simplified to a Partial<Pick<...>> alias.)
- Task 11: complete (commit edc0b74, review clean after fix; first implementer incorrectly skipped required manual browser verification claiming a false "headless environment limitation" -- caught by task review, re-dispatched, fix subagent performed real Playwright verification confirming admin editable+debounced-autosave, viewer read-only, and invalid-location 404, all passing; one benign one-time React hydration warning on first navigation, not reproduced on retry, assessed as dev-mode artifact and accepted; a verification-script race briefly left TA's menolak at 1 in the DB, caught via dev-server log and reverted before task completion)
- Task 12: COMPLETE via real headless-Chromium Playwright E2E, driving all 3 rewritten Dashboard
  pages together in one session (landing "/", per-location "/dashboard/CPMTEST",
  "/dashboard/CPMTEST/kk-consent") -- the first pass to exercise them end-to-end as one flow
  rather than per-task in isolation. Test data: used the existing `CPMTEST` location (4 phases,
  26 activities, already had 1 critical-path activity "Permohonan PBG" and 6 overdue
  non-`selesai` activities from earlier weeks' seeding) and additionally PATCHed one activity
  ("Sosialisasi Tahap 1 – Pertemuan warga RT/RW", not yet due) to `ditunda` via an authenticated
  admin request, to get a ditunda case distinct from the overdue cases. `CPMTEST`'s
  `kk_consent.target_kk` was already 0, which happened to fit the brief's target_kk=0 -> set
  nonzero -> bar-appears flow perfectly, so only this one location was needed for the whole
  pass (no second location required).
  All scenarios passed: landing page shows each location card with a progress bar/%, 4 phase
  mini-bars, and correct kritis/ditunda/selesai counts (CPMTEST's card correctly read "1 kritis"
  / "1 ditunda" / "0/26 selesai"); the comparative table rendered 1 row per active location (9);
  the Isu Lintas-Lokasi panel listed 7 CPMTEST rows (6 overdue + 1 ditunda) among 25 total across
  all locations, sorted most-overdue-first (verified the numeric overdueDays sequence is
  non-increasing, with the ditunda row -- which has no overdueDays -- trailing); clicking
  CPMTEST's card navigated to exactly `/dashboard/CPMTEST` (not 404, not a fase-1 redirect); the
  per-location dashboard showed all 4 phase cards (F1 correctly showing its own "1 ditunda"
  badge), the Jalur Kritis card with critical count "1" and a real finish date (`2026-09-24`,
  not "–"), a 5-item Kegiatan Mendatang list, and a 7-row Perlu Perhatian table (with exactly 1
  "Ditunda" badge, the rest as "N hari telat"); the KK Consent summary bar was correctly absent
  while target_kk=0. On the KK Consent page, Target KK/Setuju/Menolak were edited in rapid
  succession (three `.fill()` calls fired back-to-back, all within the 600ms debounce window) --
  confirmed only a single debounced save fired ("✓ Tersimpan" seen once) and, critically, all
  3 fields persisted correctly after reload (target_kk=100, setuju=65, menolak=10, progress text
  "65% (ambang 60%)") rather than only the last-typed field, positively confirming the
  `pendingChanges` ref accumulates across fields as designed rather than each field's onChange
  clobbering the others. Reloading the per-location dashboard then showed the KK Consent summary
  bar now present with the correct "65% (ambang 60%)" text and a working
  `/dashboard/CPMTEST/kk-consent` detail link. The Viewer-role pass confirmed `/` renders
  identically (same 9 cards, same CPMTEST card content byte-for-byte), the per-location dashboard
  renders identically (same 5 section headings + KK bar all present), and the KK Consent page
  renders fully read-only (0 number inputs, 0 textareas, 0 save-status badges, plain-text "100"
  visible for Target KK).
  One console warning was investigated rather than dismissed: `Warning: Extra attributes from
  the server: %s%s style` at KkConsentForm's `<Input>` elements, appearing intermittently
  (reproduced on 2 of 3 full runs) immediately after a hard `page.goto` navigation to
  `/dashboard/CPMTEST/kk-consent`, never on any other page in this app across all 8 weeks of
  Playwright verification. Root-caused via a dedicated diagnostic script
  (`task-12-hydration-check-week8.js`, not committed): the warning only appears when this
  specific route is compiling on-demand for the first time in a cold `next dev` session *while*
  Playwright's navigation is in flight; running the identical navigation sequence (including
  through a client-side card click, matching the main script exactly) against a dev server whose
  routes were pre-warmed via a plain `curl` beforehand produced 0 console errors on repeated
  tries. This is the same class of dev-mode compile/hydration-timing artifact already identified
  in Week 6 Task 12 (there: Fast Refresh racing an in-flight navigation from scratch-file writes;
  here: on-demand route compilation racing an in-flight navigation) -- confirmed non-functional:
  every value-persistence and rendering assertion immediately after this warning still passed in
  every run, including the runs where the warning fired. Not a Week 8 product bug, not fixed (out
  of scope, dev-only artifact that would not occur against a production build).
  Cleanup: reverted CPMTEST's `kk_consent` row (target_kk/setuju/menolak back to 0) and the one
  ditunda-flagged activity (back to `belum_mulai`) via a service-role script
  (`task-12-cleanup-week8.js`, not committed) run after the final verification pass; a follow-up
  inspection query confirmed every active location's `kk_consent.target_kk` and activity
  status/critical/overdue counts exactly match the pre-verification baseline, with `TA` (the
  only location with a genuinely nonzero `target_kk=960`) untouched throughout. No new test
  locations were created for this task (reused the existing `CPMTEST`), so no location
  deactivation was needed. npm test: 62/62 passing (unchanged, no new tests -- this is a
  verification-only task). npm run build: clean, all 17 routes generated.
- Week 8 implementation COMPLETE (2026-07-04)

## Week 8 -- FINAL WHOLE-BRANCH REVIEW
- Reviewed range 3038522..d9e5cac (opus). Verdict: Ready to merge, no fixes required.
- Confirmed ActivityIssueTable genuinely works correctly under both showLocation values with no leaked assumptions between the two call sites, clean pure-logic/presentational layering per lib/dashboard-metrics.ts + components/dashboard/*, correct reuse of PHASE_COLORS/useDebouncedCallback/SaveStatusBadge/Progress, KkConsentForm correctly follows the required per-field isAdmin-gating convention (not an all-or-nothing gate), zero scope creep against the spec's Out of scope list, testing/migration discipline held (only lib/dashboard-metrics.test.ts touched, no migrations).
- Verified both carried-over task-review flags hold as accepted precedent, not regressions: (1) KkConsentForm's overlapping in-flight PATCH race structurally matches ActivityTable.tsx's own pre-existing Week 3 flushSave pattern; (2) Task 11's final committed page code is correct regardless of that task's verification-process detour.
- Minor (not fixed, accepted): ActivityIssueRow-building logic duplicated between app/(app)/page.tsx and app/(app)/dashboard/[locationCode]/page.tsx -- now confirmed at 2 call sites, worth a shared lib/dashboard-metrics.ts helper in a future week.
- Minor (not fixed, accepted): KkConsentForm doesn't revert optimistic state on a failed save (leaves the unpersisted value on screen until next edit/reload) -- a real parity gap vs ActivityTable's snapshot-revert-on-error, low blast radius (admin-only, visible error toast), worth fixing in a future pass.
- Minor (not fixed, accepted): landing page's nested phases query has no explicit ordering (unlike the per-location page's .order('display_order')), so LocationSummaryCard's mini phase-bars could render out of F1-F4 order depending on PostgREST's return order -- cosmetic only, each bar is still correctly colored/labeled by its own phase_code.
- Minor (not fixed, accepted): isNeedsAttention's "< today" rule means an activity due exactly today shows "0 hari telat" rather than being excluded -- faithful to the approved spec wording, flagged only as a UX nuance to confirm is intended.
- Minor (not fixed, accepted, same precedent as Week 7): raw ISO date strings render unformatted in ActivityIssueTable/UpcomingActivitiesPanel/CriticalPathCard, matching the already-accepted Week 7 convention.
- npm test: 62/62 passing. npm run build: clean.
- Week 8 Dashboard COMPLETE (2026-07-04)

## Week 9
# Plan: docs/superpowers/plans/2026-07-04-minggu9-risk-register.md
# Spec: docs/superpowers/specs/2026-07-04-minggu9-risk-register-design.md
- Task 1: complete (commit 9789e99, review clean; minor notes accepted: getScoreBandClasses has no direct unit test per brief's own scope, no input clamping outside 1-25 domain, both matching the brief's literal reference implementation)
- Task 2: complete (commit bebc48b, review clean; minor note accepted: implicit any on json.res() is a pre-existing pattern copied verbatim from DeleteActivityDialog.tsx, not a regression)
- Task 3: complete (commit 761844e, review clean; reviewer independently cross-checked the create-vs-edit null/undefined field handling against createRiskSchema/updateRiskSchema in lib/validations.ts, confirmed correct in both directions; minor notes accepted: no Label/Input id association, no scroll wrapper for the modal on short viewports)
- Task 4: complete (commit d04a9d4, review clean; reviewer confirmed row/column ordering, getScoreBandClasses signature match, and correctly-omitted toggle logic left to the future parent component)
- Task 5: complete (commit 717bf43, review clean; reviewer independently re-ran npm run build, cross-verified DeleteRiskDialog prop contract and the score GENERATED column round-trip through PATCH; minor note accepted: savingId disables both Probabilitas/Dampak selects together per-row rather than per-cell, matches brief verbatim)
- Task 6: complete (commit cde6db1, review clean; reviewer independently verified the critical baseFiltered-to-RiskMatrix / tableFiltered-to-RiskTable prop wiring in the actual JSX -- not swapped -- plus toggle-off logic and all 3 consumed component prop signatures; minor notes accepted: category/status option lists triplicated across RiskRegisterClient/RiskFormModal/RiskTable, plan-mandated verbatim not an implementer deviation)
- Task 7: complete (commit 688debc, review clean; reviewer confirmed the page precisely mirrors Week 8's per-location dashboard query pattern, per-phase display_order sort applied before flattening not a global sort, RiskRegisterClient prop signature verified field-by-field. npm test: 68/68 passing. npm run build: clean, route /dashboard/[locationCode]/risks generated. npm run lint: clean.)
- Week 9 Risk Register implementation COMPLETE (2026-07-04)
- Task 8: complete -- final real-browser E2E pass via headless Chromium Playwright
  (.superpowers/sdd/task-8-e2e.js, not committed), driving admin create/read/filter/inline-edit/
  edit-modal/delete flows plus a Viewer read-only pass, all in one disposable 4-phase test
  location (T9RISK, deactivated afterward). Test data: 6 risks created through the real
  "+ Tambah Risiko" UI across 3 phases (F1/F2/F3) and 5 categories, landing in all 3 score bands
  (low/medium/high) each in a distinct matrix cell, plus 2 risks re-statused via the edit modal
  (Mitigated, Closed) so all 3 statuses were represented. All scenarios passed: table renders
  correct Kategori/Fase/Skor(+color)/Status for all 6 rows; matrix shows count "1" in exactly the
  6 occupied cells with band-correct color and blank elsewhere; clicking a matrix cell filters the
  table to that exact PxD combo and applies the active ring, clicking again restores all rows and
  removes the ring; the Fase filter narrows both table and matrix to one phase and resets cleanly;
  an inline Probabilitas change fires a success toast and updates the Skor cell's number/color
  live (verified again after a hard reload) with the matrix shifting accordingly; the Edit modal
  pre-fills correctly with the Fase selector absent and Status now editable, and a Mitigasi+Status
  change saves and reflects in the row; Delete names the correct risk in its confirm dialog and
  removes the row while decrementing the matrix cell; the Viewer pass showed the same data with 0
  inline Select comboboxes (plain numbers), no Aksi column, no "+ Tambah Risiko" button, while
  matrix click-to-filter still worked (not role-gated). Bonus: confirmed the Sidebar's "Risk
  Register" nav link (from Task 7) routes correctly. Zero console errors across the whole run. No
  bugs found -- all 7 implementation tasks integrate cleanly on the first full pass. Cleanup:
  DELETE /api/locations/{id} as super_admin succeeded, final GET /api/locations sweep confirmed
  T9RISK no longer present; no shared locations touched.
- Week 9 Risk Register COMPLETE (2026-07-04)

## Week 9 -- FINAL WHOLE-BRANCH REVIEW
- Reviewed range 83b2231..f2134c7 (opus). Verdict: Ready to merge, Yes, no fixes required.
- Confirmed the two-layer filtering (RiskMatrix reads baseFiltered, RiskTable reads tableFiltered) composes correctly end-to-end from RiskRegisterClient, re-verified the create-vs-edit null/undefined field handling against createRiskSchema/updateRiskSchema in lib/validations.ts holds at the whole-feature level, confirmed both API routes return full rows via .select('*') so optimistic {...json.data, phaseCode} reconstruction in onSaved/onUpdated is sound, confirmed role gating (all-or-nothing for action buttons, per-field degrade-to-text for inline Probabilitas/Dampak) is consistently applied, confirmed zero scope creep against the spec's Out of scope list.
- Minor (not fixed, accepted, same as task-level reviewers' notes): Kategori/Status option lists duplicated across RiskFormModal/RiskTable/RiskRegisterClient -- plan-mandated verbatim from the plan's own code blocks, recommended future-week extraction to lib/risk-labels.ts, not a Week 9 blocker.
- Minor (not fixed, accepted): a newly-created risk is appended to the end of the flat client-side list (handleSaved's [...prev, saved]) rather than re-sorted by phase/display_order, so it can render out of phase order until reload -- cosmetic only, # column is positional not an identifier.
- Minor (not fixed, accepted): deleting or inline-editing the last risk out of the currently active matrix-filtered cell doesn't clear matrixFilter, so the cell can keep its active ring over an empty table state -- self-corrects on next click.
- Minor (not fixed, accepted, plan-mandated): getScoreBandClasses has no direct unit test, only getScoreBand's boundaries are tested -- matches the brief's own scope, mapping is trivial and exercised by both consumers.
- npm test: 68/68 passing. npm run build: clean, all 18 routes generated. npm run lint: clean.
- Week 9 Risk Register COMPLETE (2026-07-04)

## Week 10
# Plan: docs/superpowers/plans/2026-07-05-minggu10-pm-views.md
# Spec: docs/superpowers/specs/2026-07-05-minggu10-pm-views-design.md
- Task 1: complete (commit 9d04848, review clean; reviewer independently verified overlap-detection logic and computeProgressPct reuse; minor note accepted: implementer report miscounted field count in prose, code itself correct)
- Task 2: complete (commit 8597b89, review clean; reviewer programmatically cross-checked all 33 entries against supabase/seed.sql, zero mismatches)
- Task 3: complete (commit 3b74bdd, review clean; reviewer traced every remaining `today` reference in the file to confirm no stray un-shifted date leaked into the terlambat check or week bounds, confirmed weekOffset=0 is byte-for-byte backward compatible)
- Task 4: complete (commit 24955ea, review clean; reviewer independently verified all 4 consumed lib/workload-metrics.ts signatures and WorkloadActivity fields against real source, confirmed selected-cell state stays self-contained per spec; minor notes accepted, both plan-mandated: count-0 cell still shows clickable-looking green styling (no disabled attr), sticky PIC column hardcodes bg-white with no dark-mode variant)
- Task 5: complete (commit 7c99d06, review clean; reviewer ran npm run lint directly to investigate 2 react-hooks/exhaustive-deps warnings on `today` inside useMemo -- confirmed warnings not errors (exit 0), confirmed no real stale-closure risk given component mount lifecycle, plan-mandated verbatim from the brief; reviewer independently verified date-range overlap filter logic (not "starts within") and all 4 consumed lib/workload-metrics.ts + WorkloadHeatmap signatures against real source. Minor note accepted: exhaustive-deps warnings will persist in lint output, cosmetic cleanup candidate for a future week)
- Task 6: complete (commit 3fe13b9, review clean; reviewer confirmed query/flattening shape mirrors app/(app)/page.tsx exactly, WorkloadActivity field set and WorkloadClient prop wiring both verified against real source, no filtering leaked to page level)
- Task 7: complete (commit a24f5fc, review clean; reviewer independently hand-verified the leadingBlanks Monday-first alignment formula across 4 real dates spanning different weekdays via node, plus algebraically for all 7 getDay outputs -- confirmed correct; confirmed DeleteHolidayDialog's children-as-trigger pattern and absence of isAdmin gating both match brief intentionally. Minor notes accepted, both plan-mandated verbatim: holiday day-cells are mouse-only (no keyboard focus/tabIndex), redundant startOfMonth call on an already-month-start value)
- Task 8: complete (commits 1ac3837+964c811, review after fix: reviewer flagged Important plan-mandated issue -- import loop lumped genuine failures into the "already exists" toast count, misleading since client-side pre-filtering makes a 400-during-import more likely a real error than a true duplicate; user chose to fix rather than accept; fix separated skippedExisting/failed counters via exact string match on the route's 'Tanggal sudah ada' literal, re-review independently verified the literal matches app/api/work-calendar/route.ts byte-for-byte, approved clean)
- Task 9: complete (commit 22add1c, review clean; reviewer verified all 3 consumed component prop signatures against real source, confirmed no isAdmin gating leaked in, confirmed existingDates deliberately spans all years not just the displayed year for correct duplicate-checking during import)
- Task 10: complete (commit 83b40ff, review clean; SECURITY-CRITICAL first whole-page role gate in this codebase -- reviewer verified gate ordering line-by-line (getSession -> role check -> notFound() throw -> only then Supabase query and JSX), confirmed notFound imported from next/navigation (real throwing 404, not the local API-route helper of the same name), confirmed isAdmin() reused unmodified covering both admin+super_admin. Minor note accepted: `if (...) notFound()` has no explicit `return` -- functionally safe since notFound() always throws, but flagged for future admin-gate copy-paste clarity. This security property is NOT yet automated-test-covered -- Task 13's E2E pass must explicitly verify Viewer gets 404 on direct /work-calendar navigation)
- Task 11: complete (commit e1cdc8a, review clean; reviewer independently traced the cancelled-flag race-condition guard closure-by-closure across all 3 state-mutation call sites, confirmed sound for rapid week-navigation double-clicks; confirmed weekOffset stays internal state not a prop. Minor notes accepted: stale previous-week data can briefly linger alongside an already-advanced week label on a failed fetch (inherent to the brief's own code); overall_pct/phase_progress type fields are intentionally unused in this component -- the WA text box already surfaces that info in text form, no separate summary panel was planned)
- Task 12: complete (commit 47aeedf, review clean; reviewer confirmed WeeklySummaryClient prop match, confirmed Sidebar edit is a single clean insertion with no corruption to the 6 surrounding NavLink lines shared across every prior week's tasks. npm test: 83/83 passing. npm run build: clean, route /dashboard/[locationCode]/weekly-summary generated. npm run lint: clean.)
- Task 13: complete -- real-browser Playwright pass (see .superpowers/sdd/task-13-report.md) covering Workload View (PIC cards, 12-week heatmap with all 3 bands, cell-detail dialog cross-location aggregation, Lokasi/Fase/date-range filters), Kalender Kerja (add/delete/import/year-nav), and Weekly Summary (4 panels, week-nav, clipboard copy, Sidebar link), all cross-checked against hand-computed expected values, not just visual presence. SECURITY CHECK PASSED: Viewer navigating directly to /work-calendar by URL gets a real Next.js 404 (verified HTTP status, unredirected URL, not-found page text, and absence of any Kalender Kerja UI) -- closes the gap flagged by Task 10's reviewer. Found and fixed 2 real bugs during this pass: (1) components/layout/Sidebar.tsx -- the location-code regex `[A-Z]+` truncated any code containing a digit (e.g. T13WK, and pre-existing T5DEP/T11FIXA/T11FIXB) to just its leading letters, silently breaking every location-scoped sidebar link including this week's new "Ringkasan Mingguan"; fixed to `[A-Z0-9]+`, re-verified live. (2) lib/cpm-runner.ts -- CROSS-TASK bug between Kalender Kerja and Weekly Summary: runCpmForAllActiveLocations (triggered by any holiday add/delete/import) unconditionally stamped updated_at/updated_by on every activity in every active location regardless of date_locked or whether anything actually changed, and Weekly Summary's "Selesai Minggu Ini" panel reads updated_at as "completed this week" -- so an admin editing next year's holidays would silently make every already-completed activity in every other location look freshly done; fixed to only stamp updated_at/updated_by when an activity's CPM-derived state (shifted dates, critical-path flag, or float days) actually changed. Verified via a controlled before/after check (own test activity's updated_at held constant across the Step 3 holiday mutations post-fix); could not reproduce the visible week-boundary symptom against real data since every existing seeded location currently has zero `selesai` activities. npm test: 83/83 passing. npm run build: clean. npm run lint: clean (pre-existing unrelated warnings only). npx tsc --noEmit: clean. One console entry logged across the whole run: the expected 404 resource-load message from the Viewer security check itself -- not a bug. Test data (2 disposable locations, 1 disposable holiday) fully cleaned up and verified via final GET sweeps.
- Week 10 PM Views COMPLETE (2026-07-05)
- Task 13 fix review (opus, high scrutiny given lib/cpm-runner.ts is the Week 4 core CPM engine unchanged since): Approved. Verified the actual CPM date-shifting math and date_locked gating are byte-identical to before -- only the conditions for including updated_at/updated_by in the update payload changed. Verified the `changed` predicate (shifted || critical-path changed || float changed) is complete against the full set of columns this function ever writes -- no persisted-state change can occur without `changed` becoming true. Verified no stale-baseline risk (SELECT happens once per call, comparison precedes the UPDATE). Verified activities.updated_at has exactly one semantic reader in the whole codebase (weekly-summary's selesai_minggu_ini panel) and confirmed no DB trigger exists that could bump updated_at behind the app's back (checked migrations for BEFORE UPDATE triggers -- none on activities). Verified shiftedCount/CpmSummary shape and the ActivityTable toast consumer are unaffected. Sidebar.tsx regex fix confirmed correctly bounded, not over-permissive. One non-blocking recommendation (not fixed): lib/cpm-runner.ts has zero unit-test coverage -- this fix is reasoned-safe from source analysis, not regression-tested; a future week should add a test asserting "unchanged activity => no updated_at in the update payload" now that this file has been touched for the first time since Week 4.

## Week 10 -- FINAL WHOLE-BRANCH REVIEW
- Reviewed range 3e4c317..9f1f929 (sonnet, after an initial opus attempt hit session limit mid-review). Verdict: Ready to merge, Yes, no fixes required.
- Independently re-ran the full suite (83/83 passing) and npm run build (clean, all 19 routes including /workload, /work-calendar, /dashboard/[locationCode]/weekly-summary). Confirmed WorkloadClient's filtered activity list feeds both buildPicWorkload (rows) and WorkloadHeatmap's activities prop identically, so the cell-detail dialog always matches the count that produced it. Confirmed WorkCalendarClient's add/delete/import callbacks all mutate the single full holidays list (not a year-scoped copy), keeping year-nav in sync. Confirmed /work-calendar's whole-page admin gate is the ONLY gating-convention deviation in the diff -- grepped to confirm neither Workload nor Weekly Summary (both all-roles) picked up accidental admin gating. Re-verified at whole-branch level that shiftedCount/updatedActivities (the ActivityTable toast) are still driven purely by `shifted`, unaffected by the cpm-runner fix's new updated_at gating. Grepped for other [A-Z]+-style regexes that might share the Sidebar truncation bug -- none found, confirming that fix's scope was complete. Confirmed zero migrations touched, out-of-scope list fully honored.
- Minor (not fixed, accepted, pre-existing not introduced this week): weekly-summary API response includes an untyped `location` field WeeklySummaryData doesn't declare (harmless, ignored by the cast); PHASE_OPTIONS hardcoded in WorkloadClient rather than derived from a shared constant, same accepted duplication pattern flagged since Week 9's category/status lists.
- Recommendation (not applied): add the cpm-runner.ts regression test recommended by Task 13's dedicated fix review, now that this file has real branching logic again for the first time since Week 4.
- npm test: 83/83 passing. npm run build: clean, 19 routes. npm run lint: clean.
- Week 10 PM Views COMPLETE (2026-07-05)

## Week 11
# Plan: docs/superpowers/plans/2026-07-05-minggu11-raci-pelaporan.md
# Spec: docs/superpowers/specs/2026-07-05-minggu11-raci-pelaporan-design.md
- Task 1: complete (commit 3c324e0, review clean; reviewer confirmed all 6 types match brief verbatim, append-only, no existing type modified, style consistent)
- Task 2: complete (commit f151869, review clean; reviewer confirmed byte-for-byte match to DeleteRiskDialog pattern, "×" trigger per PRD, correctly wired to existing DELETE /api/stakeholders/[id])
- Task 3: complete (commit 1fa3738, review clean; reviewer confirmed verbatim match to brief, self-contained add-only trigger correctly contrasted with RiskFormModal's create+edit pattern, POST payload fields match Stakeholder type exactly)
- Task 4: complete (commit 101480c, review clean; reviewer verified PUT body shape against upsertRaciSchema and route.ts exactly, sentinel 'NONE'->null mapping never leaks past the component boundary, canEdit=false renders plain text not disabled control)
- Task 5: complete (commit cb744c4, review clean; reviewer verified all RaciCell/DeleteStakeholderDialog/type prop signatures match exactly, no re-sort of caller-given order, reorder button boundary disable logic correct, legend present per PRD)
- Task 6: complete (commit 2e4a98b, review clean; reviewer hand-traced location filtering (zero network calls), cell-update null/replace logic, reorder boundary no-ops and full-revert-on-failure, nextDisplayOrder computation -- all correct. Minor accepted note, plan-mandated: partial PATCH failure during reorder swap can leave DB with inconsistent display_order since no dedicated reorder endpoint exists this week; client-side state correctly reverts but server-side desync isn't client-fixable)
- Task 7: complete (commit 9b037ec, review clean; reviewer confirmed nested query shape locations->phases->raci_entries matches WorkloadPage's precedent exactly, zero client-side re-fetch on location switch, canEdit correctly guards no-profile case, RaciClient prop wiring matches exactly)
- Task 8: complete (commit e0ff2ff, review clean; reviewer confirmed hard-delete target route.ts has no is_active field, 🗑️ trigger correctly used vs "x" for stakeholders, verbatim match to DeleteRiskDialog pattern)
- Task 9: complete (commit 0e8cf4f, review clean; reviewer verified against lib/validations.ts that createReportingItemSchema/updateReportingItemSchema have no null-vs-undefined subtlety unlike RiskFormModal, confirming the flat form object is correctly reused unchanged across create/edit. Minor accepted note, plan-mandated (present in brief's own code): client validation only checks non-empty, jenis_laporan server schema requires min 2 chars -- a 1-char value would pass client and fail server with raw Zod message)
- Task 10: complete (commit c3d2a18, review clean; reviewer verified prop shapes against both ReportingItemFormModal and DeleteReportingItemDialog exactly, confirmed no reorder logic anywhere, role gating correctly omits all admin controls entirely for non-admins, upsert/append logic in handleSaved correct)
- Task 11: complete (commit f7dad1f, review clean; reviewer confirmed query is genuinely flat like work-calendar/page.tsx, not nested like raci/page.tsx, select fields match ReportingItem exactly, canEdit and PelaporanClient prop wiring correct)
- Task 12: complete -- real-browser Playwright pass (see .superpowers/sdd/task-12-report.md) covering RACI (/raci: location select defaulting to first active location, matrix cell dropdown set/clear with server-side persistence verified via direct GET /api/phases/{id}/raci, cross-location independence confirmed with zero network requests during the location switch, ▲ reorder with persistence across a full reload, "x" stakeholder delete with a correctly-named confirmation dialog, legend + full stakeholder list rendering, Viewer parity showing plain R/A/C/I/- text with zero admin controls) and Pelaporan (/pelaporan: add via modal, edit via modal pre-filled with the just-entered values, delete with a correctly-named confirmation dialog, Viewer parity with no Aksi column and no add button). Zero browser console errors across the whole run. No product bugs found or fixed this pass -- only test-script issues were found and fixed in the throwaway E2E script itself (not application code): a stakeholder-code reuse collision since stakeholders.code is UNIQUE and soft-delete doesn't free it (same precedent as Week 10 Task 13's locations), a RegExp substring collision matching "CPMTEST" when targeting the "TEST" location, and a Pelaporan viewer-parity check that needed to run before (not after) deleting the test row since reporting_items has 0 seeded rows in this environment and PelaporanClient renders no <table> at all when the list is empty. All test data (2 disposable stakeholders, 1 disposable reporting item) fully cleaned up and verified via final GET sweeps; no disposable location was created (two existing active test locations were reused instead, left untouched). npm test: 83/83 passing (no code changes this task).
- Week 11 RACI & Pelaporan COMPLETE (2026-07-05)

## Week 11 -- FINAL WHOLE-BRANCH REVIEW
- Reviewed range 796ee0f..e4bb0cf (opus). Verdict: Ready to merge, With fixes (one trivial one-liner), Yes otherwise.
- Confirmed zero prop-shape drift across the incrementally-built RaciCell->RaciMatrix->RaciClient->page and DeleteReportingItemDialog/ReportingItemFormModal->PelaporanClient->page stacks. Confirmed role-gating (admin controls entirely omitted, not disabled) uniform across both features. Confirmed no @dnd-kit import anywhere, no new API routes/schemas/migrations, Sidebar's pre-existing /raci and /pelaporan dead links now resolve unmodified. Noted RaciCell actually waits for server confirmation before updating (stricter than spec's "optimistic update, revert on failure" -- no revert logic needed since there's nothing to revert).
- Found 1 real cross-task inconsistency invisible to per-task review: ReportingItemFormModal only checked non-empty while sibling AddStakeholderModal correctly mirrors server min-length schema client-side -- fixed (commit 9729e4e, adds jenis_laporan.trim().length < 2 check matching createReportingItemSchema's min(2)). npm build clean, npm test 83/83 passing after fix.
- Re-examined Task 6's accepted note at whole-branch level: sharpened characterization -- partial reorder-PATCH failure doesn't just leave "inconsistent" display_order, it leaves a genuine DUPLICATE display_order value in the DB (both rows holding the neighbor's order), making the next reload's sort order ambiguous. Self-healing on next successful reorder, admin-only/low-frequency, remains accepted under this week's "no new endpoint" constraint -- flagged for whoever adds a transactional reorder endpoint in a future week.
- Recommendation (not applied, matches existing cpm-runner.ts recommendation from Week 10): RaciClient's handleReorder (swap+sort) and handleCellChanged (filter-then-conditionally-append) are pure array-transform logic living untested inside a component, the same category risk-utils.ts/workload-metrics.ts were extracted-and-Vitest-tested for in prior weeks. Covered by Task 12's E2E, not a merge blocker.
- Confirmed per-feature delete-dialog duplication (DeleteStakeholderDialog/DeleteReportingItemDialog near-identical to each other and to DeleteRiskDialog/DeleteHolidayDialog) is established codebase precedent, not new debt.
- Week 11 RACI & Pelaporan COMPLETE (2026-07-05)

## Week 12
# Plan: docs/superpowers/plans/2026-07-05-minggu12-audit-users.md
# Spec: docs/superpowers/specs/2026-07-05-minggu12-audit-users-design.md
- Task 1: complete (commit 3422942, review clean; reviewer confirmed diff is purely additive to existing audit-logs route -- entity_type/user_id/from/to filters untouched, action filter added symmetric with existing pattern, old_value/new_value added to select, 6 new types match brief field-for-field verbatim; verified live via real HTTP calls with session cookie, not just code-reading)
- Task 2: complete (commit 91916d2, review clean; reviewer confirmed formatValue null-handling, dialog controlled purely by entry!==null, no crash paths on null entry)
- Task 3: complete (commit 372899b, review clean; reviewer confirmed ACTION_CLASSES Record covers all 7 AuditAction members exactly, pagination math correct for total=0 and non-exact-division, boundary disable logic correct, empty state handled before table renders. Minor note: stale page after filter-shrinks-results is a non-issue since Task 5's plan already resets page to 1 on filter change)
- Task 4: complete (commit 025c6e6, review clean; reviewer independently grepped every entityType literal across the codebase and confirmed all 12 ENTITY_TYPES values match exactly, ACTIONS matches AuditAction union verbatim, set() helper correctly spreads full state before overwriting one key)
