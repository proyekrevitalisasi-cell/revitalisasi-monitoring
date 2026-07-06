import type { Browser, BrowserContext } from 'playwright/test'
import { authFile, Role } from './auth-state'

export async function newRoleContext(
  browser: Browser,
  baseURL: string | undefined,
  role: Role
): Promise<BrowserContext> {
  return browser.newContext({ storageState: authFile(role), baseURL })
}
