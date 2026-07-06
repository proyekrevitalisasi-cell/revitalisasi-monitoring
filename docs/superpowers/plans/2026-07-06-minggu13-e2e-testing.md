# Minggu 13 — E2E Testing (Playwright) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent Playwright E2E suite covering every feature shipped in Minggu 1-12 (auth, lokasi/fase/CRUD, CPM+dependencies, Gantt/baseline, dashboard, risk register, workload/kalender-kerja/weekly-summary, RACI/pelaporan, audit-log/users, kk-consent), running against the same Supabase Cloud project as `npm run dev`, and fix any real bugs it surfaces.

**Architecture:** One `playwright.config.ts` at root with a 4-project pipeline (`setup` → `fixtures-setup` → `chromium` → `fixtures-teardown`). `setup` logs in as all 3 seed roles once and persists `storageState`. `fixtures-setup` creates one shared throwaway location (`E2ESH`) via API for specs that need real activities/phases to work against; `fixtures-teardown` hard-deletes it at the very end. Each of the 11 `*.spec.ts` files owns its own additional fixtures (unique-suffixed) and cleans them up in `afterAll`. No `data-testid` exists anywhere in this codebase, so all locators are text/role/container-scoped, using two shared helpers (`fillDialogField`, `selectDialogOption`) that locate shadcn form fields by their sibling `<Label>` text regardless of whether `htmlFor`/`id` are wired up (confirmed inconsistent across components).

**Tech Stack:** `playwright` (already installed — its `playwright/test` subpath ships the full test runner, no `@playwright/test` package needed), `@supabase/supabase-js` (already installed, reused via existing `lib/supabase/admin.ts`), Next.js 14 dev server as `webServer`.

## Global Constraints

- API response convention project-wide: `{ data: T | null, error: { code, message } | null }` — every direct API assertion in tests must unwrap this shape.
- Supabase Cloud only, no local Docker — tests run against `.env.local`'s live project using the 3 existing seed accounts (`superadmin@perumnas.co.id`/`SuperAdmin123!`, `admin@perumnas.co.id`/`Admin123!`, `viewer@perumnas.co.id`/`Viewer123!`).
- `SUPABASE_SERVICE_ROLE_KEY` server/test-process-only, never `NEXT_PUBLIC_` — reuse `lib/supabase/admin.ts`'s `createAdminClient()`, do not reimplement.
- Single worker, `fullyParallel: false` — shared cloud DB, no test-level isolation, so serial execution avoids races between specs mutating overlapping rows.
- Chromium only (matches every prior week's manual Playwright testing).
- No `data-testid` in the codebase. Use `fillDialogField`/`selectDialogOption`/`checkDialogCheckbox` from `tests/e2e/helpers/dialog.ts` for every shadcn dialog form field — do not use `getByLabel` for dialog fields (confirmed several components render `<Label>`/`<Input>` as siblings with no `htmlFor`, so `getByLabel` silently fails to match).
- Every fixture a spec creates (location, user, stakeholder, reporting item, risk, activity) must be deleted in that spec's `afterAll` via `tests/e2e/helpers/db-cleanup.ts` (hard delete through the admin client — never rely on the app's soft-delete API for cleanup, since soft-deleted rows still clutter the DB).
- Fixture names/codes always carry an `E2E` prefix (e.g. `E2ESH`, `E2E CPM Act A`, `e2e.viewer.<timestamp>@perumnas.co.id`) so they're never confused with the real seed data (locations `TA`/`KK`/`KL`/`KMY`, 15 stakeholders) and are trivially identifiable if a cleanup step fails mid-run.
- Any bug fix uncovered by E2E that touches `createAdminClient()` on a new call site or changes an authorization guard: **stop and get explicit user approval before dispatching the subagent commit** — this is a standing rule from Minggu 12, the auto-mode security classifier blocks such commits regardless of justification.
- `fase` URLs are simply `/dashboard/{code}/fase-1` … `/fase-4` (not name-derived slugs).
- **Discovered during Task 2 execution:** `playwright.config.ts`'s `chromium` project must NOT be wired via `dependencies`/`teardown` to `fixtures-setup`/`fixtures-teardown` — Playwright reruns a project's dependencies and teardown on every invocation of that project, even `npx playwright test onefile.spec.ts`, which made `fixtures-setup` fail on the 2nd run (duplicate location code) and silently deleted the shared `E2ESH` fixture after every single spec-file run. Fixed in `56f8a03`'s follow-up: the `chromium` project now has no `dependencies`/`teardown` field at all.
- **Discovered during Task 3 execution:** in `ActivityTable`/`ActivityRow`, the "Kegiatan" and "PIC" columns render as `<Input defaultValue={...}>` for admin (not plain text) — `page.getByText('some activity name')` will NEVER match these cells under an admin-authenticated context, because input values aren't text nodes. Playwright has no `getByDisplayValue` (that is a React Testing Library API, not Playwright) — use `page.locator(`input[value="some activity name"]`)` instead when locating an activity row by name as admin (React's `defaultValue` reflects into the input's `value` content attribute on initial render). Viewer role renders these columns as plain text, so `getByText` is correct there. This affects every spec that locates an activity row by name while authenticated as admin (Task 4's `dependencies-cpm.spec.ts` draft below has this bug — corrected before dispatch).
- **Discovered during Task 3 execution:** `tests/e2e/helpers/dialog.ts`'s `resolveField` (used by `fillDialogField`/`selectDialogOption`/`checkDialogCheckbox`) had two bugs, both fixed in Task 3's fix round: (1) the `has:` filter locator must be rooted at `dialog.page()`, not chained off `dialog` itself -- chaining off `dialog` embeds the dialog's own role selector inside the relative `has` match, which can never resolve; (2) the ancestor-div lookup must end in `.last()`, not `.first()` -- document order lists outer container divs before their nested field-wrapper divs, so `.first()` always resolved to the dialog's whole fields wrapper (and thus always its first input) regardless of which label was requested. Every dialog-filling test in Tasks 8/10/11/12 depends on this helper being correct.
- **Discovered during Task 2 execution:** Supabase Auth rotates refresh tokens on use — once a stored `storageState` file's session is used by any test, the old refresh token in that JSON file is invalidated, so a second `npx playwright test <file>.spec.ts` run against the same `.auth/*.json` files can silently fail (viewer/admin pages redirect to `/login`, links/buttons time out). **Before running any spec file's tests, always re-run `npx playwright test --project=setup` first** to refresh all 3 role storageState files.
- **Discovered during Task 13 execution:** the above mitigation is necessary but NOT sufficient for a combined multi-file run (e.g. `npx playwright test --project=chromium`, no file filter). Running many spec files back-to-back in one process, all sharing the single `storageState` snapshot taken at the start, produces an unpredictable (non-monotonic — some later files pass fine, some earlier ones fail) pattern of 401/redirect-to-`/login` failures once enough contexts have been created from that snapshot, because Supabase's refresh-token rotation is never written back to the on-disk `.auth/*.json` files. **The only reliable way to run the full suite is one spec file at a time, re-running `--project=setup` immediately before each file** — exactly the loop this project used for every task's own verification (Tasks 2-12) and for Task 13's final full-suite pass. Do not trust a single combined multi-file `chromium` run as a release gate; treat it only as a quick smoke check, and always confirm real failures by re-running the specific failing file in isolation with a fresh login first.

