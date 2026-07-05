'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AddLocationModal } from './AddLocationModal'
import { EditLocationModal } from './EditLocationModal'
import type { Location } from '@/lib/types'

interface LokasiTabProps {
  initialLocations: Location[]
  actorRole: 'admin' | 'super_admin'
}

export function LokasiTab({ initialLocations, actorRole }: LokasiTabProps) {
  const [locations, setLocations] = useState<Location[]>(initialLocations)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [deactivatingLocation, setDeactivatingLocation] = useState<Location | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleAdded(location: Location) {
    setLocations((prev) => [...prev, location])
  }

  function handleSaved(location: Location) {
    setLocations((prev) => prev.map((l) => (l.id === location.id ? location : l)))
  }

  async function handleDeactivateConfirm() {
    if (!deactivatingLocation) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/locations/${deactivatingLocation.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menonaktifkan lokasi')
      }
      setLocations((prev) => prev.filter((l) => l.id !== deactivatingLocation.id))
      toast.success('Lokasi dinonaktifkan')
      setDeactivatingLocation(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menonaktifkan lokasi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddLocationModal onAdded={handleAdded} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => (
          <Card key={loc.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {loc.name} <span className="text-gray-400 font-normal">({loc.code})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-500 space-y-1">
              <p>{loc.description || '–'}</p>
              <p className="text-xs">Mulai: {loc.project_start_date}</p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setEditingLocation(loc)}>
                Edit
              </Button>
              {actorRole === 'super_admin' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeactivatingLocation(loc)}
                >
                  Nonaktifkan
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <EditLocationModal
        open={editingLocation !== null}
        onOpenChange={(open) => !open && setEditingLocation(null)}
        location={editingLocation}
        onSaved={handleSaved}
      />

      <Dialog
        open={deactivatingLocation !== null}
        onOpenChange={(open) => !open && setDeactivatingLocation(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonaktifkan Lokasi</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Yakin ingin menonaktifkan{' '}
            <span className="font-medium">{deactivatingLocation?.name}</span>? Lokasi ini tidak
            akan tampil lagi di manapun.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivatingLocation(null)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDeactivateConfirm} disabled={submitting}>
              {submitting ? 'Menonaktifkan…' : 'Nonaktifkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
