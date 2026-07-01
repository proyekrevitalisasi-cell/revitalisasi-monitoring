'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'admin' | 'viewer'
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  viewer: 'Viewer',
}

export function UserMenu({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const initials = profile.full_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
        <p className="text-xs text-gray-500">{ROLE_LABELS[profile.role]}</p>
      </div>
      <button
        onClick={handleLogout}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 flex-shrink-0 transition-colors"
        title="Keluar"
      >
        {loading ? '...' : 'Keluar'}
      </button>
    </div>
  )
}