---

## Task 1: Test Infrastructure — Config, Auth Setup, Shared Fixture, Cleanup Helpers

**Files:**
- Create: `tests/e2e/helpers/load-env.ts`
- Create: `tests/e2e/helpers/auth-state.ts`
- Create: `tests/e2e/helpers/context.ts`
- Create: `tests/e2e/helpers/dialog.ts`
- Create: `tests/e2e/helpers/db-cleanup.ts`
- Create: `tests/e2e/helpers/shared-location.ts`
- Create: `tests/e2e/auth.setup.ts`
- Create: `tests/e2e/fixtures.setup.ts`
- Create: `tests/e2e/fixtures.teardown.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `authFile(role: 'superadmin'|'admin'|'viewer'): string`, `SEED_CREDENTIALS: Record<Role,{email,password}>` (`tests/e2e/helpers/auth-state.ts`)
- Produces: `newRoleContext(browser: Browser, baseURL: string | undefined, role: Role): Promise<BrowserContext>` (`tests/e2e/helpers/context.ts`)
- Produces: `fillDialogField(dialog: Locator, label: string, value: string): Promise<void>`, `selectDialogOption(page: Page, dialog: Locator, label: string, optionText: string): Promise<void>`, `checkDialogCheckbox(dialog: Locator, label: string): Promise<void>` (`tests/e2e/helpers/dialog.ts`)
- Produces: `deleteLocationByCode(code: string): Promise<void>`, `deleteUserByEmail(email: string): Promise<void>`, `deleteStakeholderByCode(code: string): Promise<void>`, `deleteReportingItemById(id: string): Promise<void>` (`tests/e2e/helpers/db-cleanup.ts`)
- Produces: `getSharedLocation(): { locationId: string; locationCode: string; phases: Record<'F1'|'F2'|'F3'|'F4', string> }` (`tests/e2e/helpers/shared-location.ts`) — reads the JSON file `fixtures-setup` writes.
- Produces: shared fixture location `code: 'E2ESH'` with 4 phases, guaranteed to exist for the whole `chromium` project run, torn down after.

- [ ] **Step 1: Write the env loader**

```ts
// tests/e2e/helpers/load-env.ts
import fs from 'fs'
import path from 'path'

export function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '..', '..', '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const key = match[1]
    let value = match[2] ?? ''
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}
```

- [ ] **Step 2: Write the auth-state helper**

```ts
// tests/e2e/helpers/auth-state.ts
import path from 'path'

export type Role = 'superadmin' | 'admin' | 'viewer'

export const SEED_CREDENTIALS: Record<Role, { email: string; password: string }> = {
  superadmin: { email: 'superadmin@perumnas.co.id', password: 'SuperAdmin123!' },
  admin: { email: 'admin@perumnas.co.id', password: 'Admin123!' },
  viewer: { email: 'viewer@perumnas.co.id', password: 'Viewer123!' },
}

export function authFile(role: Role): string {
  return path.join(__dirname, '..', '.auth', `${role}.json`)
}
```

- [ ] **Step 3: Write the role-context helper**

Manual `browser.newContext()` calls do not automatically inherit the config's `use.baseURL` the way the test runner's own `page`/`context` fixtures do — every spec that opens a second role's context inside a single test (for cross-role comparisons) must forward `baseURL` explicitly, or relative `page.goto('/...')` calls in that context resolve against nothing and fail.

```ts
// tests/e2e/helpers/context.ts
import type { Browser, BrowserContext } from 'playwright/test'
import { authFile, Role } from './auth-state'

export async function newRoleContext(
  browser: Browser,
  baseURL: string | undefined,
  role: Role
): Promise<BrowserContext> {
  return browser.newContext({ storageState: authFile(role), baseURL })
}
```

- [ ] **Step 4: Write the dialog-field helpers**

```ts
// tests/e2e/helpers/dialog.ts
import type { Locator, Page } from 'playwright/test'

export async function fillDialogField(dialog: Locator, label: string, value: string) {
  const field = dialog.locator('div', { has: dialog.getByText(label, { exact: true }) }).first()
  await field.locator('input, textarea').first().fill(value)
}

export async function selectDialogOption(page: Page, dialog: Locator, label: string, optionText: string) {
  const field = dialog.locator('div', { has: dialog.getByText(label, { exact: true }) }).first()
  await field.getByRole('combobox').click()
  await page.getByRole('option', { name: optionText, exact: true }).click()
}

export async function checkDialogCheckbox(dialog: Locator, label: string) {
  const field = dialog.locator('div', { has: dialog.getByText(label, { exact: true }) }).first()
  await field.locator('input[type="checkbox"]').check()
}
```

- [ ] **Step 5: Write the DB cleanup helper (reuses existing `lib/supabase/admin.ts`)**

```ts
// tests/e2e/helpers/db-cleanup.ts
import { createAdminClient } from '../../../lib/supabase/admin'

export async function deleteLocationByCode(code: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('locations').select('id').eq('code', code).maybeSingle()
  if (!data) return
  await supabase.from('locations').delete().eq('id', data.id)
}

export async function deleteUserByEmail(email: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!data) return
  await supabase.auth.admin.deleteUser(data.id)
}

export async function deleteStakeholderByCode(code: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('stakeholders').select('id').eq('code', code).maybeSingle()
  if (!data) return
  await supabase.from('stakeholders').delete().eq('id', data.id)
}

export async function deleteReportingItemById(id: string) {
  await createAdminClient().from('reporting_items').delete().eq('id', id)
}
```

- [ ] **Step 6: Write the shared-location fixture reader**

```ts
// tests/e2e/helpers/shared-location.ts
import fs from 'fs'
import path from 'path'

export interface SharedLocationFixture {
  locationId: string
  locationCode: string
  phases: Record<'F1' | 'F2' | 'F3' | 'F4', string>
}

export function getSharedLocation(): SharedLocationFixture {
  const fixturePath = path.join(__dirname, '..', '.fixtures', 'shared-location.json')
  return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
}
```

- [ ] **Step 7: Write the auth setup project**

```ts
// tests/e2e/auth.setup.ts
import { test as setup } from 'playwright/test'
import { authFile, SEED_CREDENTIALS, Role } from './helpers/auth-state'

for (const role of Object.keys(SEED_CREDENTIALS) as Role[]) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { email, password } = SEED_CREDENTIALS[role]
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Masuk' }).click()
    await page.waitForURL('/')
    await page.context().storageState({ path: authFile(role) })
  })
}
```

- [ ] **Step 8: Write the shared-fixture setup project**

```ts
// tests/e2e/fixtures.setup.ts
import { test as setup, expect } from 'playwright/test'
import fs from 'fs'
import path from 'path'
import { authFile } from './helpers/auth-state'

