'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { SaveStatusBadge, type SaveStatus } from '@/components/activities/SaveStatusBadge'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { cn } from '@/lib/utils'
import type { KkConsent } from '@/lib/types'

interface KkConsentFormProps {
  locationId: string
  initialData: KkConsent
  isAdmin: boolean
}

type EditableFields = Pick<KkConsent, 'target_kk' | 'setuju' | 'menolak' | 'catatan'>

export function KkConsentForm({ locationId, initialData, isAdmin }: KkConsentFormProps) {
  const [data, setData] = useState<KkConsent>(initialData)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const pendingChanges = useRef<Partial<EditableFields>>({})
  const savedSnapshot = useRef<KkConsent>(initialData)

  const setStatus = useCallback((status: SaveStatus) => {
    setSaveStatus(status)
    if (status === 'saved' || status === 'error') {
      setTimeout(
        () => {
          setSaveStatus((prev) => (prev === status ? 'idle' : prev))
        },
        status === 'saved' ? 2000 : 3000
      )
    }
  }, [])

  const flushSave = useCallback(async () => {
    const changes = pendingChanges.current
    if (Object.keys(changes).length === 0) return
    pendingChanges.current = {}
    setStatus('saving')
    try {
      const res = await fetch(`/api/locations/${locationId}/kk-consent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menyimpan')
      }
      savedSnapshot.current = json.data as KkConsent
      setData(json.data as KkConsent)
      setStatus('saved')
    } catch (err) {
      setData(savedSnapshot.current)
      setStatus('error')
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan')
    }
  }, [locationId, setStatus])

  const debouncedFlush = useDebouncedCallback(() => {
    flushSave()
  }, 600)

  function handleFieldChange(changes: Partial<EditableFields>) {
    setData((prev) => ({ ...prev, ...changes }))
    pendingChanges.current = { ...pendingChanges.current, ...changes }
    debouncedFlush()
  }

  const pct = data.target_kk > 0 ? Math.round((data.setuju / data.target_kk) * 100) : 0
  const metThreshold = pct >= data.threshold_pct

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Persetujuan Warga (KK)</h2>
        <p className="text-xs text-gray-400 mt-1">Sesuai UU No. 20/2011 Pasal 65 Ayat (2)</p>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">Progres Persetujuan</span>
          <span className={cn('font-medium', metThreshold ? 'text-green-600' : 'text-amber-600')}>
            {pct}% (ambang {data.threshold_pct}%)
          </span>
        </div>
        <Progress value={pct} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Target KK</Label>
          {isAdmin ? (
            <Input
              type="number"
              min={0}
              defaultValue={data.target_kk}
              onChange={(e) =>
                handleFieldChange({ target_kk: Math.max(0, Math.round(Number(e.target.value) || 0)) })
              }
            />
          ) : (
            <div className="text-sm text-gray-900">{data.target_kk}</div>
          )}
        </div>
        <div className="space-y-1">
          <Label>Belum Dihubungi</Label>
          <div className="text-sm text-gray-500">{data.belum_dihubungi}</div>
        </div>
        <div className="space-y-1">
          <Label>Jumlah Setuju</Label>
          {isAdmin ? (
            <Input
              type="number"
              min={0}
              defaultValue={data.setuju}
              onChange={(e) =>
                handleFieldChange({ setuju: Math.max(0, Math.round(Number(e.target.value) || 0)) })
              }
            />
          ) : (
            <div className="text-sm text-gray-900">{data.setuju}</div>
          )}
        </div>
        <div className="space-y-1">
          <Label>Jumlah Menolak</Label>
          {isAdmin ? (
            <Input
              type="number"
              min={0}
              defaultValue={data.menolak}
              onChange={(e) =>
                handleFieldChange({ menolak: Math.max(0, Math.round(Number(e.target.value) || 0)) })
              }
            />
          ) : (
            <div className="text-sm text-gray-900">{data.menolak}</div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Catatan</Label>
        {isAdmin ? (
          <Textarea
            defaultValue={data.catatan ?? ''}
            onChange={(e) => handleFieldChange({ catatan: e.target.value || null })}
            rows={3}
          />
        ) : (
          <div className="text-sm text-gray-500">{data.catatan ?? '–'}</div>
        )}
      </div>

      {isAdmin && (
        <div>
          <SaveStatusBadge status={saveStatus} />
        </div>
      )}
    </div>
  )
}
