'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ReportingItemFormModal } from './ReportingItemFormModal'
import { DeleteReportingItemDialog } from './DeleteReportingItemDialog'
import type { ReportingItem } from '@/lib/types'

interface PelaporanClientProps {
  initialItems: ReportingItem[]
  isAdmin: boolean
}

export function PelaporanClient({ initialItems, isAdmin }: PelaporanClientProps) {
  const [items, setItems] = useState<ReportingItem[]>(initialItems)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ReportingItem | null>(null)

  function handleSaved(saved: ReportingItem) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id)
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]
    })
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function openCreateModal() {
    setEditingItem(null)
    setModalOpen(true)
  }

  function openEditModal(item: ReportingItem) {
    setEditingItem(item)
    setModalOpen(true)
  }

  const nextDisplayOrder =
    items.length === 0 ? 0 : Math.max(...items.map((i) => i.display_order)) + 1

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={openCreateModal}>+ Tambah Baris</Button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada rencana pelaporan.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis Laporan</TableHead>
              <TableHead>Dari</TableHead>
              <TableHead>Kepada</TableHead>
              <TableHead>Frekuensi</TableHead>
              <TableHead>Isi Konten</TableHead>
              <TableHead>Format/Media</TableHead>
              {isAdmin && <TableHead>Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.jenis_laporan}</TableCell>
                <TableCell>{item.dari_pic}</TableCell>
                <TableCell>{item.kepada}</TableCell>
                <TableCell>{item.frekuensi}</TableCell>
                <TableCell className="max-w-md whitespace-pre-wrap text-gray-600">
                  {item.isi_konten}
                </TableCell>
                <TableCell>{item.format_media}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Edit item pelaporan"
                      >
                        ✏️
                      </button>
                      <DeleteReportingItemDialog
                        itemId={item.id}
                        itemLabel={item.jenis_laporan}
                        onDeleted={handleDeleted}
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {isAdmin && (
        <ReportingItemFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          item={editingItem}
          nextDisplayOrder={nextDisplayOrder}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