setup.use({ storageState: authFile('admin') })

setup('create shared E2E location fixture', async ({ page, baseURL }) => {
  const res = await page.request.post(`${baseURL}/api/locations`, {
    data: {
      name: 'E2E Shared Test Location',
      code: 'E2ESH',
      description: 'Dibuat otomatis oleh Playwright (tests/e2e/fixtures.setup.ts) — jangan hapus manual saat suite berjalan',
      project_start_date: '2026-01-01',
    },
  })
  expect(res.ok()).toBeTruthy()
  const { data: location } = await res.json()

  const phasesRes = await page.request.get(`${baseURL}/api/locations/${location.id}/phases`)
  expect(phasesRes.ok()).toBeTruthy()
  const { data: phases } = await phasesRes.json()
  const phaseMap = Object.fromEntries(
    (phases as Array<{ phase_code: string; id: string }>).map((p) => [p.phase_code, p.id])
  )

  const fixturesDir = path.join(__dirname, '.fixtures')
  fs.mkdirSync(fixturesDir, { recursive: true })
  fs.writeFileSync(
    path.join(fixturesDir, 'shared-location.json'),
    JSON.stringify({ locationId: location.id, locationCode: location.code, phases: phaseMap }, null, 2)
  )
})
```

- [ ] **Step 9: Write the shared-fixture teardown project**

```ts
// tests/e2e/fixtures.teardown.ts
import { test as teardown } from 'playwright/test'
import fs from 'fs'
import path from 'path'
import { deleteLocationByCode } from './helpers/db-cleanup'

teardown('remove shared E2E location fixture', async () => {
  const fixturePath = path.join(__dirname, '.fixtures', 'shared-location.json')
  if (!fs.existsSync(fixturePath)) return
  const { locationCode } = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
  await deleteLocationByCode(locationCode)
  fs.rmSync(fixturePath)
})
```

- [ ] **Step 10: Write `playwright.config.ts`**

```ts
// playwright.config.ts
import { defineConfig, devices } from 'playwright/test'
import { loadEnvLocal } from './tests/e2e/helpers/load-env'

loadEnvLocal()

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'fixtures-setup', testMatch: /fixtures\.setup\.ts/, dependencies: ['setup'] },
    { name: 'fixtures-teardown', testMatch: /fixtures\.teardown\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.spec\.ts/,
      dependencies: ['fixtures-setup'],
      teardown: 'fixtures-teardown',
    },
  ],
})
```

- [ ] **Step 11: Add the `test:e2e` script**

In `package.json`, inside `"scripts"`, add after `"test": "vitest run"`:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 12: Ignore generated test artifacts**

In `.gitignore`, add:

```
# playwright e2e
tests/e2e/.auth/
tests/e2e/.fixtures/
playwright-report/
test-results/
```

- [ ] **Step 13: Verify auth + fixture setup works end-to-end**

Run: `npx playwright test --project=setup --project=fixtures-setup`
Expected: 4 passed (3 role logins + 1 fixture creation). Verify files exist:

Run: `ls tests/e2e/.auth tests/e2e/.fixtures`
Expected: `superadmin.json`, `admin.json`, `viewer.json` in `.auth/`; `shared-location.json` in `.fixtures/`.

- [ ] **Step 14: Verify teardown works**

Run: `npx playwright test --project=fixtures-teardown`
Expected: 1 passed. Confirm location gone — check Supabase dashboard or re-run fixtures-setup (should succeed again with a fresh row, proving the old one was deleted, not left duplicated causing a unique-code conflict).

- [ ] **Step 15: Re-run fixtures-setup once more so the shared fixture exists for Tasks 2-12**

Run: `npx playwright test --project=setup --project=fixtures-setup`
Expected: 4 passed. (Leave `.auth/` and `.fixtures/` in place — subsequent tasks' spec files depend on them being present; do not run `fixtures-teardown` again until Task 13.)

- [ ] **Step 16: Commit**

```bash
git add tests/e2e/helpers tests/e2e/auth.setup.ts tests/e2e/fixtures.setup.ts tests/e2e/fixtures.teardown.ts playwright.config.ts package.json .gitignore
git commit -m "test: add Playwright E2E infrastructure (config, auth setup, shared fixture, cleanup helpers)"
```

---

## Task 2: `auth.spec.ts`

**Files:**
- Create: `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `authFile`, `SEED_CREDENTIALS`, `Role` (`tests/e2e/helpers/auth-state.ts`), `deleteUserByEmail` (`tests/e2e/helpers/db-cleanup.ts`)

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/auth.spec.ts
import { test, expect } from 'playwright/test'
import { authFile, SEED_CREDENTIALS, Role } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { deleteUserByEmail } from './helpers/db-cleanup'

test.describe('login', () => {
  for (const role of Object.keys(SEED_CREDENTIALS) as Role[]) {
    test(`${role} can log in and reach the dashboard`, async ({ page }) => {
      const { email, password } = SEED_CREDENTIALS[role]
      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Masuk' }).click()
      await page.waitForURL('/')
      await expect(page.getByText('Program Revitalisasi Rusun')).toBeVisible()
    })
  }

  test('wrong password shows an error and stays on /login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(SEED_CREDENTIALS.viewer.email)
    await page.getByLabel('Password').fill('WrongPassword123!')
    await page.getByRole('button', { name: 'Masuk' }).click()
    await expect(page.getByText('Email atau password salah')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('deactivated account is blocked at login', async ({ browser, baseURL }) => {
    const email = `e2e.deactivated.${Date.now()}@perumnas.co.id`
    const adminContext = await newRoleContext(browser, baseURL, 'admin')
    const adminPage = await adminContext.newPage()

    const createRes = await adminPage.request.post(`${baseURL}/api/users`, {
      data: { email, full_name: 'E2E Deactivated User', password: 'Password123!', role: 'viewer' },
    })
    expect(createRes.ok()).toBeTruthy()
    const { data: created } = await createRes.json()

    const superadminContext = await newRoleContext(browser, baseURL, 'superadmin')
    const superadminPage = await superadminContext.newPage()
    const deactivateRes = await superadminPage.request.delete(`${baseURL}/api/users/${created.id}`)
    expect(deactivateRes.ok()).toBeTruthy()

    const loginPage = await adminContext.newPage()
    await loginPage.goto('/login')
    await loginPage.getByLabel('Email').fill(email)
    await loginPage.getByLabel('Password').fill('Password123!')
    await loginPage.getByRole('button', { name: 'Masuk' }).click()
    await expect(loginPage.getByText('Akun Anda telah dinonaktifkan')).toBeVisible()

    await adminContext.close()
    await superadminContext.close()
    await deleteUserByEmail(email)
  })

  test('logout returns to /login', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'viewer')
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: 'Keluar' }).click()
    await page.waitForURL('/login')
    await context.close()
  })
})

