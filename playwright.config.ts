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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.spec\.ts/,
      dependencies: ['fixtures-setup'],
      teardown: 'fixtures-teardown',
    },
  ],
})
