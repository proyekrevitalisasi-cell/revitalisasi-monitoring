'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { UsersTable } from './UsersTable'
import { LokasiTab } from './LokasiTab'
import type { Profile, Location } from '@/lib/types'

interface UsersLokasiClientProps {
  initialProfiles: Profile[]
  initialLocations: Location[]
  actorRole: 'admin' | 'super_admin'
  actorUserId: string
}

export function UsersLokasiClient({
  initialProfiles,
  initialLocations,
  actorRole,
  actorUserId,
}: UsersLokasiClientProps) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)

  return (
    <Tabs defaultValue="users">
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="lokasi">Lokasi</TabsTrigger>
      </TabsList>
      <TabsContent value="users">
        <UsersTable
          profiles={profiles}
          actorRole={actorRole}
          actorUserId={actorUserId}
          onProfilesChange={setProfiles}
        />
      </TabsContent>
      <TabsContent value="lokasi">
        <LokasiTab initialLocations={initialLocations} actorRole={actorRole} />
      </TabsContent>
    </Tabs>
  )
}