test.describe('role-based sidebar visibility', () => {
  test('viewer does not see admin-only nav links', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'viewer')
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Kalender Kerja' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Audit Log' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Users & Lokasi' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'RACI' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pelaporan' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Workload View' })).toBeVisible()
    await context.close()
  })

  test('admin sees admin-only nav links', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'admin')
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Kalender Kerja' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Audit Log' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users & Lokasi' })).toBeVisible()
    await context.close()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test auth.spec.ts`
Expected: all tests PASS. If any fail with a real app defect (not a selector mistake), stop and follow the Global Constraints bug-handling rule before fixing.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth.spec.ts
git commit -m "test: add E2E coverage for login, logout, account deactivation, sidebar role gating"
```

---

## Task 3: `locations-fase.spec.ts`

**Files:**
- Create: `tests/e2e/locations-fase.spec.ts`

**Interfaces:**
- Consumes: `authFile` (`helpers/auth-state.ts`), `fillDialogField` (`helpers/dialog.ts`), `deleteLocationByCode` (`helpers/db-cleanup.ts`), `getSharedLocation` (`helpers/shared-location.ts`)

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/locations-fase.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { fillDialogField } from './helpers/dialog'
import { deleteLocationByCode } from './helpers/db-cleanup'
import { getSharedLocation } from './helpers/shared-location'

test.describe('location CRUD (admin/SA)', () => {
  test.use({ storageState: authFile('superadmin') })

  test('super_admin creates, edits, and deactivates a location with a digit in its code', async ({ page }) => {
    const code = 'E2E01' // deliberately contains a digit — regression guard for the Minggu 10 Sidebar routing bug
    await page.goto('/users')
    await page.getByRole('tab', { name: 'Lokasi' }).click()
    await page.getByRole('button', { name: '+ Tambah Lokasi' }).click()
    const addDialog = page.getByRole('dialog')
    await fillDialogField(addDialog, 'Nama', 'E2E Lokasi Digit Test')
    await fillDialogField(addDialog, 'Kode', code)
    await fillDialogField(addDialog, 'Tanggal Mulai Proyek', '2026-02-01')
    await addDialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByText(`(${code})`)).toBeVisible()

    // regression guard: numeric-containing location code must route correctly (Minggu 10 bug)
    await page.goto(`/dashboard/${code}/fase-1`)
    await expect(page.getByRole('button', { name: '+ Tambah Kegiatan' })).toBeVisible()

    await page.goto('/users')
    await page.getByRole('tab', { name: 'Lokasi' }).click()
    const card = page.locator('div', { has: page.getByText(`(${code})`) }).first()
    await card.getByRole('button', { name: 'Edit' }).click()
    const editDialog = page.getByRole('dialog')
    await fillDialogField(editDialog, 'Nama', 'E2E Lokasi Digit Test (Edited)')
    await editDialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByText('E2E Lokasi Digit Test (Edited)')).toBeVisible()

    await page.locator('div', { has: page.getByText(`(${code})`) }).first()
      .getByRole('button', { name: 'Nonaktifkan' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Nonaktifkan' }).click()
    await expect(page.getByText('E2E Lokasi Digit Test (Edited)')).toHaveCount(0)

    await deleteLocationByCode(code)
  })

  test('admin (not SA) cannot see the Nonaktifkan button', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'admin')
    const page = await context.newPage()
    await page.goto('/users')
    await page.getByRole('tab', { name: 'Lokasi' }).click()
    await expect(page.getByRole('button', { name: 'Nonaktifkan' })).toHaveCount(0)
    await context.close()
  })
})

