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
    try {
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
    } finally {
      await deleteUserByEmail(email)
    }
  })

  test('super_admin cannot deactivate self and cannot change own role', async ({ browser, baseURL }) => {
    // Uses a super_admin actor (not admin) so this assertion isolates the self-target guard
    // (`target.id === user.id` in app/api/users/[id]/route.ts) from the two admin-only rules
    // that also return a generic forbidden() (admin-cannot-touch-non-viewer, admin-cannot-
    // escalate-to-admin) -- both of those only trigger `if (profile.role === 'admin')`, so a
    // super_admin self-PATCH with a payload it would otherwise be fully allowed to make on any
    // other user (role: 'viewer') can only 403 because of the self-target check.
    const superadminContext = await newRoleContext(browser, baseURL, 'superadmin')
    try {
      const superadminPage = await superadminContext.newPage()
      const meRes = await superadminPage.request.get(`${baseURL}/api/auth/me`)
      const { data: me } = await meRes.json()

      await superadminPage.goto('/users')
      const row = superadminPage.locator('tr', { has: superadminPage.getByText(me.email) })
      await expect(row.getByRole('button', { name: /Nonaktifkan|Aktifkan/ })).toHaveCount(0)

      const patchRes = await superadminPage.request.patch(`${baseURL}/api/users/${me.id}`, {
        data: { role: 'viewer' },
      })
      expect(patchRes.status()).toBe(403)
    } finally {
      await superadminContext.close()
    }
  })
})

test.describe('Audit Log', () => {
  test.use({ storageState: authFile('admin') })

  test('viewer gets 404, admin can filter by action and open the diff modal', async ({ browser, page, baseURL }) => {
    const viewerContext = await newRoleContext(browser, baseURL, 'viewer')
    try {
      const viewerPage = await viewerContext.newPage()
      const res = await viewerPage.goto('/audit-log')
      expect(res?.status()).toBe(404)
    } finally {
      await viewerContext.close()
    }

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
