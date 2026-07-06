// tests/e2e/timeline-gantt.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { getSharedLocation } from './helpers/shared-location'

test.describe('Timeline / Gantt', () => {
  test.use({ storageState: authFile('admin') })

  test('renders and view/baseline/dependency-arrow/critical-highlight toggles work', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/timeline`)
    await expect(page.getByRole('heading', { name: /Timeline \/ Gantt/ })).toBeVisible()

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
