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
    const baselineName = `E2E Baseline ${Date.now()}`
    await page.goto(`/dashboard/${locationCode}/timeline`)

    await page.getByRole('button', { name: 'Kelola Baseline' }).click()
    const dialog = page.getByRole('dialog')
    // The `has` inner locator must not be built from `dialog.getByText(...)`:
    // that bakes the `role=dialog` ancestor into the sub-selector, which is
    // then searched for *inside* each candidate div — never true, since the
    // div is a descendant of the dialog, not the other way around, so it
    // always yields 0 matches. Build the inner locator from `page` instead.
    await dialog.locator('div', { has: page.getByText('Nama Baseline', { exact: true }) })
      .locator('input').fill(baselineName)
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
    const row = dialog.locator('div.flex.items-center.justify-between', { hasText: baselineName })
    await expect(row).toHaveCount(1)

    // POST /api/locations/{id}/baselines creates new baselines already active
    // (and deactivates prior ones), so our freshly created baseline never has
    // an "Aktifkan" button of its own — assert the resulting active state.
    await expect(row.getByText('Aktif', { exact: true })).toBeVisible()

    // Exercise the real activate-via-UI path (PATCH /api/baselines/{id}/activate)
    // against a DIFFERENT, pre-existing row: creating our baseline just
    // deactivated every other row in this location's history, and baselines
    // are never deleted, so the shared location always has at least one older
    // row left over from prior runs that now shows "Aktifkan". Which specific
    // historical row gets reactivated doesn't matter — picking the first
    // match via a stable locator is enough to prove the endpoint works and
    // that activating it really deactivates the row we just created.
    const candidateRow = dialog
      .locator('div.flex.items-center.justify-between')
      .filter({ has: page.getByRole('button', { name: 'Aktifkan' }) })
      .first()
    await expect(candidateRow).toBeVisible()
    // Capture the candidate row's own name now and rebuild a name-keyed
    // locator for later assertions: `candidateRow` is a live `.filter(...)`
    // query re-evaluated on every access, and once we activate it, it stops
    // having an "Aktifkan" button — so re-reading `candidateRow` after the
    // click would silently retarget to a different row.
    const otherBaselineName = await candidateRow.locator('p.font-medium').innerText()
    const otherRow = dialog.locator('div.flex.items-center.justify-between', { hasText: otherBaselineName })

    const [activateResponse] = await Promise.all([
      page.waitForResponse(
        (r) => /\/api\/baselines\/.+\/activate$/.test(r.url()) && r.request().method() === 'PATCH'
      ),
      candidateRow.getByRole('button', { name: 'Aktifkan' }).click(),
    ])
    expect(activateResponse.ok()).toBe(true)
    await expect(page.getByText('Baseline diaktifkan')).toBeVisible()

    // The other row is now active, and ours — deactivated by this PATCH —
    // shows "Aktifkan" again, confirming deactivate-others is real behavior
    // and not merely assumed from the POST-create path.
    await expect(otherRow.getByText('Aktif', { exact: true })).toBeVisible()
    await expect(row.getByRole('button', { name: 'Aktifkan' })).toBeVisible()
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
