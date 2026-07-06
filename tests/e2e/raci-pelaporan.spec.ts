// tests/e2e/raci-pelaporan.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { fillDialogField } from './helpers/dialog'
import { deleteStakeholderByCode, deleteReportingItemById } from './helpers/db-cleanup'

test.describe('RACI', () => {
  test.use({ storageState: authFile('admin') })

  test('admin adds a stakeholder, sets a RACI cell, and reorders it', async ({ page }) => {
    // Timestamp-suffixed per the suite's idempotency rule (fixture codes must never be a fixed
    // literal, so a mid-run cleanup failure can't wedge the next run with a duplicate-code
    // error) — same pattern as `audit-users.spec.ts`'s `e2e.user.${Date.now()}@...`.
    // `stakeholders.code` is capped at 20 chars (lib/validations.ts), which comfortably fits a
    // prefix plus the full timestamp.
    const code = `E2ESTK${Date.now()}`
    await page.goto('/raci')
    await page.getByRole('button', { name: '+ Tambah Stakeholder' }).click()
    const dialog = page.getByRole('dialog')
    await fillDialogField(dialog, 'Kode', code)
    await fillDialogField(dialog, 'Nama', 'E2E Stakeholder')
    await fillDialogField(dialog, 'Grup', 'E2E Group')
    await dialog.getByRole('button', { name: 'Simpan' }).click()

    // Code is known before creation even starts, so cleanup can be captured immediately and
    // run in `finally` no matter which assertion below fails — including the very first one
    // confirming creation succeeded.
    try {
      // exact match required: the header's own <span title="..."> and the column's
      // "Nonaktifkan <code> — <name>" delete-button title both contain "E2E Stakeholder",
      // so a substring/regex match hits Playwright's strict-mode violation across two elements.
      await expect(page.getByTitle('E2E Stakeholder (E2E Group)', { exact: true })).toBeVisible()

      // new stakeholder is always inserted with the highest display_order (AddStakeholderModal
      // passes nextDisplayOrder = current count), and GET /api/stakeholders orders ascending —
      // so it's always the last column, making `td:last-child` reliable here.
      const headerCell = page.locator('th', {
        has: page.getByTitle('E2E Stakeholder (E2E Group)', { exact: true }),
      })
      // Geser kiri/kanan buttons render text content "▲"/"▼" with a `title` attribute holding
      // the human-readable label; accessible-name computation uses text content when present,
      // so `getByRole(..., { name: 'Geser kiri' })` never matches. `getByTitle` reads the
      // attribute directly and is scoped uniquely within this header cell.
      await headerCell.getByTitle('Geser kiri').click()

      const f1Row = page.locator('tr', { has: page.getByText('F1 —') })
      await f1Row.locator('td').last().getByRole('combobox').click()
      await page.getByRole('option', { name: 'R', exact: true }).click()
    } finally {
      await deleteStakeholderByCode(code)
    }
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

    try {
      await expect(page.getByText('E2E Laporan Mingguan')).toBeVisible()
    } finally {
      const listRes = await page.request.get(`${baseURL}/api/reporting-items`)
      const { data: items } = await listRes.json()
      const created = (items as Array<{ id: string; jenis_laporan: string }>)
        .find((i) => i.jenis_laporan === 'E2E Laporan Mingguan')
      if (created) await deleteReportingItemById(created.id)
    }
  })
})
