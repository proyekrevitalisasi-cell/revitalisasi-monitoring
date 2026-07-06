import { test as setup } from 'playwright/test'
import { authFile, SEED_CREDENTIALS, Role } from './helpers/auth-state'

for (const role of Object.keys(SEED_CREDENTIALS) as Role[]) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { email, password } = SEED_CREDENTIALS[role]
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Masuk' }).click()
    await page.waitForURL('/')
    await page.context().storageState({ path: authFile(role) })
  })
}
