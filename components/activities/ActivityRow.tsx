'use client'

import { toast } from 'sonner'
import { TableCell, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SaveStatusBadge, type SaveStatus } from './SaveStatusBadge'
import { computeDurasiHK, validateRencanaDates, validateRealisasiDates } from '@/lib/activity-helpers'
import { cn } from '@/lib/utils'
import type { Activity } from '@/lib/types'

const STATUS_LABELS: Record<Activity['status'], string> = {
  belum_mulai: 'Belum Mulai',
  sedang_berjalan: 'Sedang Berjalan',
  selesai: 'Selesai',
  ditunda: 'Ditunda',
}

interface ActivityRowProps {
  activity: Activity
  index: number
  isFirst: boolean
  isLast: boolean
  depCount: number
  holidays: string[]
  isAdmin: boolean
  saveStatus: SaveStatus
  onFieldChange: (id: string, changes: Partial<Activity>) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onToggleLock: (id: string) => void
}

export function ActivityRow({
  activity,
  index,
  isFirst,
  isLast,
  depCount,
  holidays,
  isAdmin,
  saveStatus,
  onFieldChange,
  onMove,
  onToggleLock,
}: ActivityRowProps) {
  const holidayDates = holidays.map((h) => new Date(h))
  const durasiHK = computeDurasiHK(activity.tanggal_mulai_rencana, activity.tanggal_selesai_rencana, holidayDates)

  function handleRencanaDateChange(field: 'tanggal_mulai_rencana' | 'tanggal_selesai_rencana', value: string) {
    const mulai = field === 'tanggal_mulai_rencana' ? value : activity.tanggal_mulai_rencana
    const selesai = field === 'tanggal_selesai_rencana' ? value : activity.tanggal_selesai_rencana
    const validationError = validateRencanaDates(mulai, selesai)
    if (validationError) {
      toast.error(validationError)
      return
    }
    onFieldChange(activity.id, { [field]: value })
  }

  function handleRealisasiDateChange(field: 'tanggal_mulai_realisasi' | 'tanggal_selesai_realisasi', value: string) {
    const nextValue = value || null
    const mulai = field === 'tanggal_mulai_realisasi' ? nextValue : activity.tanggal_mulai_realisasi
    const selesai = field === 'tanggal_selesai_realisasi' ? nextValue : activity.tanggal_selesai_realisasi
    const validationError = validateRealisasiDates(mulai, selesai)
    if (validationError) {
      toast.error(validationError)
      return
    }
    onFieldChange(activity.id, { [field]: nextValue })
  }

  return (
    <TableRow className={activity.is_on_critical_path ? 'bg-red-50/40' : undefined}>
      {isAdmin && (
        <TableCell>
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => onMove(activity.id, 'up')}
              disabled={isFirst}
              className="text-gray-400 hover:text-blue-600 disabled:opacity-20 text-xs leading-none"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => onMove(activity.id, 'down')}
              disabled={isLast}
              className="text-gray-400 hover:text-blue-600 disabled:opacity-20 text-xs leading-none"
            >
              ▼
            </button>
          </div>
        </TableCell>
      )}
      <TableCell className="text-xs text-gray-400">{index + 1}</TableCell>
      <TableCell>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => onFieldChange(activity.id, { is_milestone: !activity.is_milestone })}
            className={activity.is_milestone ? 'opacity-100' : 'opacity-20'}
            title="Toggle milestone"
          >
            ♦
          </button>
        ) : (
          activity.is_milestone ? '♦' : ''
        )}
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={() => onToggleLock(activity.id)}
          disabled={!isAdmin}
          className={activity.date_locked ? 'opacity-100' : 'opacity-20'}
          title="Toggle kunci tanggal"
        >
          🔒
        </button>
      </TableCell>
      <TableCell>{activity.is_on_critical_path && <Badge variant="destructive">Kritis</Badge>}</TableCell>
      <TableCell>
        {isAdmin ? (
          // defaultValue (uncontrolled): keeps the caret stable while the debounced
          // save round-trips, instead of re-rendering the DOM value on every parent update.
          <Input
            defaultValue={activity.kegiatan}
            onChange={(e) => onFieldChange(activity.id, { kegiatan: e.target.value })}
            className="h-8 min-w-[220px]"
          />
        ) : (
          activity.kegiatan
        )}
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <Input
            defaultValue={activity.pic}
            onChange={(e) => onFieldChange(activity.id, { pic: e.target.value })}
            className="h-8 w-24"
          />
        ) : (
          activity.pic
        )}
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{depCount}</Badge>
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <Input
            type="date"
            defaultValue={activity.tanggal_mulai_rencana}
            onChange={(e) => handleRencanaDateChange('tanggal_mulai_rencana', e.target.value)}
            className="h-8"
          />
        ) : (
          activity.tanggal_mulai_rencana
        )}
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <Input
            type="date"
            defaultValue={activity.tanggal_selesai_rencana}
            onChange={(e) => handleRencanaDateChange('tanggal_selesai_rencana', e.target.value)}
            className="h-8"
          />
        ) : (
          activity.tanggal_selesai_rencana
        )}
      </TableCell>
      <TableCell className="text-center text-gray-500">{durasiHK}</TableCell>
      <TableCell className="text-gray-300">–</TableCell>
      <TableCell className="text-gray-300">–</TableCell>
      <TableCell>
        {isAdmin ? (
          <Input
            type="date"
            defaultValue={activity.tanggal_mulai_realisasi ?? ''}
            onChange={(e) => handleRealisasiDateChange('tanggal_mulai_realisasi', e.target.value)}
            className="h-8"
          />
        ) : (
          activity.tanggal_mulai_realisasi ?? '–'
        )}
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <Input
            type="date"
            defaultValue={activity.tanggal_selesai_realisasi ?? ''}
            onChange={(e) => handleRealisasiDateChange('tanggal_selesai_realisasi', e.target.value)}
            className="h-8"
          />
        ) : (
          activity.tanggal_selesai_realisasi ?? '–'
        )}
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <Select
            value={activity.status}
            onValueChange={(value) => {
              const changes: Partial<Activity> = { status: value as Activity['status'] }
              if (value === 'selesai') changes.progress_pct = 100
              if (value === 'belum_mulai') changes.progress_pct = 0
              onFieldChange(activity.id, changes)
            }}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(STATUS_LABELS) as [Activity['status'], string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant={activity.status === 'selesai' ? 'default' : 'secondary'}>
            {STATUS_LABELS[activity.status]}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <div className="flex flex-col gap-1">
            <div className="flex gap-0.5">
              {[0, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => onFieldChange(activity.id, { progress_pct: pct })}
                  className={cn(
                    'text-[10px] px-1 py-0.5 rounded border',
                    activity.progress_pct === pct
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                  )}
                >
                  {pct}
                </button>
              ))}
            </div>
            <Input
              type="number"
              min={0}
              max={100}
              value={activity.progress_pct}
              onChange={(e) => {
                const value = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                onFieldChange(activity.id, { progress_pct: value })
              }}
              className="h-6 w-16 text-xs"
            />
          </div>
        ) : (
          `${activity.progress_pct}%`
        )}
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <Textarea
            defaultValue={activity.catatan ?? ''}
            onChange={(e) => onFieldChange(activity.id, { catatan: e.target.value || null })}
            className="h-8 min-w-[160px] resize-none"
            rows={1}
          />
        ) : (
          activity.catatan ?? '–'
        )}
      </TableCell>
      <TableCell className="text-gray-300">–</TableCell>
      {isAdmin && (
        <TableCell>
          <SaveStatusBadge status={saveStatus} />
        </TableCell>
      )}
      {isAdmin && <TableCell />}
    </TableRow>
  )
}
