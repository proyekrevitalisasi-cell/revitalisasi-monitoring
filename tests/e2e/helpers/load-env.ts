import fs from 'fs'
import path from 'path'

export function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '..', '..', '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const key = match[1]
    let value = match[2] ?? ''
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}
