'use client'

import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UserActiveToggle } from './UserActiveToggle'
import { AddUserModal } from './AddUserModal'
import type { Profile } from '@/lib/types'

const ROLE_LABELS: Record<Profile['role'], string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  viewer: 'Viewer',
}

interface UsersTableProps {
  profiles: Profile[]
  actorRole: 'admin' | 'super_admin'
  actorUserId: string
  onProfilesChange: (updater: (prev: Profile[]) => Profile[]) => void
}

export function UsersTable({
  profiles,
  actorRole,
  actorUserId,
  onProfilesChange,
}: UsersTableProps) {
  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]))

  function handleToggled(id: string, isActive: boolean) {
    onProfilesChange((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: isActive } : p)))
  }

  function handleAdded(profile: Profile) {
    onProfilesChange((prev) => [profile, ...prev])
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddUserModal actorRole={actorRole} actorUserId={actorUserId} onAdded={handleAdded} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dibuat oleh</TableHead>
            <TableHead>Tanggal Dibuat</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.full_name}</TableCell>
              <TableCell className="text-gray-500">{p.email}</TableCell>
              <TableCell>
                <Badge variant="secondary">{ROLE_LABELS[p.role]}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={p.is_active ? 'outline' : 'secondary'}>
                  {p.is_active ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-500">
                {p.created_by ? nameById.get(p.created_by) ?? '–' : '–'}
              </TableCell>
              <TableCell className="text-gray-500">
                {format(new Date(p.created_at), 'dd MMM yyyy')}
              </TableCell>
              <TableCell>
                <UserActiveToggle
                  targetUserId={p.id}
                  targetRole={p.role}
                  targetIsActive={p.is_active}
                  targetLabel={`${p.full_name} (${p.email})`}
                  actorRole={actorRole}
                  actorUserId={actorUserId}
                  onToggled={handleToggled}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
