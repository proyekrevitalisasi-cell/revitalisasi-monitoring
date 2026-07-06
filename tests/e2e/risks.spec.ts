// tests/e2e/risks.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { fillDialogField, selectDialogOption } from './helpers/dialog'
import { getSharedLocation } from './helpers/shared-location'

test.describe('risk register', () => {
  test.use({ storageState: authFile('admin') })

  test('admin creates a risk, sees it scored/placed in the matrix, then edits it', async ({ page, baseURL }) => {
    const { locationCode, phases } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/risks`)

    let createdId: string | undefined
    try {
      await page.getByRole('button', { name: '+ Tambah Risiko' }).click()
      const addDialog = page.getByRole('dialog')
      await selectDialogOption(page, addDialog, 'Fase', /F1/)
      await fillDialogField(addDialog, 'Judul', 'E2E Risiko Keterlambatan Material')
      await fillDialogField(addDialog, 'Deskripsi', 'Risiko dibuat oleh Playwright')
      await selectDialogOption(page, addDialog, 'Probabilitas', '5')
      await selectDialogOption(page, addDialog, 'Dampak', '5')
      await addDialog.getByRole('button', { name: 'Simpan' }).click()
      await expect(page.getByText('E2E Risiko Keterlambatan Material')).toBeVisible()

      // look up the created risk's id via the phase-scoped list endpoint (there is no
      // top-level GET /api/risks — only GET /api/phases/{phaseId}/risks and
      // DELETE /api/risks/{id} exist) so it can be hard-deleted in the finally block.
      // Captured immediately after creation is confirmed so that any later assertion
      // failure (matrix cell, edit flow, toast) still leaves createdId set and the
      // finally block able to clean up the persisted row.
      const listRes = await page.request.get(`${baseURL}/api/phases/${phases.F1}/risks`)
      const { data: risks } = await listRes.json()
      const created = (risks as Array<{ id: string; title: string }>).find(
        (r) => r.title === 'E2E Risiko Keterlambatan Material'
      )
      createdId = created?.id

      // score 5x5=25 -> P5/D5 matrix cell should now show a nonzero count
      await expect(page.locator('button[title="Probabilitas 5 × Dampak 5 = Skor 25"]')).not.toHaveText('')

      const row = page.locator('tr', { has: page.getByText('E2E Risiko Keterlambatan Material') })
      await row.locator('button[title="Edit risiko"]').click()
      const editDialog = page.getByRole('dialog')
      await selectDialogOption(page, editDialog, 'Status', 'Mitigated')
      await editDialog.getByRole('button', { name: 'Simpan' }).click()
      await expect(page.getByText('Risiko diperbarui')).toBeVisible()
    } finally {
      if (createdId) await page.request.delete(`${baseURL}/api/risks/${createdId}`)
    }
  })

  test('viewer cannot see + Tambah Risiko', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'viewer')
    const page = await context.newPage()
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/risks`)
    await expect(page.getByRole('button', { name: '+ Tambah Risiko' })).toHaveCount(0)
    await context.close()
  })
})
