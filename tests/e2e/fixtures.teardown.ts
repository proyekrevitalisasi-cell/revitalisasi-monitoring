import { test as teardown } from 'playwright/test'
import fs from 'fs'
import path from 'path'
import { deleteLocationByCode } from './helpers/db-cleanup'

teardown('remove shared E2E location fixture', async () => {
  const fixturePath = path.join(__dirname, '.fixtures', 'shared-location.json')
  if (!fs.existsSync(fixturePath)) return
  const { locationCode } = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
  await deleteLocationByCode(locationCode)
  fs.rmSync(fixturePath)
})
