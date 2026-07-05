# Minggu 12 — Audit Log & Users/Lokasi (Design)

**Tanggal:** 2026-07-05
**Status:** Approved

## Konteks

Backend untuk kedua fitur ini sudah lengkap sejak Minggu 2: tabel `audit_logs`, `profiles`,
`locations`, RLS, dan semua API routes (`/api/audit-logs`, `/api/users`, `/api/users/[id]`,
`/api/locations`, `/api/locations/[locationId]`). Minggu ini murni UI, mengikuti pola server
page + `isAdmin`/role prop + Client component yang sudah dipakai sejak Minggu 9.

**Satu gap backend ditemukan:** `GET /api/audit-logs` (`app/api/audit-logs/route.ts`) tidak
men-select kolom `old_value`/`new_value` (keduanya `JSONB`, ada di tabel sejak Minggu 1) padahal
PRD §10.13 mensyaratkan modal diff old vs new value. Ditambahkan ke select list — bukan endpoint
baru, cuma menambah 2 field ke select yang sudah ada.

## Keputusan Desain

1. **Satu halaman `/users` dengan 2 tab (Users, Lokasi), bukan 2 halaman terpisah.** Sidebar
   sudah punya SATU nav link "⚙️ Users & Lokasi" mengarah ke `/users` (bukan 2 link terpisah untuk
   `/users` dan `/locations`) — struktur tab mengikuti apa yang sudah ditetapkan di navigasi,
   bukan diciptakan baru minggu ini.
2. **Toggle nonaktifkan user pakai endpoint berbeda tergantung role aktor.** Backend punya 2
   jalur: `PATCH /api/users/[id]` (body `{ is_active }`, admin boleh untuk target Viewer, SA
   boleh untuk siapa saja, TAPI tidak memaksa sign-out) dan `DELETE /api/users/[id]` (SA-only,
   memaksa sign-out via `admin.auth.admin.signOut`). Toggle nonaktifkan (ON→OFF): SA memakai
   `DELETE` (sign-out paksa, lebih aman), Admin memakai `PATCH` (satu-satunya jalur yang bisa
   diakses Admin, hanya untuk baris Viewer). Toggle aktifkan kembali (OFF→ON): selalu `PATCH { is_active:
   true }` — tidak ada endpoint "un-delete" terpisah.
3. **Tab Lokasi tidak fetch nested phases/activities.** PRD §10.15 hanya minta kartu
   nama/kode/deskripsi + tombol edit — tidak ada progress stat di kartu, jadi server page query
   field lokasi polos saja, tidak reuse query nested `GET /api/locations` yang dipakai halaman lain.

## Halaman Audit Log (`/audit-log`)

**Akses:** whole-page gate Admin & SA, pola sama seperti `/work-calendar` (Minggu 10) —
`notFound()` untuk Viewer, bukan cuma sembunyikan UI.

**Server page (`app/(app)/audit-log/page.tsx`):**
- Gate: `getSession()` → kalau bukan admin/SA, `notFound()`.
- Fetch page pertama `audit_logs` (limit 50, order `created_at desc`) langsung via Supabase
  (bukan lewat `/api/audit-logs` sendiri — pola server-page biasa).
- Fetch daftar `profiles` (id, full_name, email) buat opsi filter user — request ringan terpisah.

**Client (`components/audit-log/AuditLogClient.tsx`):**
- 4 filter: entity_type (dropdown 12 opsi tetap — `activities`, `baselines`, `kk_consent`,
  `locations`, `reporting_items`, `stakeholders`, `activity_dependencies`, `risk_items`, `phases`,
  `work_calendar`, `profiles`, `raci_entries` — daftar ini diambil dari setiap
  `entityType:` string yang benar-benar dipakai `insertAuditLog()` di seluruh codebase saat ini),
  user (dropdown dari daftar profiles), action (CREATE/UPDATE/DELETE/LOGIN/LOGOUT/
  BASELINE_SAVE/RECALCULATE), rentang tanggal (dari–sampai).
- Ubah filter → `GET /api/audit-logs?entity_type=&user_id=&from=&to=&page=1&limit=50` (route ini
  sudah support semua query param ini, tidak berubah).
- Tabel: Waktu, User (nama+email), Aksi (badge warna per action type), Entitas, Perubahan
  Ringkas (`entity_description`).
- Pagination 50/baris pakai `total`/`page`/`limit` dari response API yang sudah ada.
- Klik baris → modal (`AuditDetailModal.tsx`) menampilkan `old_value` vs `new_value` sebagai JSON
  yang diformat (`JSON.stringify(value, null, 2)` di dalam `<pre>`), berdampingan atau bertumpuk.

