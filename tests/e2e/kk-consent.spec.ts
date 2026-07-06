// tests/e2e/kk-consent.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { getSharedLocation } from './helpers/shared-location'

test.describe('Persetujuan Warga (KK consent)', () => {
  test.use({ storageState: authFile('admin') })

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

    // NOTE: `.locator('div', { has: ... })` matches every ancestor div of the "Target KK"
    // label, not just its immediate field wrapper — the label sits inside a `space-y-1`
    // div, which is nested inside the `grid grid-cols-2` fields div, which is nested inside
    // the form's outer `max-w-xl space-y-6` div. Document order lists parents before
    // descendants, so `.first()` would resolve to the outermost (whole-form) div and then
    // `.locator('input')` on it would grab the *first* input in the entire form (Target KK's
    // sibling fields Setuju/Menolak all have inputs too), not necessarily Target KK's own.
    // `.last()` picks the innermost, most specific div — the one that wraps only the
    // "Target KK" label and its own input — matching the fix already applied in
    // tests/e2e/helpers/dialog.ts's resolveField().
    const targetField = page.locator('div', { has: page.getByText('Target KK', { exact: true }) })
      .last().locator('input')
    // Clear first, then fill: this row's target_kk may already be '50' from a prior test
    // run (the mutation is permanent by design — see task brief). Filling the same string
    // into an input that already holds that value is a same-value write, so React's
    // ChangeEventPlugin (updateValueIfChanged) never dispatches onChange and nothing
    // autosaves. Clearing first guarantees an actual value transition every run.
    await targetField.fill('')
    await targetField.fill('50')
    await page.waitForTimeout(1000)
    await expect(page.getByText('✓ Tersimpan')).toBeVisible()

    await page.reload()
    await expect(page.locator('div', { has: page.getByText('Target KK', { exact: true }) })
      .last().locator('input')).toHaveValue('50')
  })
})