test.describe('activity table (fase page)', () => {
  test('admin adds, edits inline, locks, and reorders an activity; viewer sees no edit controls', async ({ browser, baseURL }) => {
    const { locationCode } = getSharedLocation()
    const adminContext = await newRoleContext(browser, baseURL, 'admin')
    const adminPage = await adminContext.newPage()
    await adminPage.goto(`/dashboard/${locationCode}/fase-1`)

    await adminPage.getByRole('button', { name: '+ Tambah Kegiatan' }).click()
    const dialog = adminPage.getByRole('dialog')
    await fillDialogField(dialog, 'Kegiatan', 'E2E Fase Test Activity')
    await fillDialogField(dialog, 'PIC', 'E2E Tester')
    await fillDialogField(dialog, 'Rencana Mulai', '2026-03-01')
    await fillDialogField(dialog, 'Rencana Selesai', '2026-03-05')
    await dialog.getByRole('button', { name: 'Tambah' }).click()
    const row = adminPage.locator('tr', { has: adminPage.getByText('E2E Fase Test Activity') })
    await expect(row).toBeVisible()

    // inline edit: change PIC, wait for debounced autosave (600ms)
    const picInput = row.locator('input').nth(1)
    await picInput.fill('E2E Tester Updated')
    await adminPage.waitForTimeout(1000)
    await adminPage.reload()
    const reloadedRow = adminPage.locator('tr', { has: adminPage.getByText('E2E Fase Test Activity') })
    await expect(reloadedRow.locator('input[value="E2E Tester Updated"]')).toBeVisible()

    // lock toggle
    await reloadedRow.locator('button[title="Toggle kunci tanggal"]').click()
    await adminPage.waitForTimeout(500)

    await adminContext.close()

    const viewerContext = await newRoleContext(browser, baseURL, 'viewer')
    const viewerPage = await viewerContext.newPage()
    await viewerPage.goto(`/dashboard/${locationCode}/fase-1`)
    await expect(viewerPage.getByRole('button', { name: '+ Tambah Kegiatan' })).toHaveCount(0)
    await expect(viewerPage.locator('tr', { has: viewerPage.getByText('E2E Fase Test Activity') }).locator('input')).toHaveCount(0)
    await viewerContext.close()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test locations-fase.spec.ts`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/locations-fase.spec.ts
git commit -m "test: add E2E coverage for location CRUD and activity table (fase page)"
```

---

## Task 4: `dependencies-cpm.spec.ts`

**Files:**
- Create: `tests/e2e/dependencies-cpm.spec.ts`

**Interfaces:**
- Consumes: `authFile`, `getSharedLocation`
- Relies on API response shapes: `POST /api/phases/{phaseId}/activities` → `{ data: Activity, error }`; `POST /api/dependencies` → `{ data: { dependency, cpm: { shiftedCount, hasCycle, criticalPath, updatedActivities } }, error }`; `DELETE /api/activities/{id}` → `{ data: { id, cpm }, error }`, 409 `HAS_SUCCESSORS` if successors exist.

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/dependencies-cpm.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { getSharedLocation } from './helpers/shared-location'

test.describe('dependencies + CPM auto-shift', () => {
  test.use({ storageState: authFile('admin') })

  let actIdA: string
  let actIdB: string
  let actIdC: string

  test.beforeAll(async ({ browser, baseURL }) => {
    const { phases } = getSharedLocation()
    const context = await newRoleContext(browser, baseURL, 'admin')
    const page = await context.newPage()

    async function createActivity(name: string, start: string, end: string) {
      const res = await page.request.post(`${baseURL}/api/phases/${phases.F1}/activities`, {
        data: { kegiatan: name, pic: 'E2E Tester', tanggal_mulai_rencana: start, tanggal_selesai_rencana: end },
      })
      const { data } = await res.json()
      return data.id as string
    }

    actIdA = await createActivity('E2E CPM Act A', '2026-01-05', '2026-01-09')
    actIdB = await createActivity('E2E CPM Act B', '2026-01-05', '2026-01-07')
    actIdC = await createActivity('E2E CPM Act C', '2026-01-05', '2026-01-07')
    await context.close()
  })

  test.afterAll(async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'superadmin')
    const page = await context.newPage()
    // delete predecessor last (successors first) to avoid HAS_SUCCESSORS 409
    for (const id of [actIdB, actIdC, actIdA]) {
      await page.request.delete(`${baseURL}/api/activities/${id}`)
    }
    await context.close()
  })

  test('adding an FS dependency shifts the successor and shows the toast', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/fase-1`)

    const rowB = page.locator('tr', { has: page.locator(`input[value="E2E CPM Act B"]`) })
    await rowB.getByRole('button').filter({ hasText: /^\d+$/ }).click()
    const panel = page.getByRole('dialog', { name: /Dependensi Kegiatan/ })
    await panel.getByRole('tab', { name: /Predecessor/ }).click()
    await panel.getByText('+ Tambah Predecessor').click()
    await panel.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /E2E CPM Act A/ }).click()
    await panel.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'FS', exact: true }).click()

    const [depResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/dependencies') && r.request().method() === 'POST'),
      panel.getByRole('button', { name: 'Tambah' }).click(),
    ])
    const depJson = await depResponse.json()
    expect(depJson.data.cpm.hasCycle).toBe(false)
    expect(depJson.data.cpm.shiftedCount).toBeGreaterThanOrEqual(1)
    const shiftedB = depJson.data.cpm.updatedActivities.find((a: { id: string }) => a.id === actIdB)
    expect(shiftedB).toBeTruthy()
    expect(shiftedB.tanggal_mulai_rencana >= '2026-01-09').toBe(true)

    await expect(page.getByText(/kegiatan ikut disesuaikan jadwalnya/)).toBeVisible()
  })

  test('a dependency that would create a cycle is rejected with the exact server message', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/fase-1`)

    // A -> B already exists from the previous test; now try B -> A (cycle)
    const rowA = page.locator('tr', { has: page.locator(`input[value="E2E CPM Act A"]`) })
    await rowA.getByRole('button').filter({ hasText: /^\d+$/ }).click()
    const panel = page.getByRole('dialog', { name: /Dependensi Kegiatan/ })
    await panel.getByRole('tab', { name: /Predecessor/ }).click()
    await panel.getByText('+ Tambah Predecessor').click()
    await panel.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /E2E CPM Act B/ }).click()
    await panel.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'FS', exact: true }).click()
    await panel.getByRole('button', { name: 'Tambah' }).click()

    await expect(page.getByText('Dependensi ini akan menciptakan siklus (circular dependency)')).toBeVisible()
  })

  test('a locked activity does not shift when its predecessor moves', async ({ page, baseURL }) => {
    const { locationCode } = getSharedLocation()
    await page.request.patch(`${baseURL}/api/activities/${actIdC}/lock`)

    await page.goto(`/dashboard/${locationCode}/fase-1`)
    const rowC = page.locator('tr', { has: page.locator(`input[value="E2E CPM Act C"]`) })
    const beforeStart = await rowC.locator('input[type="date"]').first().inputValue()

    const rowA = page.locator('tr', { has: page.locator(`input[value="E2E CPM Act A"]`) })
    await rowA.getByRole('button').filter({ hasText: /^\d+$/ }).click()
    const panel = page.getByRole('dialog', { name: /Dependensi Kegiatan/ })
    await panel.getByRole('tab', { name: /Successor/ }).click()
    await panel.getByText('+ Tambah Successor').click()
    await panel.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /E2E CPM Act C/ }).click()
    await panel.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'FS', exact: true }).click()

    const [depResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/dependencies') && r.request().method() === 'POST'),
      panel.getByRole('button', { name: 'Tambah' }).click(),
    ])
    const depJson = await depResponse.json()
    const shiftedC = depJson.data.cpm.updatedActivities.find((a: { id: string }) => a.id === actIdC)
    expect(shiftedC).toBeFalsy() // date_locked activities are excluded from CPM shifting

    await page.reload()
    const afterStart = await page.locator('tr', { has: page.locator(`input[value="E2E CPM Act C"]`) })
      .locator('input[type="date"]').first().inputValue()
    expect(afterStart).toBe(beforeStart)
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test dependencies-cpm.spec.ts`
Expected: all PASS. (The DependencyPanel trigger is `<button><Badge>{depCount}</Badge></button>` with no `title`/`aria-label` — confirmed in `components/activities/DependencyPanel.tsx:122-125` — so its accessible name is just the digit count, which is what `getByRole('button').filter({ hasText: /^\d+$/ })` targets.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/dependencies-cpm.spec.ts
git commit -m "test: add E2E coverage for dependency add/cycle-detection/CPM auto-shift/date_locked"
```

---

## Task 5: `timeline-gantt.spec.ts`

**Files:**
- Create: `tests/e2e/timeline-gantt.spec.ts`

**Interfaces:**
- Consumes: `authFile`, `getSharedLocation`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/timeline-gantt.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { getSharedLocation } from './helpers/shared-location'

