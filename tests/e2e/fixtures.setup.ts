import { test as setup, expect } from 'playwright/test'
import fs from 'fs'
import path from 'path'
import { authFile } from './helpers/auth-state'

setup.use({ storageState: authFile('admin') })

setup('create shared E2E location fixture', async ({ page, baseURL }) => {
  const res = await page.request.post(`${baseURL}/api/locations`, {
    data: {
      name: 'E2E Shared Test Location',
      code: 'E2ESH',
      description: 'Dibuat otomatis oleh Playwright (tests/e2e/fixtures.setup.ts) — jangan hapus manual saat suite berjalan',
      project_start_date: '2026-01-01',
    },
  })
  expect(res.ok()).toBeTruthy()
  const { data: location } = await res.json()

  const phasesRes = await page.request.get(`${baseURL}/api/locations/${location.id}/phases`)
  expect(phasesRes.ok()).toBeTruthy()
  const { data: phases } = await phasesRes.json()
  const phaseMap = Object.fromEntries(
    (phases as Array<{ phase_code: string; id: string }>).map((p) => [p.phase_code, p.id])
  )

  const fixturesDir = path.join(__dirname, '.fixtures')
  fs.mkdirSync(fixturesDir, { recursive: true })
  fs.writeFileSync(
    path.join(fixturesDir, 'shared-location.json'),
    JSON.stringify({ locationId: location.id, locationCode: location.code, phases: phaseMap }, null, 2)
  )
})
