'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { UserMenu } from './UserMenu'

interface Profile {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'admin' | 'viewer'
}

interface Location {
  id: string
  name: string
  code: string
}

interface SidebarProps {
  profile: Profile
  locations: Location[]
}

function NavLink({
  href,
  icon,
  label,
  pathname,
  exact = false,
}: {
  href: string
  icon: string
  label: string
  pathname: string
  exact?: boolean
}) {
  const isActive = exact
    ? pathname === href
    : pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
        isActive
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="leading-snug">{label}</span>
    </Link>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {label}
    </p>
  )
}

export function Sidebar({ profile, locations }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'

  // Location codes may contain digits (e.g. T5DEP, T11FIXA) -- [A-Z]+ alone
  // truncated the match at the first digit, silently sending every
  // location-scoped link (Timeline, Ringkasan Mingguan, Fase 1-4, Risk
  // Register, Persetujuan Warga) to a mangled URL like /dashboard/T/... for
  // any such location.
  const locationCodeMatch = pathname.match(/^\/dashboard\/([A-Z0-9]+)/)
  const currentCode = locationCodeMatch?.[1]

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col z-40">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">
            P
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Perumnas</div>
            <div className="text-xs text-gray-400">Revitalisasi Rusun</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        <NavLink href="/" icon="🌐" label="Dashboard Lintas-Lokasi" pathname={pathname} exact />

        <SectionLabel label="Pilih Lokasi" />
        <div className="px-1 pb-1">
          <select
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={currentCode ?? ''}
            onChange={(e) => {
              if (e.target.value) {
                window.location.href = `/dashboard/${e.target.value}`
              }
            }}
          >
            <option value="">— Pilih Lokasi —</option>
            {locations.map((loc) => (
              <option key={loc.code} value={loc.code}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>
        </div>

        {currentCode && (
          <>
            <NavLink href={`/dashboard/${currentCode}`} icon="📊" label="Ringkasan" pathname={pathname} exact />
            <NavLink href={`/dashboard/${currentCode}/timeline`} icon="📅" label="Timeline / Gantt" pathname={pathname} />
            <NavLink href={`/dashboard/${currentCode}/weekly-summary`} icon="🗞️" label="Ringkasan Mingguan" pathname={pathname} />
            <NavLink href={`/dashboard/${currentCode}/fase-1`} icon="📋" label="Fase 1 – Sosialisasi" pathname={pathname} />
            <NavLink href={`/dashboard/${currentCode}/fase-2`} icon="📋" label="Fase 2 – Investor" pathname={pathname} />
            <NavLink href={`/dashboard/${currentCode}/fase-3`} icon="📋" label="Fase 3 – Pemasaran" pathname={pathname} />
            <NavLink href={`/dashboard/${currentCode}/fase-4`} icon="📋" label="Fase 4 – Legal" pathname={pathname} />
            <NavLink href={`/dashboard/${currentCode}/risks`} icon="⚠️" label="Risk Register" pathname={pathname} />
            <NavLink href={`/dashboard/${currentCode}/kk-consent`} icon="🏘️" label="Persetujuan Warga" pathname={pathname} />
          </>
        )}

        <SectionLabel label="Global" />
        <NavLink href="/raci" icon="👥" label="RACI" pathname={pathname} />
        <NavLink href="/pelaporan" icon="📋" label="Pelaporan" pathname={pathname} />
        <NavLink href="/workload" icon="👔" label="Workload View" pathname={pathname} />

        {isAdmin && (
          <>
            <NavLink href="/work-calendar" icon="📅" label="Kalender Kerja" pathname={pathname} />
            <NavLink href="/audit-log" icon="📜" label="Audit Log" pathname={pathname} />
            <NavLink href="/users" icon="⚙️" label="Users & Lokasi" pathname={pathname} />
          </>
        )}
      </nav>

      {/* Footer — User */}
      <div className="border-t border-gray-200 p-2 flex-shrink-0">
        <UserMenu profile={profile} />
      </div>
    </aside>
  )
}
