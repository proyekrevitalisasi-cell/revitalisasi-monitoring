import path from 'path'

export type Role = 'superadmin' | 'admin' | 'viewer'

export const SEED_CREDENTIALS: Record<Role, { email: string; password: string }> = {
  superadmin: { email: 'superadmin@perumnas.co.id', password: 'SuperAdmin123!' },
  admin: { email: 'admin@perumnas.co.id', password: 'Admin123!' },
  viewer: { email: 'viewer@perumnas.co.id', password: 'Viewer123!' },
}

export function authFile(role: Role): string {
  return path.join(__dirname, '..', '.auth', `${role}.json`)
}
