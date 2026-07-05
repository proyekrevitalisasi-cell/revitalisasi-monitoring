# Minggu 11 — RACI & Pelaporan (Design)

**Tanggal:** 2026-07-05
**Status:** Approved

## Konteks

Backend untuk kedua fitur ini sudah lengkap sejak Minggu 2: tabel `raci_entries` dan
`reporting_items`, RLS, semua API routes (`/api/phases/[id]/raci`,
`/api/phases/[id]/raci/[stakeholderId]`, `/api/stakeholders`, `/api/stakeholders/[id]`,
`/api/reporting-items`, `/api/reporting-items/[id]`), dan Zod schemas di `lib/validations.ts`.
Minggu ini murni UI, mengikuti pola yang sama dengan Minggu 9 (Risk Register) dan Minggu 10
(PM Views): server page fetch langsung via Supabase + `isAdmin` boolean prop, Client component
menangani interaksi lewat fetch ke API routes yang sudah ada.

Tidak ada perubahan skema atau endpoint baru. Satu-satunya "penulisan baru" di backend adalah
memakai ulang `PATCH /api/stakeholders/[id]` dua kali untuk reorder swap (lihat di bawah) —
tidak ada endpoint reorder baru.

## Keputusan Desain

1. **Reorder kolom RACI pakai tombol ▲▼, bukan drag-and-drop (@dnd-kit).** PRD menyebut "drag
   reorder kolom", tapi Minggu 3 sudah menetapkan preseden eksplisit: pilih tombol ▲▼ manual di
   atas `@dnd-kit` untuk reorder kegiatan ("user's explicit choice"). Demi konsistensi pola di
   seluruh codebase, RACI ikut preseden ini. `@dnd-kit` tetap terinstall tapi tidak dipakai di
   fitur manapun.
2. **Pelaporan pakai modal add/edit, bukan inline-editable table.** Sama seperti
   `RiskFormModal` — satu modal dipakai untuk create dan edit, tabel tampil read-only dengan
   tombol Edit/Hapus per baris.
3. **Pelaporan tidak punya reorder.** PRD hanya menyebut reorder untuk kolom stakeholder RACI
   (§Roadmap: "RACI editable + drag reorder, halaman pelaporan editable" — reorder cuma disebut
   untuk RACI). Baris baru di Pelaporan di-append di akhir (`display_order = max + 1`).

## Halaman RACI (`/raci`)

**Akses:** semua role bisa lihat (nav link di luar blok `isAdmin` di Sidebar). Admin & SA bisa
edit.

**Kenapa perlu location selector:** `raci_entries.phase_id` merujuk ke `phases`, dan `phases`
adalah per-lokasi (`location_id` FK, `UNIQUE(location_id, phase_code)`). Tapi `/raci` adalah nav
"Global" (di luar blok "Pilih Lokasi" yang scoped ke `[locationCode]` URL). Jadi halaman ini
punya location selector sendiri di dalam halaman — pola yang sama seperti Workload View
(`/workload`, PRD §10.10: "Filter: lokasi").

**Server page (`app/(app)/raci/page.tsx`):**
- Fetch semua `locations` aktif (`id, code, name`, order by `display_order`).
- Fetch semua `stakeholders` aktif (`id, code, name, group_name, display_order`, order by
  `display_order`).
- Compute `isAdmin` dari session, pass sebagai prop.
- Tidak fetch phases/raci_entries di server — itu di-load client-side setelah lokasi dipilih.

**Client (`components/raci/RaciClient.tsx`):**
- `<select>` lokasi di atas. Saat berubah:
  - `GET /api/locations/[locationId]/phases` → ambil `id, phase_code, name` tiap fase (abaikan
    `activities` nested yang ikut terbawa response, tidak dipakai di sini).
  - Untuk tiap fase, `GET /api/phases/[id]/raci` → entries `{ stakeholder_id, role }`.
- **Matrix** (`RaciMatrix.tsx`): baris = fase F1–F4 (urut `display_order`), kolom = stakeholder
  aktif dikelompokkan visual per `group_name` di header.
- **Cell** (`RaciCell.tsx`):
  - Admin: dropdown R/A/C/I/— (hapus). `onChange` → `PUT
    /api/phases/[phaseId]/raci/[stakeholderId]` body `{ role: 'R'|'A'|'C'|'I'|null }`. Optimistic
    update lokal, revert + toast error kalau gagal. `role: null` → baris `raci_entries` terhapus
    (sudah dihandle route existing).
  - Viewer: badge teks statis, tanpa dropdown.
- **Header kolom stakeholder:**
  - Admin: ▲▼ untuk swap `display_order` dengan stakeholder tetangga — 2× `PATCH
    /api/stakeholders/[id]` (diri sendiri + tetangga, tukar nilai `display_order`). Optimistic
    reorder lokal, revert kalau salah satu PATCH gagal.
  - × untuk soft-delete kolom → confirm dialog generik (pola sama seperti
    `DeleteRiskDialog`/`DeleteHolidayDialog`) → `DELETE /api/stakeholders/[id]`.
- **"+ Tambah Stakeholder"** (admin only) → `AddStakeholderModal.tsx` (field: kode, nama, grup)
  → `POST /api/stakeholders`.
- **Legend** di bawah tabel: arti R/A/C/I + daftar lengkap kode→nama→grup stakeholder aktif.

## Halaman Pelaporan (`/pelaporan`)

**Akses:** semua role bisa lihat. Admin & SA bisa tambah/edit/hapus.

**Server page (`app/(app)/pelaporan/page.tsx`):**
- Fetch semua `reporting_items` (`select('*')`, order by `display_order`).
- Compute `isAdmin`, pass sebagai prop.

**Client (`components/pelaporan/PelaporanClient.tsx`):**
- Tabel read-only, kolom: Jenis Laporan, Dari (PIC), Kepada, Frekuensi, Isi Konten,
  Format/Media, + kolom Aksi (admin only: Edit/Hapus).
- **"+ Tambah Baris"** (admin only) → `ReportingItemFormModal.tsx` (1 modal dipakai
  create+edit, pola sama `RiskFormModal`) → `POST`/`PATCH /api/reporting-items`.
  `display_order` untuk baris baru dihitung client-side: `max(existing) + 1`.
- Hapus → confirm dialog generik → `DELETE /api/reporting-items/[id]`.
- Viewer: tabel tanpa kolom Aksi, tanpa tombol tambah.

## Error Handling

Konvensi yang sama di semua halaman sebelumnya: tiap fetch gagal → `toast.error(json.error?.message
?? fallback)`, optimistic update di-revert ke state sebelumnya kalau request gagal. Tidak ada
silent failure.

## Testing

- Tidak ada Vitest baru — tidak ada lib pure-logic baru yang perlu di-unit-test (beda dari
  Minggu 9/10 yang punya `risk-utils.ts`/`workload-metrics.ts`). Semua logic di sini CRUD +
  swap-display-order sederhana, sudah tercakup oleh Zod schema existing + E2E.
- Real-browser Playwright pass di akhir (pola sama tiap minggu) — cross-role check (viewer
  read-only, admin full access), console error check, cleanup data test.

## Scope Non-Goals

- Tidak ada perubahan skema DB.
- Tidak ada endpoint API baru (reorder pakai ulang `PATCH /api/stakeholders/[id]` existing).
- Tidak ada reorder untuk Pelaporan.
- Tidak ada drag-and-drop di manapun (konsisten preseden Minggu 3).
