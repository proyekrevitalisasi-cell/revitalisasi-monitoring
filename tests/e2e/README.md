# E2E Test Suite (Playwright)

**Bare `npm run test:e2e` (i.e. `playwright test` with no file argument) is NOT a safe way to run the
whole suite.** It runs every project together — including `fixtures-teardown` as an ordinary project
(it would delete the shared `E2ESH` fixture mid-run) and `chromium` with no ordering guarantee relative
to `fixtures-setup` — and it combines many spec files in one process, which triggers the session-staleness
issue described below. Use it only for a single targeted file during development (see below), and use the
file-by-file loop for anything that needs to be trusted as a real pass/fail signal.

## Project pipeline

`playwright.config.ts` defines four projects:

1. **`setup`** — logs in as all 3 seed roles (`superadmin`, `admin`, `viewer`) and persists
   `storageState` to `tests/e2e/.auth/*.json`.
2. **`fixtures-setup`** — creates the shared throwaway location fixture (`E2ESH`, 4 phases) via API
   and writes `tests/e2e/.fixtures/shared-location.json`. Depends on `setup`.
3. **`chromium`** — runs every `*.spec.ts` file. **Deliberately NOT wired via `dependencies`/`teardown`**
   to `fixtures-setup`/`fixtures-teardown` — see the comment above the `projects` array in
   `playwright.config.ts` for why (Playwright reruns a project's dependencies and teardown on every
   invocation, even for a single-file run, which broke re-runs and silently deleted the shared fixture).
4. **`fixtures-teardown`** — hard-deletes the shared `E2ESH` location.

Because `chromium` has no automatic dependency wiring, you are responsible for running `setup` and
`fixtures-setup`/`fixtures-teardown` yourself, in the right order, as described below.

## Running a single spec file during development

```bash
npx playwright test --project=setup
npx playwright test <file>.spec.ts
```

`--project=setup` refreshes all 3 role `storageState` files. This is required before every spec file
run, not just the first: Supabase Auth rotates refresh tokens on use, so a stored `storageState` file's
session is invalidated as soon as any earlier test uses it, and a second run against stale
`.auth/*.json` files can silently fail (viewer/admin pages redirect to `/login`, buttons/links time out).

This assumes the shared `E2ESH` fixture already exists (see "Tearing down / recreating the shared
fixture" below if you're starting from a clean database, e.g. after a `fixtures-teardown`).

`npm run test:e2e -- <file>.spec.ts` is equivalent to the second command above and is fine for this
single-file use case, as long as fixtures are already in place.

## Running the full suite reliably

Do **not** run `--project=setup --project=fixtures-setup --project=chromium` combined in one command,
and do not run bare `playwright test` / `npm run test:e2e`. Combining projects gives no ordering
guarantee between them, and a single long-running combined `chromium` pass across all spec files
exhausts the shared `storageState` snapshot partway through — Supabase's refresh-token rotation is
never written back to disk, so a long-enough run produces an unpredictable (non-monotonic) scatter of
401/redirect-to-`/login` failures unrelated to any real bug.

The only reliable way to run the full suite is one spec file at a time, with a fresh login
(`--project=setup`) immediately before each file:

```bash
npx playwright test --project=fixtures-teardown   # start from zero if E2ESH already exists
npx playwright test --project=setup --project=fixtures-setup
for f in auth locations-fase dependencies-cpm timeline-gantt baseline-kritis dashboard risks workload-calendar-summary raci-pelaporan audit-users kk-consent; do
  npx playwright test --project=setup
  npx playwright test "$f.spec.ts"
done
```

(This is the exact loop used for every task's verification and for the full-suite pass in
`docs/superpowers/plans/2026-07-06-minggu13-e2e-testing.md`'s Task 13.)

`timeline-gantt.spec.ts`'s dependency-arrow-tooltip test is expected to `test.skip` when run this way —
`dependencies-cpm.spec.ts`'s own `afterAll` deletes its dependencies before `timeline-gantt.spec.ts`
starts. That's a known, accepted, non-blocking gap, not a failure.

If a file fails, first re-run that single file in isolation with a fresh `--project=setup` immediately
before it. If it now passes, the earlier failure was session staleness from a combined/long run, not a
real issue. Only trust a failure that persists in an isolated, freshly-logged-in re-run.

## Tearing down / recreating the shared `E2ESH` fixture

```bash
npx playwright test --project=fixtures-teardown              # deletes E2ESH and its phases
npx playwright test --project=setup --project=fixtures-setup # recreates it fresh
```

Run teardown at the very end of a full-suite session (not between individual spec files — most spec
files in this suite depend on `E2ESH` existing throughout their run via `getSharedLocation()`).