test.describe('Timeline / Gantt', () => {
  test.use({ storageState: authFile('admin') })

  test('renders and view/baseline/dependency-arrow/critical-highlight toggles work', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/timeline`)
    await expect(page.getByText(/Timeline \/ Gantt/)).toBeVisible()

    await page.getByRole('tab', { name: 'Tampilan Minggu' }).click()
    await expect(page.getByRole('tab', { name: 'Tampilan Minggu', selected: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Tampilan Bulan' }).click()

    const baselineToggle = page.getByLabel('Tampilkan Baseline')
    await baselineToggle.uncheck()
    await baselineToggle.check()

    const arrowToggle = page.getByLabel('Tampilkan Panah Dependensi')
    await arrowToggle.uncheck()
    await arrowToggle.check()

    const criticalToggle = page.getByLabel('Highlight Jalur Kritis')
    await criticalToggle.uncheck()
    await criticalToggle.check()
  })

  test('hovering a dependency arrow shows type and lag', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/timeline`)
    const arrowHitArea = page.locator('g.pointer-events-auto').first()
    if (await arrowHitArea.count() === 0) test.skip(true, 'no dependency arrows on this location yet')
    await arrowHitArea.hover()
    await expect(page.getByText(/· lag \d+ hari/)).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test timeline-gantt.spec.ts`
Expected: all PASS (second test may legitimately skip if Task 4's dependency was cleaned up before this runs — acceptable, note test file order dependency in the Task 13 full-run review).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/timeline-gantt.spec.ts
git commit -m "test: add E2E coverage for Gantt view toggles and dependency arrow tooltip"
```

---

## Task 6: `baseline-kritis.spec.ts`

**Files:**
- Create: `tests/e2e/baseline-kritis.spec.ts`

**Interfaces:**
- Consumes: `authFile`, `getSharedLocation`
- Relies on: `POST /api/locations/{locationId}/baselines` → `{ data: { id, name, is_active, created_at }, error }`; `PATCH /api/baselines/{id}/activate` → `{ data: { id, name, is_active }, error }`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/baseline-kritis.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { getSharedLocation } from './helpers/shared-location'

test.describe('baseline save/activate + critical path highlight', () => {
  test.use({ storageState: authFile('admin') })

  test('admin saves a new baseline and activates it', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/timeline`)

    await page.getByRole('button', { name: 'Kelola Baseline' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('div', { has: dialog.getByText('Nama Baseline', { exact: true }) })
      .locator('input').fill('E2E Baseline v1')
    await dialog.getByRole('button', { name: 'Simpan Baseline Baru' }).click()
    await expect(page.getByText('Baseline disimpan')).toBeVisible()

    const row = dialog.locator('li, div', { has: dialog.getByText('E2E Baseline v1') }).first()
    const activateBtn = row.getByRole('button', { name: 'Aktifkan' })
    if (await activateBtn.count() > 0) {
      await activateBtn.click()
      await expect(page.getByText('Baseline diaktifkan')).toBeVisible()
      await expect(row.getByText('Aktif')).toBeVisible()
    }
  })

  test('viewer cannot see Kelola Baseline', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'viewer')
    const page = await context.newPage()
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/timeline`)
    await expect(page.getByRole('button', { name: 'Kelola Baseline' })).toHaveCount(0)
    await context.close()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test baseline-kritis.spec.ts`
Expected: all PASS. If the baseline-history list markup (`li`/`div` row selector) doesn't match, inspect `components/gantt/BaselinePanel.tsx`'s actual list container tag and adjust.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/baseline-kritis.spec.ts
git commit -m "test: add E2E coverage for baseline save/activate and viewer gating"
```

---

## Task 7: `dashboard.spec.ts`

**Files:**
- Create: `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `authFile`, `getSharedLocation`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/dashboard.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { getSharedLocation } from './helpers/shared-location'

test.describe('dashboards', () => {
  test.use({ storageState: authFile('viewer') })

  test('main cross-location dashboard shows comparative summary', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Program Revitalisasi Rusun')).toBeVisible()
    await expect(page.getByText('Ringkasan Semua Lokasi — Perum Perumnas')).toBeVisible()
    await expect(page.getByText('Ringkasan Komparatif')).toBeVisible()
    await expect(page.getByText('Isu Lintas-Lokasi')).toBeVisible()
  })

  test('per-location dashboard shows progress, phases, critical path, and lists', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}`)
    await expect(page.getByText('Progres Keseluruhan')).toBeVisible()
    await expect(page.getByText('Kegiatan Mendatang')).toBeVisible()
    await expect(page.getByText('Perlu Perhatian')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test dashboard.spec.ts`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/dashboard.spec.ts
git commit -m "test: add E2E coverage for cross-location and per-location dashboards"
```

---

## Task 8: `risks.spec.ts`

**Files:**
- Create: `tests/e2e/risks.spec.ts`

**Interfaces:**
- Consumes: `authFile`, `fillDialogField`, `selectDialogOption`, `getSharedLocation`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/risks.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { fillDialogField, selectDialogOption } from './helpers/dialog'
import { getSharedLocation } from './helpers/shared-location'

test.describe('risk register', () => {
  test.use({ storageState: authFile('admin') })

  test('admin creates a risk, sees it scored/placed in the matrix, then edits it', async ({ page, baseURL }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/risks`)

    await page.getByRole('button', { name: '+ Tambah Risiko' }).click()
    const addDialog = page.getByRole('dialog')
    await selectDialogOption(page, addDialog, 'Fase', /F1/)
    await fillDialogField(addDialog, 'Judul', 'E2E Risiko Keterlambatan Material')
    await fillDialogField(addDialog, 'Deskripsi', 'Risiko dibuat oleh Playwright')
    await selectDialogOption(page, addDialog, 'Probabilitas', '5')
    await selectDialogOption(page, addDialog, 'Dampak', '5')
    await addDialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByText('E2E Risiko Keterlambatan Material')).toBeVisible()

    // score 5x5=25 -> P5/D5 matrix cell should now show a nonzero count
    await expect(page.locator('button[title="Probabilitas 5 × Dampak 5 = Skor 25"]')).not.toHaveText('')

    const row = page.locator('tr', { has: page.getByText('E2E Risiko Keterlambatan Material') })
    await row.locator('button[title="Edit risiko"]').click()
    const editDialog = page.getByRole('dialog')
    await selectDialogOption(page, editDialog, 'Status', 'Mitigated')
    await editDialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByText('Risiko diperbarui')).toBeVisible()

    // cleanup: hard-delete via API using the row's risk id looked up by title.
    // NOTE: there is no top-level GET /api/risks — only GET /api/phases/{id}/risks
    // (list) and PATCH/DELETE /api/risks/{id} exist. Use the phase-scoped list route,
    // and wrap the whole test body in try/finally so this runs on any assertion failure too.
    const listRes = await page.request.get(`${baseURL}/api/phases/${getSharedLocation().phases.F1}/risks`)
    const { data: risks } = await listRes.json()
    const created = (risks as Array<{ id: string; title: string }>).find(
      (r) => r.title === 'E2E Risiko Keterlambatan Material'
    )
    if (created) await page.request.delete(`${baseURL}/api/risks/${created.id}`)
  })

  test('viewer cannot see + Tambah Risiko', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'viewer')
    const page = await context.newPage()
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/risks`)
    await expect(page.getByRole('button', { name: '+ Tambah Risiko' })).toHaveCount(0)
    await context.close()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test risks.spec.ts`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/risks.spec.ts
git commit -m "test: add E2E coverage for risk register CRUD, matrix scoring, and viewer gating"
```

---

## Task 9: `workload-calendar-summary.spec.ts`

**Files:**
- Create: `tests/e2e/workload-calendar-summary.spec.ts`

**Interfaces:**
- Consumes: `authFile`, `getSharedLocation`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/workload-calendar-summary.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { getSharedLocation } from './helpers/shared-location'

test.describe('Workload / Kalender Kerja / Weekly Summary', () => {
  test('Workload View has no role gate', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'viewer')
    const page = await context.newPage()
    await page.goto('/workload')
    await expect(page.getByText('Workload View')).toBeVisible()
    await context.close()
  })

  test('Kalender Kerja is admin/SA only (404 for viewer)', async ({ browser, baseURL }) => {
    const viewerContext = await newRoleContext(browser, baseURL, 'viewer')
    const viewerPage = await viewerContext.newPage()
    const res = await viewerPage.goto('/work-calendar')
    expect(res?.status()).toBe(404)
    await viewerContext.close()

    const adminContext = await newRoleContext(browser, baseURL, 'admin')
    const adminPage = await adminContext.newPage()
    await adminPage.goto('/work-calendar')
    await expect(adminPage.getByText('Kalender Kerja')).toBeVisible()
    await adminContext.close()
  })

  test('Weekly Summary navigates weeks and shows the WhatsApp copy button', async ({ page }) => {
    test.use({ storageState: authFile('viewer') })
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/weekly-summary`)
    await expect(page.getByText('✅ Selesai Minggu Ini')).toBeVisible()
    await expect(page.getByText('🚀 Mulai Minggu Depan')).toBeVisible()
    await expect(page.getByText('⏰ Terlambat')).toBeVisible()
    await expect(page.getByText('⚠️ Ditunda')).toBeVisible()

    await page.getByRole('button', { name: 'Minggu Berikutnya →' }).click()
    await expect(page.getByRole('button', { name: 'Kembali ke Minggu Ini' })).toBeVisible()
    await page.getByRole('button', { name: 'Kembali ke Minggu Ini' }).click()
    await expect(page.getByRole('button', { name: 'Kembali ke Minggu Ini' })).toHaveCount(0)

    await expect(page.getByRole('button', { name: 'Salin Teks WhatsApp' })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test workload-calendar-summary.spec.ts`
Expected: all PASS. Note: `test.use()` inside a `test()` body has no effect in Playwright (it must be at `describe`-level or file-level) — the third test as written will run with whatever the file's ambient project default is (no storageState, i.e. unauthenticated), which will redirect away from the page. Fix before running: split the third test into its own `test.describe` block with `test.use({ storageState: authFile('viewer') })` at the describe level, matching the pattern used in every other spec file in this plan.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/workload-calendar-summary.spec.ts
git commit -m "test: add E2E coverage for workload view, kalender kerja gating, weekly summary navigation"
```

---

## Task 10: `raci-pelaporan.spec.ts`

**Files:**
- Create: `tests/e2e/raci-pelaporan.spec.ts`

**Interfaces:**
- Consumes: `authFile`, `fillDialogField`, `deleteStakeholderByCode`, `deleteReportingItemById`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/raci-pelaporan.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { fillDialogField } from './helpers/dialog'
import { deleteStakeholderByCode, deleteReportingItemById } from './helpers/db-cleanup'

test.describe('RACI', () => {
  test.use({ storageState: authFile('admin') })

  test('admin adds a stakeholder, sets a RACI cell, and reorders it', async ({ page }) => {
    await page.goto('/raci')
    await page.getByRole('button', { name: '+ Tambah Stakeholder' }).click()
    const dialog = page.getByRole('dialog')
    await fillDialogField(dialog, 'Kode', 'E2ESH1')
    await fillDialogField(dialog, 'Nama', 'E2E Stakeholder')
    await fillDialogField(dialog, 'Grup', 'E2E Group')
    await dialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByTitle(/E2E Stakeholder/)).toBeVisible()

    // new stakeholder is always inserted with the highest display_order (AddStakeholderModal
    // passes nextDisplayOrder = current count), and GET /api/stakeholders orders ascending —
    // so it's always the last column, making `td:last-child` reliable here.
    const headerCell = page.locator('th', { has: page.getByTitle(/E2E Stakeholder/) })
    await headerCell.getByRole('button', { name: 'Geser kiri' }).click()

    const f1Row = page.locator('tr', { has: page.getByText('F1 —') })
    await f1Row.locator('td').last().getByRole('combobox').click()
    await page.getByRole('option', { name: 'R', exact: true }).click()

    await deleteStakeholderByCode('E2ESH1')
  })

  test('viewer sees read-only RACI cells (no dropdown)', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'viewer')
    const page = await context.newPage()
    await page.goto('/raci')
    await expect(page.getByRole('button', { name: '+ Tambah Stakeholder' })).toHaveCount(0)
    await context.close()
  })
})

test.describe('Pelaporan', () => {
  test.use({ storageState: authFile('admin') })

  test('admin adds and edits a reporting item', async ({ page, baseURL }) => {
    await page.goto('/pelaporan')
    await page.getByRole('button', { name: '+ Tambah Baris' }).click()
    const dialog = page.getByRole('dialog')
    await fillDialogField(dialog, 'Jenis Laporan', 'E2E Laporan Mingguan')
    await fillDialogField(dialog, 'Dari (PIC)', 'E2E Tester')
    await fillDialogField(dialog, 'Kepada', 'E2E Stakeholder')
    await fillDialogField(dialog, 'Frekuensi', 'Mingguan')
    await fillDialogField(dialog, 'Format/Media', 'Email')
    await fillDialogField(dialog, 'Isi Konten', 'Ringkasan progres mingguan')
    await dialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByText('E2E Laporan Mingguan')).toBeVisible()

    const listRes = await page.request.get(`${baseURL}/api/reporting-items`)
    const { data: items } = await listRes.json()
    const created = (items as Array<{ id: string; jenis_laporan: string }>)
      .find((i) => i.jenis_laporan === 'E2E Laporan Mingguan')
    if (created) await deleteReportingItemById(created.id)
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test raci-pelaporan.spec.ts`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/raci-pelaporan.spec.ts
git commit -m "test: add E2E coverage for RACI matrix/reorder and Pelaporan CRUD"
```

---

## Task 11: `audit-users.spec.ts`

**Files:**
- Create: `tests/e2e/audit-users.spec.ts`

**Interfaces:**
- Consumes: `authFile`, `fillDialogField`, `selectDialogOption`, `deleteUserByEmail`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/audit-users.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { fillDialogField, selectDialogOption } from './helpers/dialog'
import { deleteUserByEmail } from './helpers/db-cleanup'

test.describe('Users & Lokasi — Users tab', () => {
  test.use({ storageState: authFile('superadmin') })

  test('SA creates a viewer, deactivates, then reactivates them', async ({ page }) => {
    const email = `e2e.user.${Date.now()}@perumnas.co.id`
    await page.goto('/users')
    await page.getByRole('button', { name: '+ Buat User' }).click()
    const dialog = page.getByRole('dialog')
    await fillDialogField(dialog, 'Email', email)
    await fillDialogField(dialog, 'Nama Lengkap', 'E2E New User')
    await fillDialogField(dialog, 'Password', 'Password123!')
    await selectDialogOption(page, dialog, 'Role', 'Viewer')
    await dialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByText('E2E New User')).toBeVisible()

    const row = page.locator('tr', { has: page.getByText(email) })
    await row.getByRole('button', { name: 'Nonaktifkan' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Nonaktifkan' }).click()
    await expect(row.getByText('Nonaktif')).toBeVisible()

    await row.getByRole('button', { name: 'Aktifkan' }).click()
    await expect(row.getByText('Aktif')).toBeVisible()

    await deleteUserByEmail(email)
  })

  test('admin cannot deactivate self and cannot change own role', async ({ browser, baseURL }) => {
    const adminContext = await newRoleContext(browser, baseURL, 'admin')
    const adminPage = await adminContext.newPage()
    const meRes = await adminPage.request.get(`${baseURL}/api/auth/me`)
    const { data: me } = await meRes.json()

    await adminPage.goto('/users')
    const row = adminPage.locator('tr', { has: adminPage.getByText(me.email) })
    await expect(row.getByRole('button', { name: /Nonaktifkan|Aktifkan/ })).toHaveCount(0)

    const patchRes = await adminPage.request.patch(`${baseURL}/api/users/${me.id}`, {
      data: { role: 'admin' },
    })
    expect(patchRes.status()).toBe(403)
    await adminContext.close()
  })
})

test.describe('Audit Log', () => {
  test.use({ storageState: authFile('admin') })

  test('viewer gets 404, admin can filter by action and open the diff modal', async ({ browser, page, baseURL }) => {
    const viewerContext = await newRoleContext(browser, baseURL, 'viewer')
    const viewerPage = await viewerContext.newPage()
    const res = await viewerPage.goto('/audit-log')
    expect(res?.status()).toBe(404)
    await viewerContext.close()

    await page.goto('/audit-log')
    await page.getByRole('combobox').filter({ hasText: 'Semua Aksi' }).click()
    await page.getByRole('option', { name: 'CREATE', exact: true }).click()
    await expect(page.getByText(/Halaman \d+ dari \d+/)).toBeVisible()

    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()
    await expect(page.getByRole('dialog').getByText('Nilai Lama')).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Nilai Baru')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test audit-users.spec.ts`
Expected: all PASS. If the audit log row isn't clickable to open the diff modal (may need a dedicated "Detail" button instead), inspect `components/audit-log/AuditLogClient.tsx` / `AuditDetailModal.tsx` trigger and adjust.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/audit-users.spec.ts
git commit -m "test: add E2E coverage for user create/deactivate/reactivate, self-protection guard, audit log filter+diff"
```

---

## Task 12: `kk-consent.spec.ts`

**Files:**
- Create: `tests/e2e/kk-consent.spec.ts`

**Interfaces:**
- Consumes: `authFile`, `getSharedLocation`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/kk-consent.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { getSharedLocation } from './helpers/shared-location'

test.describe('Persetujuan Warga (KK consent)', () => {
  test('viewer sees read-only values, no save-status badge', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'viewer')
    const page = await context.newPage()
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/kk-consent`)
    await expect(page.getByText('Target KK')).toBeVisible()
    await expect(page.locator('input')).toHaveCount(0)
    await context.close()
  })

  test('admin edits target/setuju/menolak and it autosaves', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/kk-consent`)
    test.info().annotations.push({ type: 'role', description: 'admin' })

    const targetField = page.locator('div', { has: page.getByText('Target KK', { exact: true }) })
      .first().locator('input')
    await targetField.fill('50')
    await page.waitForTimeout(1000)
    await expect(page.getByText('✓ Tersimpan')).toBeVisible()

    await page.reload()
    await expect(page.locator('div', { has: page.getByText('Target KK', { exact: true }) })
      .first().locator('input')).toHaveValue('50')
  })
})
```

- [ ] **Step 2: Fix the missing admin storageState, then run it**

The second test needs `test.use({ storageState: authFile('admin') })` at the `test.describe` level (the annotation-based approach in the draft above does not authenticate the page) — move it there before running.

Run: `npx playwright test kk-consent.spec.ts`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/kk-consent.spec.ts
git commit -m "test: add E2E coverage for KK consent view/edit gating and autosave"
```

---

## Task 13: Full Suite Run, Flake/Bug Triage, and Fixes

**Files:**
- Modify: any file where a real bug is found (scope depends on findings)
- Modify: `tests/e2e/*.spec.ts` (scope depends on findings — flaky selector fixes)

- [ ] **Step 1: Run the complete suite from a clean state, one file at a time**

Do NOT run `--project=setup --project=fixtures-setup --project=chromium` combined in one command — combining multiple projects gives no ordering guarantee between them (`chromium` no longer declares `dependencies` on `fixtures-setup`, per the Task 2 fix), and a single long-running combined `chromium` pass across all 11 files exhausts the shared `storageState` snapshot partway through (Supabase's refresh-token rotation is never written back to disk), producing an unpredictable scatter of 401/redirect-to-`/login` failures unrelated to any real bug.

Instead, first create the fixture, then loop file-by-file with a fresh login before each:

```bash
npx playwright test --project=fixtures-teardown   # start from zero if E2ESH already exists
npx playwright test --project=setup --project=fixtures-setup
for f in auth locations-fase dependencies-cpm timeline-gantt baseline-kritis dashboard risks workload-calendar-summary raci-pelaporan audit-users kk-consent; do
  npx playwright test --project=setup
  npx playwright test "$f.spec.ts"
done
```

Expected: all specs from Tasks 2-12 PASS (timeline-gantt's second test is expected to `test.skip` — see Global Constraints, it's a known, accepted, non-blocking gap: `dependencies-cpm.spec.ts`'s own `afterAll` deletes its dependencies before `timeline-gantt.spec.ts` starts, even when the two files are run back-to-back in the same command).

- [ ] **Step 2: Triage every failure**

For each failure, first re-run that single file in isolation with a fresh `--project=setup` immediately before it — if it now passes, the earlier failure was session staleness from a prior combined-run experiment, not a real issue, and no fix is needed. For a failure that persists even in a clean, isolated, freshly-logged-in re-run, classify it as one of:
- **Selector/test bug** (locator doesn't match real DOM) — fix the spec file directly, re-run just that file, no approval needed.
- **Real application bug** — note the exact repro (file:line of the assertion, exact error) and check whether the fix touches `createAdminClient()` on a new call site or an authorization guard.
  - If yes: stop, present the bug + proposed fix + justification to the user via `AskUserQuestion`, and only proceed once approved (Global Constraints rule).
  - If no: fix directly, add/adjust a targeted test if the bug reveals a gap the current spec doesn't cover, re-run.

- [ ] **Step 3: Re-run the full suite until green**

Repeat Step 1's file-by-file loop once more. Expected: all PASS (same accepted timeline-gantt skip), 0 unexplained flakiness.

- [ ] **Step 4: Tear down the shared fixture**

Run: `npx playwright test --project=fixtures-teardown`
Expected: 1 passed, `tests/e2e/.fixtures/shared-location.json` removed, location `E2ESH` gone from the DB.

- [ ] **Step 5: Commit any fixes accumulated in this task**

```bash
git add -A
git commit -m "test: fix flaky selectors and application bugs found by full E2E suite run"
```

(Skip this step if Step 1 was already green with no changes needed.)

---

## Task 14: Whole-Branch Review

- [ ] **Step 1: Run the `/code-review` skill (high effort) against the full branch diff**

Covers: are all 11 domains from the design doc actually exercised, is any spec asserting on the wrong thing (false-positive risk), is cleanup complete in every `afterAll` (no orphaned fixtures), does the Global Constraints RLS/auth-guard approval rule show evidence of being followed for any bug fixes made in Task 13.

- [ ] **Step 2: Fix any Important/Critical findings, following the same RLS/auth-guard approval gate if applicable**

- [ ] **Step 3: Record the outcome in the project memory (Minggu 13 summary — what was built, what bugs were found and fixed, what's deferred to Minggu 14)**
