'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WorkloadHeatmap } from './WorkloadHeatmap'
import { computeWeekColumns, buildPicWorkload } from '@/lib/workload-metrics'
import type { WorkloadActivity } from '@/lib/types'

interface WorkloadClientProps {
  activities: WorkloadActivity[]
  locations: Array<{ code: string; name: string }>
}

const PHASE_OPTIONS = ['F1', 'F2', 'F3', 'F4']

export function WorkloadClient({ activities, locations }: WorkloadClientProps) {
  const [locationFilter, setLocationFilter] = useState('all')
  const [phaseFilter, setPhaseFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (locationFilter !== 'all' && a.locationCode !== locationFilter) return false
      if (phaseFilter !== 'all' && a.phaseCode !== phaseFilter) return false
      if (dateFrom || dateTo) {
        const from = dateFrom || '0000-01-01'
        const to = dateTo || '9999-12-31'
        if (a.tanggal_mulai_rencana > to || a.tanggal_selesai_rencana < from) return false
      }
      return true
    })
  }, [activities, locationFilter, phaseFilter, dateFrom, dateTo])

  const today = new Date()
  const weekColumns = useMemo(() => computeWeekColumns(today, 12), [])
  const rows = useMemo(() => buildPicWorkload(filtered, weekColumns, today), [filtered, weekColumns])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500">Lokasi</Label>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Lokasi</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.code} value={loc.code}>
                  {loc.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500">Fase</Label>
          <Select value={phaseFilter} onValueChange={setPhaseFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Fase</SelectItem>
              {PHASE_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500">Dari Tanggal</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500">Sampai Tanggal</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {rows.map((row) => (
          <Card key={row.pic}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{row.pic}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Kegiatan aktif</span>
                <span className="font-medium">{row.activeCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Jadwal terdekat</span>
                <span className="font-medium">{row.nextStart ?? '–'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Progres rata-rata</span>
                <span className="font-medium">{row.avgProgress}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <WorkloadHeatmap rows={rows} weekColumns={weekColumns} activities={filtered} />
    </div>
  )
}
