import { defineConfig, devices } from 'playwright/test'
import { loadEnvLocal } from './tests/e2e/helpers/load-env'

loadEnvLocal()

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'fixtures-setup', testMatch: /fixtures\.setup\.ts/, dependencies: ['setup'] },
    { name: 'fixtures-teardown', testMatch: /fixtures\.teardown\.ts/ },
    // Deliberately NOT wired via `dependencies`/`teardown` to fixtures-setup/teardown:
    // Playwright reruns a project's dependencies AND its declared teardown on every
    // invocation of that project, even `npx playwright test onefile.spec.ts`. The shared
    // E2ESH location fixture must persist across many separate task-scoped spec-file runs,
    // so wiring it here made fixtures-setup fail on the 2nd run (duplicate location code)
    // and fixtures-teardown silently delete the shared fixture after every single run.
    // Run `--project=setup --project=fixtures-setup` once before the suite, and
    // `--project=fixtures-teardown` once at the very end (see the plan's Task 13).
    // See tests/e2e/README.md for how to run the full suite reliably — bare
    // `npm run test:e2e` / `playwright test` alone is NOT a safe way to run everything at once.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.spec\.ts/,
    },
  ],
})
