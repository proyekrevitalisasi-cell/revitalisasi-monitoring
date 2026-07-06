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
