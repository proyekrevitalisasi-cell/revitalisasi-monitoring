import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { fillDialogField } from './helpers/dialog'
import { deleteLocationByCode } from './helpers/db-cleanup'
import { getSharedLocation } from './helpers/shared-location'

test.describe('location CRUD (admin/SA)', () => {
  test.use({ storageState: authFile('superadmin') })

  test('super_admin creates, edits, and deactivates a location with a digit in its code', async ({ page }) => {
    // Timestamp-suffixed per the suite's idempotency rule (fixture codes must never be a fixed
    // literal, so a mid-run cleanup failure can't wedge the next run with a duplicate-code error).
    // `locations.code` is capped at 10 chars (lib/validations.ts) and uppercased server-side, so a
    // full `Date.now()` won't fit — a 6-digit slice does, and (being all digits) it also keeps the
    // Minggu 10 Sidebar routing regression guard: the code must contain a digit.
    const code = `E2E${(Date.now() % 900000) + 100000}`
    try {
      await page.goto('/users')
      await page.getByRole('tab', { name: 'Lokasi' }).click()
      await page.getByRole('button', { name: '+ Tambah Lokasi' }).click()
      const addDialog = page.getByRole('dialog')
      await expect(addDialog).toBeVisible()
      await fillDialogField(addDialog, 'Nama', 'E2E Lokasi Digit Test')
      await fillDialogField(addDialog, 'Kode', code)
      await fillDialogField(addDialog, 'Tanggal Mulai Proyek', '2026-02-01')
      await addDialog.getByRole('button', { name: 'Simpan' }).click()
      // Wait for the location card's code to be visible (not the select dropdown option)
      await expect(page.locator('span', { hasText: code })).toBeVisible()

      // regression guard: numeric-containing location code must route correctly (Minggu 10 bug)
      await page.goto(`/dashboard/${code}/fase-1`)
      await expect(page.getByRole('button', { name: '+ Tambah Kegiatan' })).toBeVisible()

      await page.goto('/users')
      await page.getByRole('tab', { name: 'Lokasi' }).click()
      // Find and click Edit button in the card containing this code
      const card = page
        .locator('div', { has: page.getByText(`(${code})`) })
        .filter({ has: page.getByRole('button', { name: 'Edit' }) })
        .last()
      await card.getByRole('button', { name: 'Edit' }).click()
      const editDialog = page.getByRole('dialog')
      await expect(editDialog).toBeVisible()
      await fillDialogField(editDialog, 'Nama', 'E2E Lokasi Digit Test (Edited)')
      await editDialog.getByRole('button', { name: 'Simpan' }).click()
      await expect(page.getByText('E2E Lokasi Digit Test (Edited)')).toBeVisible()

      // Find and click Nonaktifkan button in the card containing this code
      const cardForDeactivate = page
        .locator('div', { has: page.getByText(`(${code})`) })
        .filter({ has: page.getByRole('button', { name: 'Nonaktifkan' }) })
        .last()
      await cardForDeactivate.getByRole('button', { name: 'Nonaktifkan' }).click()
      const confirmDialog = page.getByRole('dialog')
      await expect(confirmDialog).toBeVisible()
      await confirmDialog.getByRole('button', { name: 'Nonaktifkan' }).click()
      await expect(page.getByText('E2E Lokasi Digit Test (Edited)')).toHaveCount(0)
    } finally {
      await deleteLocationByCode(code)
    }
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
    const { locationCode, phases } = getSharedLocation()
    const adminContext = await newRoleContext(browser, baseURL, 'admin')
    const adminPage = await adminContext.newPage()
    let activityId: string | undefined
    let activityId2: string | undefined

    try {
      await adminPage.goto(`/dashboard/${locationCode}/fase-1`)

      await adminPage.getByRole('button', { name: '+ Tambah Kegiatan' }).click()
      const dialog = adminPage.getByRole('dialog')
      await fillDialogField(dialog, 'Kegiatan', 'E2E Fase Test Activity')
      await fillDialogField(dialog, 'PIC', 'E2E Tester')
      await fillDialogField(dialog, 'Rencana Mulai', '2026-03-01')
      await fillDialogField(dialog, 'Rencana Selesai', '2026-03-05')
      const [createRes] = await Promise.all([
        adminPage.waitForResponse(
          (res) => res.url().endsWith('/activities') && res.request().method() === 'POST'
        ),
        dialog.getByRole('button', { name: 'Tambah' }).click(),
      ])
      const { data: created } = await createRes.json()
      activityId = created.id

      // An `input[value="..."]` attribute selector (not getByText) is required here: as admin,
      // ActivityRow renders "Kegiatan"/"PIC" as <Input defaultValue=...>, so the name lives in
      // an input VALUE, not a text node — getByText can never match it for an admin-rendered
      // row. (Playwright has no getByDisplayValue — that's a React Testing Library API, not
      // Playwright's — so we match on the value content attribute instead, which is exactly
      // what React's `defaultValue` reflects into on initial render.)
      const row = adminPage.locator('tr', { has: adminPage.locator('input[value="E2E Fase Test Activity"]') })
      await expect(row).toBeVisible()

      // inline edit: change PIC, wait for the debounced autosave (600ms) to actually round-trip
      // rather than sleeping a guessed duration — avoids flaking under slow dev-server response times.
      const picInput = row.locator('input').nth(1)
      await Promise.all([
        adminPage.waitForResponse(
          (res) => res.url().endsWith(`/api/activities/${activityId}`) && res.request().method() === 'PATCH'
        ),
        picInput.fill('E2E Tester Updated'),
      ])
      await adminPage.reload()
      const reloadedRow = adminPage.locator('tr', { has: adminPage.locator('input[value="E2E Fase Test Activity"]') })
      await expect(reloadedRow.locator('input[value="E2E Tester Updated"]')).toBeVisible()

      // lock toggle
      await reloadedRow.locator('button[title="Toggle kunci tanggal"]').click()
      await adminPage.waitForTimeout(500)

      // second activity — added after the first so it starts with the next display_order —
      // used to verify the ▲ reorder control actually swaps display_order with its
      // immediate predecessor.
      await adminPage.getByRole('button', { name: '+ Tambah Kegiatan' }).click()
      const dialog2 = adminPage.getByRole('dialog')
      await fillDialogField(dialog2, 'Kegiatan', 'E2E Fase Test Activity 2')
      await fillDialogField(dialog2, 'PIC', 'E2E Tester 2')
      await fillDialogField(dialog2, 'Rencana Mulai', '2026-03-06')
      await fillDialogField(dialog2, 'Rencana Selesai', '2026-03-10')
      const [createRes2] = await Promise.all([
        adminPage.waitForResponse(
          (res) => res.url().endsWith('/activities') && res.request().method() === 'POST'
        ),
        dialog2.getByRole('button', { name: 'Tambah' }).click(),
      ])
      const { data: created2 } = await createRes2.json()
      activityId2 = created2.id

      const row2 = adminPage.locator('tr', { has: adminPage.locator('input[value="E2E Fase Test Activity 2"]') })
      await expect(row2).toBeVisible()

      // reorder: move the second activity up — it should swap display_order with the first
      await Promise.all([
        adminPage.waitForResponse(
          (res) => res.url().endsWith('/api/activities/reorder') && res.request().method() === 'PATCH'
        ),
        row2.getByRole('button', { name: '▲' }).click(),
      ])

      const activitiesRes = await adminPage.request.get(`${baseURL}/api/phases/${phases.F1}/activities`)
      const { data: phaseActivities } = (await activitiesRes.json()) as {
        data: Array<{ id: string; display_order: number }>
      }
      const order1 = phaseActivities.find((a) => a.id === activityId)?.display_order
      const order2 = phaseActivities.find((a) => a.id === activityId2)?.display_order
      expect(order1).not.toBeUndefined()
      expect(order2).not.toBeUndefined()
      expect(order2 as number).toBeLessThan(order1 as number)

      await adminContext.close()

      const viewerContext = await newRoleContext(browser, baseURL, 'viewer')
      try {
        const viewerPage = await viewerContext.newPage()
        await viewerPage.goto(`/dashboard/${locationCode}/fase-1`)
        await expect(viewerPage.getByRole('button', { name: '+ Tambah Kegiatan' })).toHaveCount(0)
        // Viewer renders these columns as plain text, so getByText is correct here.
        await expect(viewerPage.locator('tr', { has: viewerPage.getByText('E2E Fase Test Activity') }).locator('input')).toHaveCount(0)
      } finally {
        await viewerContext.close()
      }
    } finally {
      const cleanupContext = await newRoleContext(browser, baseURL, 'admin')
      const cleanupPage = await cleanupContext.newPage()
      if (activityId) {
        await cleanupPage.request.delete(`${baseURL}/api/activities/${activityId}`)
      }
      if (activityId2) {
        await cleanupPage.request.delete(`${baseURL}/api/activities/${activityId2}`)
      }
      await cleanupContext.close()
    }
  })
})