**Perubahan backend kecil:** `app/api/audit-logs/route.ts` — tambah `old_value, new_value` ke
select list (sebelumnya cuma `id, user_email, user_name, action, entity_type, entity_id,
entity_description, created_at`).

## Halaman Users & Lokasi (`/users`)

**Akses:** whole-page gate Admin & SA (sama seperti Audit Log).

**Server page (`app/(app)/users/page.tsx`):**
- Gate sama seperti Audit Log.
- Fetch semua `profiles` (TANPA filter `is_active` — perlu lihat akun nonaktif juga), termasuk
  nama pembuat via self-join: `.select('id, email, full_name, role, is_active, created_at,
  created_by:profiles!created_by(full_name)')`.
- Fetch semua `locations` aktif (field polos: id, name, code, description, project_start_date,
  created_at — tanpa nested phases).
- Compute role aktor (`admin` atau `super_admin`) dan `userId` sendiri (buat exclude toggle di
  baris sendiri), pass sebagai props.

**Client (`components/users/UsersLokasiClient.tsx`):**
- shadcn `Tabs` (pola sama Kalender Kerja Minggu 10): tab "Users" dan tab "Lokasi".

**Tab Users (`components/users/UsersTable.tsx`):**
- Kolom: Nama, Email, Role (badge), Status (badge aktif/nonaktif), Dibuat oleh, Tanggal dibuat.
- **"+ Buat User"** (`AddUserModal.tsx`): email, full_name, password, role. Opsi role dropdown
  dibatasi client-side sesuai actor role — Admin cuma lihat opsi "Viewer", SA lihat "Admin" dan
  "Viewer" (super_admin tidak pernah jadi opsi, konsisten `createUserSchema` yang cuma terima
  `'admin'|'viewer'`). `POST /api/users`.
- Toggle per baris (`UserActiveToggle.tsx`):
  - Baris sendiri (`profile.id === userId`): toggle tidak dirender sama sekali.
  - Actor Admin: toggle cuma dirender untuk baris ber-role `viewer` (baris admin/SA lain tidak
    ada toggle — Admin memang tidak boleh mengubahnya, backend 403 kalau dipaksa). ON→OFF pakai
    `PATCH { is_active: false }`. OFF→ON pakai `PATCH { is_active: true }`.
  - Actor SA: toggle dirender untuk semua baris selain diri sendiri. ON→OFF pakai
    `DELETE /api/users/[id]` (paksa sign-out). OFF→ON pakai `PATCH { is_active: true }`.

**Tab Lokasi (`components/users/LokasiTab.tsx`):**
- Kartu per lokasi: nama, kode, deskripsi, tanggal mulai proyek.
- Tombol edit (pencil) → modal (`EditLocationModal.tsx`, field name+description saja, sesuai
  `updateLocationSchema`) → `PATCH /api/locations/[locationId]`.
- **"+ Tambah Lokasi"** (`AddLocationModal.tsx`): name, code, description, project_start_date →
  `POST /api/locations` (memicu `createLocationWithTemplate` — scaffold 4 fase otomatis, sudah
  ada, tidak disentuh).
- Tombol "Nonaktifkan" per kartu — **SA-only**, dirender kondisional pada role actor (bukan cuma
  disabled) → `DELETE /api/locations/[locationId]`. Tidak ada jalur reaktivasi (soft-delete
  permanen dari sisi UI, sama seperti stakeholder/holiday di minggu-minggu sebelumnya).

## Error Handling

Konvensi yang sama di semua halaman sebelumnya: toast.error pada kegagalan fetch, optimistic
update di-revert ke state sebelumnya kalau request gagal.

## Testing

- Tidak ada Vitest baru — tidak ada lib pure-logic baru (semua CRUD + role-gating sederhana).
- Real-browser Playwright pass di akhir, dengan penekanan khusus pada matriks role (Admin vs SA
  vs Viewer) untuk toggle user dan tombol nonaktifkan lokasi — ini kelas bug yang sebelumnya baru
  ketemu lewat E2E, bukan review kode (contoh: whole-page gate Kalender Kerja Minggu 10).

## Scope Non-Goals

- Tidak ada perubahan skema DB.
- Tidak ada endpoint API baru — hanya penambahan 2 kolom (`old_value`, `new_value`) ke select
  list `GET /api/audit-logs` yang sudah ada.
- Tidak ada jalur reaktivasi lokasi yang dinonaktifkan.
- Tidak ada self-registration atau ubah password sendiri di halaman ini (di luar scope PRD v1).
