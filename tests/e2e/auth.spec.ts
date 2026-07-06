// tests/e2e/auth.spec.ts
import { test, expect } from 'playwright/test'
import { authFile, SEED_CREDENTIALS, Role } from './helpers/auth-state'
import { newRoleContext } from './helpers/context'
import { deleteUserByEmail } from './helpers/db-cleanup'

test.describe('login', () => {
  for (const role of Object.keys(SEED_CREDENTIALS) as Role[]) {
    test(`${role} can log in and reach the dashboard`, async ({ page }) => {
      const { email, password } = SEED_CREDENTIALS[role]
      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Masuk' }).click()
      await page.waitForURL('/')
      await expect(page.getByText('Program Revitalisasi Rusun')).toBeVisible()
    })
  }

  test('wrong password shows an error and stays on /login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(SEED_CREDENTIALS.viewer.email)
    await page.getByLabel('Password').fill('WrongPassword123!')
    await page.getByRole('button', { name: 'Masuk' }).click()
    await expect(page.getByText('Email atau password salah')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('deactivated account is blocked at login', async ({ browser, baseURL }) => {
    const email = `e2e.deactivated.${Date.now()}@perumnas.co.id`
    let adminContext: any
    let superadminContext: any
    let loginContext: any

    try {
      adminContext = await newRoleContext(browser, baseURL, 'admin')
      const adminPage = await adminContext.newPage()

      const createRes = await adminPage.request.post(`${baseURL}/api/users`, {
        data: { email, full_name: 'E2E Deactivated User', password: 'Password123!', role: 'viewer' },
      })
      expect(createRes.ok()).toBeTruthy()
      const { data: created } = await createRes.json()

      superadminContext = await newRoleContext(browser, baseURL, 'superadmin')
      const superadminPage = await superadminContext.newPage()
      const deactivateRes = await superadminPage.request.delete(`${baseURL}/api/users/${created.id}`)
      expect(deactivateRes.ok()).toBeTruthy()

      // Use a fresh, unauthenticated context for the login attempt — deliberately
      // not newRoleContext() since this needs no storageState at all
      loginContext = await browser.newContext({ baseURL })
      const loginPage = await loginContext.newPage()
      await loginPage.goto('/login')
      await loginPage.getByLabel('Email').fill(email)
      await loginPage.getByLabel('Password').fill('Password123!')
      await loginPage.getByRole('button', { name: 'Masuk' }).click()
      await expect(loginPage.getByText('Akun Anda telah dinonaktifkan')).toBeVisible()
    } finally {
      await adminContext?.close()
      await superadminContext?.close()
      await loginContext?.close()
      await deleteUserByEmail(email)
    }
  })

})

test.describe('role-based sidebar visibility', () => {
  test('viewer does not see admin-only nav links', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'viewer')
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Kalender Kerja' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Audit Log' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Users & Lokasi' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'RACI' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pelaporan' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Workload View' })).toBeVisible()
    await context.close()
  })

  test('admin sees admin-only nav links', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'admin')
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Kalender Kerja' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Audit Log' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users & Lokasi' })).toBeVisible()
    await context.close()
  })
})

test.describe('logout', () => {
  test('logout returns to /login', async ({ browser, baseURL }) => {
    const context = await newRoleContext(browser, baseURL, 'viewer')
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: 'Keluar' }).click()
    await page.waitForURL('/login')
    await context.close()
  })
})
