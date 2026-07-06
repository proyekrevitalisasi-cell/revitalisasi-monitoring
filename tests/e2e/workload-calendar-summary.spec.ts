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
    await expect(page.getByRole('heading', { name: 'Workload View' })).toBeVisible()
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
    await expect(adminPage.getByRole('heading', { name: 'Kalender Kerja' })).toBeVisible()
    await adminContext.close()
  })
})

test.describe('Weekly Summary viewer access', () => {
  test.use({ storageState: authFile('viewer') })

  test('Weekly Summary navigates weeks and shows the WhatsApp copy button', async ({ page }) => {
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
