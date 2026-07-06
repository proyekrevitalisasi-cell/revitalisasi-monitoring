import fs from 'fs'
import path from 'path'

export interface SharedLocationFixture {
  locationId: string
  locationCode: string
  phases: Record<'F1' | 'F2' | 'F3' | 'F4', string>
}

export function getSharedLocation(): SharedLocationFixture {
  const fixturePath = path.join(__dirname, '..', '.fixtures', 'shared-location.json')
  return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
}
