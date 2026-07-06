// tests/e2e/dependencies-cpm.spec.ts
import { test, expect } from 'playwright/test'
import { authFile } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { getSharedLocation } from './helpers/shared-location'

test.describe('dependencies + CPM auto-shift', () => {
  test.use({ storageState: authFile('admin') })

  let actIdA: string
  let actIdB: string
  let actIdC: string

  test.beforeAll(async ({ browser, baseURL }) => {
    const { phases } = getSharedLocation()
    const context = await newRoleContext(browser, baseURL, 'admin')
    const page = await context.newPage()

    async function createActivity(name: string, start: string, end: string) {
      const res = await page.request.post(`${baseURL}/api/phases/${phases.F1}/activities`, {
        data: { kegiatan: name, pic: 'E2E Tester', tanggal_mulai_rencana: start, tanggal_selesai_rencana: end },
      })
      const { data } = await res.json()
      return data.id as string
    }

    actIdA = await createActivity('E2E CPM Act A', '2026-01-05', '2026-01-09')
    actIdB = await createActivity('E2E CPM Act B', '2026-01-05', '2026-01-07')
    actIdC = await createActivity('E2E CPM Act C', '2026-01-05', '2026-01-07')
    await context.close()
  })

  test.afterAll(async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'superadmin')
    const page = await context.newPage()
    // delete predecessor last (successors first) to avoid HAS_SUCCESSORS 409s
    for (const id of [actIdB, actIdC, actIdA]) {
      await page.request.delete(`${baseURL}/api/activities/${id}`)
    }
    await context.close()
  })

  test('adding an FS dependency shifts the successor and shows the toast', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/fase-1`)

    const rowB = page.locator('tr', { has: page.locator(`input[value="E2E CPM Act B"]`) })
    // Row also contains 5 progress-percentage buttons (0/25/50/75/100) that match a bare
    // digit-text filter, so getByRole('button').filter({ hasText: /^\d+$/ }) is ambiguous
    // (resolves to 6 elements). DependencyPanel's trigger AND DeleteActivityDialog's trigger
    // are both Radix DialogTriggers (both carry aria-haspopup="dialog"), so combine that
    // attribute with the digit-text filter (delete's trigger is a 🗑️ icon, not a digit) to
    // uniquely land on the dependency-count badge button.
    await rowB.locator('button[aria-haspopup="dialog"]').filter({ hasText: /^\d+$/ }).click()
    const panel = page.getByRole('dialog', { name: /Dependensi Kegiatan/ })
    await panel.getByRole('tab', { name: /Predecessor/ }).click()
    await panel.getByText('+ Tambah Predecessor').click()
    await panel.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /E2E CPM Act A/ }).click()
    await panel.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'FS', exact: true }).click()

    const [depResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/dependencies') && r.request().method() === 'POST'),
      panel.getByRole('button', { name: 'Tambah' }).click(),
    ])
    const depJson = await depResponse.json()
    expect(depJson.data.cpm.hasCycle).toBe(false)
    expect(depJson.data.cpm.shiftedCount).toBeGreaterThanOrEqual(1)
    // `updatedActivities` always contains an entry for every activity in the location
    // (runCpmForLocation recalculates the whole network on every dependency change, not
    // just the ones whose dates actually moved), so `.find()` returning something is not
    // itself proof of a shift — assert the FS relationship directly instead: B must start
    // strictly after A's own CPM-computed finish date. Hardcoding an expected absolute date
    // (e.g. '2026-01-09') is fragile here because A's own start date is ALSO recalculated
    // relative to the location's project_start_date by this same CPM run (both A and B had
    // no predecessors before this test, so both were already reset to project start by the
    // CPM run that fires on every activity creation) — so A no longer sits at its
    // originally-created 2026-01-05..2026-01-09 range by the time this assertion runs.
    const shiftedA = depJson.data.cpm.updatedActivities.find((a: { id: string }) => a.id === actIdA)
    const shiftedB = depJson.data.cpm.updatedActivities.find((a: { id: string }) => a.id === actIdB)
    expect(shiftedA).toBeTruthy()
    expect(shiftedB).toBeTruthy()
    expect(shiftedB.tanggal_mulai_rencana > shiftedA.tanggal_selesai_rencana).toBe(true)

    await expect(page.getByText(/kegiatan ikut disesuaikan jadwalnya/)).toBeVisible()
  })

  test('a dependency that would create a cycle is rejected with the exact server message', async ({ page }) => {
    const { locationCode } = getSharedLocation()
    await page.goto(`/dashboard/${locationCode}/fase-1`)

    // A -> B already exists from the previous test; now try B -> A (cycle)
    const rowA = page.locator('tr', { has: page.locator(`input[value="E2E CPM Act A"]`) })
    await rowA.locator('button[aria-haspopup="dialog"]').filter({ hasText: /^\d+$/ }).click()
    const panel = page.getByRole('dialog', { name: /Dependensi Kegiatan/ })
    await panel.getByRole('tab', { name: /Predecessor/ }).click()
    await panel.getByText('+ Tambah Predecessor').click()
    await panel.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /E2E CPM Act B/ }).click()
    await panel.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'FS', exact: true }).click()
    await panel.getByRole('button', { name: 'Tambah' }).click()

    await expect(page.getByText('Dependensi ini akan menciptakan siklus (circular dependency)')).toBeVisible()
  })

  test('a locked activity does not shift when its predecessor moves', async ({ page, baseURL }) => {
    const { locationCode } = getSharedLocation()
    await page.request.patch(`${baseURL}/api/activities/${actIdC}/lock`)

    await page.goto(`/dashboard/${locationCode}/fase-1`)
    const rowC = page.locator('tr', { has: page.locator(`input[value="E2E CPM Act C"]`) })
    const beforeStart = await rowC.locator('input[type="date"]').first().inputValue()

    const rowA = page.locator('tr', { has: page.locator(`input[value="E2E CPM Act A"]`) })
    await rowA.locator('button[aria-haspopup="dialog"]').filter({ hasText: /^\d+$/ }).click()
    const panel = page.getByRole('dialog', { name: /Dependensi Kegiatan/ })
    await panel.getByRole('tab', { name: /Successor/ }).click()
    await panel.getByText('+ Tambah Successor').click()
    await panel.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /E2E CPM Act C/ }).click()
    await panel.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'FS', exact: true }).click()

    const [depResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/dependencies') && r.request().method() === 'POST'),
      panel.getByRole('button', { name: 'Tambah' }).click(),
    ])
    const depJson = await depResponse.json()
    // updatedActivities always includes every activity in the location (see the comment in
    // the first test) — a locked activity's row is still present, but its dates must be
    // UNCHANGED from immediately before this request, not absent from the array.
    const shiftedC = depJson.data.cpm.updatedActivities.find((a: { id: string }) => a.id === actIdC)
    expect(shiftedC).toBeTruthy()
    expect(shiftedC.tanggal_mulai_rencana).toBe(beforeStart) // date_locked activities are excluded from CPM shifting

    await page.reload()
    const afterStart = await page.locator('tr', { has: page.locator(`input[value="E2E CPM Act C"]`) })
      .locator('input[type="date"]').first().inputValue()
    expect(afterStart).toBe(beforeStart)
  })
})
