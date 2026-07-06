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

    const activateBtn = row.getByRole('button', { name: 'Aktifkan' })
    if (await activateBtn.count() > 0) {
      await activateBtn.click()
      await expect(page.getByText('Baseline diaktifkan')).toBeVisible()
      await expect(row.getByText('Aktif', { exact: true })).toBeVisible()
    } else {
      // POST /api/locations/{id}/baselines creates new baselines already
      // active (and deactivates prior ones), so a freshly created baseline
      // has no "Aktifkan" button — assert the resulting active state instead.
      await expect(row.getByText('Aktif', { exact: true })).toBeVisible()
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
