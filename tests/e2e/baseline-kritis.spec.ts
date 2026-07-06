// tests/e2e/baseline-kritis.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { getSharedLocation } from './helpers/shared-location'

test.describe('baseline save/activate + critical path highlight', () => {
  test.use({ storageState: authFile('admin') })

  test('admin saves a new baseline and activates it', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    // Unique per run: baselines are never deleted (no DELETE route), and the
    // shared location accumulates history rows across repeated test runs, so a
    // fixed literal name would produce duplicate rows with the same text.
    const baselineNameA = `E2E Baseline ${Date.now()}`
    await page.goto(`/dashboard/${locationCode}/timeline`)

    await page.getByRole('button', { name: 'Kelola Baseline' }).click()
    const dialog = page.getByRole('dialog')
    // The `has` inner locator must not be built from `dialog.getByText(...)`:
    // that bakes the `role=dialog` ancestor into the sub-selector, which is
    // then searched for *inside* each candidate div — never true, since the
    // div is a descendant of the dialog, not the other way around, so it
    // always yields 0 matches. Build the inner locator from `page` instead.
    await dialog.locator('div', { has: page.getByText('Nama Baseline', { exact: true }) })
      .locator('input').fill(baselineNameA)
    await dialog.getByRole('button', { name: 'Simpan Baseline Baru' }).click()
    await expect(page.getByText('Baseline disimpan')).toBeVisible()

    // BaselinePanel.handleSave() closes the dialog on success (setOpen(false))
    // before refreshing the router, so the "Riwayat Baseline" list with our
    // new row is not visible in the dialog we just filled in — reopen it to
    // see the refreshed history.
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Kelola Baseline' }).click()
    await dialog.waitFor({ state: 'visible' })

    // Row divs in "Riwayat Baseline" use this exact class combo. A generic
    // `div:has-text(name)` locator also matches the ancestor list container
    // (which contains the same text transitively), making `.first()` resolve
    // to the wrong, broader element once more than one baseline row exists in
    // the shared location — scope to the row's own class list instead.
    const rowA = dialog.locator('div.flex.items-center.justify-between', { hasText: baselineNameA })
    await expect(rowA).toHaveCount(1)

    // POST /api/locations/{id}/baselines creates new baselines already active
    // (and deactivates prior ones). On a clean `E2ESH` (no seeding trigger
    // ever creates a baseline row), this is the location's only baseline, so
    // it's active with no "Aktifkan" button of its own — assert that first,
    // then create a second baseline below to give this one an "Aktifkan"
    // button. This keeps the test fully self-contained regardless of whether
    // `E2ESH` happens to carry baseline history from prior runs.
    await expect(rowA.getByText('Aktif', { exact: true })).toBeVisible()

    // Create a second baseline via the same "Simpan Baseline Baru" flow —
    // this auto-deactivates A (giving it an "Aktifkan" button) without
    // depending on any pre-existing row from a previous test run.
    const baselineNameB = `E2E Baseline ${Date.now()}-B`
    await dialog.locator('div', { has: page.getByText('Nama Baseline', { exact: true }) })
      .locator('input').fill(baselineNameB)
    await dialog.getByRole('button', { name: 'Simpan Baseline Baru' }).click()
    await expect(page.getByText('Baseline disimpan')).toBeVisible()

    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Kelola Baseline' }).click()
    await dialog.waitFor({ state: 'visible' })

    const rowB = dialog.locator('div.flex.items-center.justify-between', { hasText: baselineNameB })
    await expect(rowB).toHaveCount(1)
    await expect(rowB.getByText('Aktif', { exact: true })).toBeVisible()

    // A was just deactivated by B's creation, so it now shows "Aktifkan".
    await expect(rowA.getByRole('button', { name: 'Aktifkan' })).toBeVisible()

    // Exercise the real activate-via-UI path (PATCH /api/baselines/{id}/activate)
    // by reactivating A.
    const [activateResponse] = await Promise.all([
      page.waitForResponse(
        (r) => /\/api\/baselines\/.+\/activate$/.test(r.url()) && r.request().method() === 'PATCH'
      ),
      rowA.getByRole('button', { name: 'Aktifkan' }).click(),
    ])
    expect(activateResponse.ok()).toBe(true)
    await expect(page.getByText('Baseline diaktifkan')).toBeVisible()

    // A is active again, and B — deactivated by this PATCH — shows
    // "Aktifkan" again, confirming deactivate-others is real behavior and
    // not merely assumed from the POST-create path.
    await expect(rowA.getByText('Aktif', { exact: true })).toBeVisible()
    await expect(rowB.getByRole('button', { name: 'Aktifkan' })).toBeVisible()
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
