# PRD: Dashboard Manajemen Proyek Revitalisasi Rusun
## Perum Perumnas — Sistem Pemantauan Multi-Lokasi

**Versi:** 2.0  
**Tanggal:** Juli 2026  
**Status:** Final — Siap Implementasi  
**Stack:** Next.js 14 · Supabase (PostgreSQL + Auth) · Vercel  

---

## Daftar Isi

1. [Latar Belakang](#1-latar-belakang)
2. [Tujuan Produk](#2-tujuan-produk)
3. [Scope v1](#3-scope-v1)
4. [Pengguna & Hierarki Peran](#4-pengguna--hierarki-peran)
5. [Tech Stack](#5-tech-stack)
6. [Skema Database](#6-skema-database)
7. [Row Level Security (RLS)](#7-row-level-security-rls)
8. [CPM Engine — Algoritma & Logika](#8-cpm-engine--algoritma--logika)
9. [API Routes](#9-api-routes)
10. [Fitur & Persyaratan Fungsional](#10-fitur--persyaratan-fungsional)
11. [Persyaratan Non-Fungsional](#11-persyaratan-non-fungsional)
12. [Struktur Proyek Next.js](#12-struktur-proyek-nextjs)
13. [Environment Variables](#13-environment-variables)
14. [Panduan Local Testing](#14-panduan-local-testing)
15. [Panduan Deployment ke Vercel + Supabase](#15-panduan-deployment-ke-vercel--supabase)
16. [Estimasi Milestone](#16-estimasi-milestone)
17. [Risiko & Mitigasi](#17-risiko--mitigasi)
18. [Seed Data](#18-seed-data)
19. [Glosarium](#19-glosarium)

---

## 1. Latar Belakang

Perum Perumnas menjalankan program revitalisasi rusun di 4 lokasi di Jakarta: **Tanah Abang, Kebon Kacang, Klender, dan Kemayoran Blok A**. Setiap lokasi memiliki 4 tahapan: Sosialisasi, Pencarian Investor/Mitra, Pemasaran (s.d. NUP), dan Legal & Permit.

Program ini melibatkan banyak pemangku kepentingan lintas-instansi (Perumnas, Bappenas, Pemprov DKI Jakarta). Saat ini pemantauan dilakukan via file Excel yang tidak real-time, tidak punya kontrol akses, tidak merekam riwayat perubahan, dan tidak mampu memodelkan ketergantungan antar-kegiatan maupun jalur kritis program.

---

## 2. Tujuan Produk

- Satu *single source of truth* untuk status progres revitalisasi semua lokasi
- Visualisasi Gantt dengan Rencana, Baseline, dan Realisasi sekaligus
- Memodelkan dependensi antar-kegiatan (FS/SS/FF/SF + lag) dan menghitung jalur kritis (CPM) secara otomatis
- Menggeser tanggal kegiatan downstream secara otomatis saat predecessor berubah
- Merekam seluruh perubahan dalam audit log
- Mendukung manajemen risiko, pemantauan beban kerja PIC, dan laporan mingguan otomatis

---

## 3. Scope v1

### Termasuk
- Multi-lokasi (4 lokasi awal + fitur tambah lokasi baru)
- Autentikasi berjenjang: Super Admin › Admin › Viewer
- Dashboard lintas-lokasi (ringkasan semua lokasi dalam satu halaman)
- Dashboard per-lokasi per-fase
- Gantt chart tiga lapis: Baseline · Rencana · Realisasi
- Dependensi antar-kegiatan (FS/SS/FF/SF + lag) dalam satu lokasi
- Critical Path Method (CPM) — auto-highlight jalur kritis, auto-shift tanggal
- Milestone (♦ marker di Gantt)
- Baseline Plan (snapshot jadwal awal, track deviasi)
- CRUD kegiatan per fase (add, edit, delete, reorder)
- RACI matrix editable (tambah/hapus stakeholder, ubah nilai)
- Risk Register per fase+lokasi
- Workload View per PIC
- Kalender kerja (hari libur nasional Indonesia)
- Tracker Persetujuan Warga / KK (khusus Fase 1)
- Weekly Summary Report (auto-generate, copyable)
- Rencana Pelaporan (halaman editable)
- Audit log lengkap
- Manajemen pengguna

### Tidak Termasuk v1
- Dependensi lintas lokasi
- Notifikasi email/WhatsApp otomatis
- Export PDF/Excel
- Komentar/diskusi per kegiatan
- Mobile app native
- Resource leveling otomatis

---

## 4. Pengguna & Hierarki Peran

```
Super Admin
    ├── Buat/nonaktifkan Admin dan Viewer
    ├── Akses penuh semua fitur & semua lokasi
    ├── Hapus lokasi (soft delete)
    └── Lihat audit log lengkap

Admin
    ├── Buat/nonaktifkan Viewer
    ├── Akses penuh semua fitur & semua lokasi (edit)
    ├── Tambah lokasi baru
    ├── Simpan/reset Baseline
    └── Lihat audit log

Viewer
    └── Lihat semua lokasi, fase, data — TANPA edit
```

**Aturan:**
- Tidak ada self-registration. Semua akun dibuat oleh Super Admin atau Admin.
- Super Admin pertama dibuat manual di Supabase Dashboard (bukan via UI app).
- Admin tidak bisa mengubah role Admin lain atau Super Admin.
- Akun `is_active = false` tidak bisa login.
- Admin hanya bisa membuat Viewer; Super Admin bisa membuat Admin atau Viewer.

---

## 5. Tech Stack

| Layer | Teknologi | Keterangan |
|---|---|---|
| Frontend | Next.js 14 (App Router) | RSC + Client Components |
| Styling | Tailwind CSS + shadcn/ui | Komponen UI |
| Auth | Supabase Auth (JWT) | Email + password, session via httpOnly cookie |
| Database | Supabase PostgreSQL | Managed, RLS aktif |
| Client | Supabase JS v2 + `@supabase/ssr` | Query + session management |
| API | Next.js Route Handlers | Serverless, di `/app/api/` |
| CPM Engine | TypeScript (`lib/cpm.ts`) | Pure function, server-side |
| Deployment | Vercel | Frontend + API routes |
| DB Hosting | Supabase Cloud | Region: Singapore (`ap-southeast-1`) |
| Local Dev | Supabase CLI + Docker | PostgreSQL lokal |
| E2E Testing | Playwright | Sebelum setiap deploy |

### Dependensi Package Utama
```json
{
  "next": "^14.2.0",
  "react": "^18.3.0",
  "@supabase/supabase-js": "^2.45.0",
  "@supabase/ssr": "^0.5.0",
  "tailwindcss": "^3.4.0",
  "lucide-react": "^0.383.0",
  "date-fns": "^3.6.0",
  "date-fns-holiday-id": "^1.0.0",
  "zod": "^3.23.0",
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0",
  "playwright": "^1.45.0"
}
```

> `date-fns-holiday-id` untuk kalender hari libur nasional Indonesia. Jika tidak tersedia, buat `lib/holidays-id.ts` yang mendaftar libur nasional secara manual per tahun.

---

## 6. Skema Database

> Semua tabel: UUID primary key, timestamps dalam `timestamptz`. Soft delete via `is_active = false`.

### 6.1 `profiles`
```sql
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL UNIQUE,
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'viewer')),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: isi profiles otomatis saat user baru dibuat
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 6.2 `locations`
```sql
CREATE TABLE public.locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,      -- "TA", "KK", "KL", "KMY"
  description   TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.3 `phases`
```sql
CREATE TABLE public.phases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  phase_code     TEXT NOT NULL CHECK (phase_code IN ('F1','F2','F3','F4')),
  name           TEXT NOT NULL,
  pic_utama      TEXT NOT NULL,
  display_order  INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, phase_code)
);
```

### 6.4 `activities`
```sql
CREATE TABLE public.activities (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id                  UUID NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  display_order             INTEGER NOT NULL DEFAULT 0,
  kegiatan                  TEXT NOT NULL,
  pic                       TEXT NOT NULL,

  -- Jadwal Rencana (dapat bergeser oleh CPM engine)
  tanggal_mulai_rencana     DATE NOT NULL,
  tanggal_selesai_rencana   DATE NOT NULL,

  -- Jadwal Realisasi (input manual)
  tanggal_mulai_realisasi   DATE,
  tanggal_selesai_realisasi DATE,

  -- Status & Progres
  status                    TEXT NOT NULL DEFAULT 'belum_mulai'
                            CHECK (status IN ('belum_mulai','sedang_berjalan','selesai','ditunda')),
  progress_pct              INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  catatan                   TEXT,

  -- Fitur PM
  is_milestone              BOOLEAN NOT NULL DEFAULT FALSE,
  is_on_critical_path       BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE = tanggal ini di-set manual oleh user, tidak digeser oleh CPM engine
  date_locked               BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  created_by                UUID REFERENCES public.profiles(id),
  updated_by                UUID REFERENCES public.profiles(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_phase_id ON public.activities(phase_id);
CREATE INDEX idx_activities_critical ON public.activities(is_on_critical_path) WHERE is_on_critical_path = TRUE;
```

### 6.5 `activity_dependencies`
```sql
-- Dependensi antar-kegiatan dalam SATU lokasi
CREATE TABLE public.activity_dependencies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- successor bergantung pada predecessor
  predecessor_id   UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  successor_id     UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  dep_type         TEXT NOT NULL CHECK (dep_type IN ('FS','SS','FF','SF')),
  lag_days         INTEGER NOT NULL DEFAULT 0,  -- negatif = lead time
  created_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (predecessor_id, successor_id),
  -- Cegah self-loop di level DB
  CHECK (predecessor_id <> successor_id)
);

CREATE INDEX idx_deps_predecessor ON public.activity_dependencies(predecessor_id);
CREATE INDEX idx_deps_successor   ON public.activity_dependencies(successor_id);
```

### 6.6 `baselines`
```sql
-- Satu lokasi dapat memiliki beberapa baseline (history)
CREATE TABLE public.baselines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,        -- "Baseline Awal", "Baseline Rev-1"
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,   -- hanya 1 baseline aktif per lokasi
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshot jadwal saat baseline disimpan
CREATE TABLE public.baseline_activities (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id              UUID NOT NULL REFERENCES public.baselines(id) ON DELETE CASCADE,
  activity_id              UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  kegiatan                 TEXT NOT NULL,          -- copy saat snapshot
  tanggal_mulai_rencana    DATE NOT NULL,
  tanggal_selesai_rencana  DATE NOT NULL,
  is_milestone             BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (baseline_id, activity_id)
);
```

### 6.7 `stakeholders`
```sql
CREATE TABLE public.stakeholders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  group_name     TEXT NOT NULL,    -- "Perumnas", "Bappenas", "Pemprov DKI", "Lainnya"
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.8 `raci_entries`
```sql
CREATE TABLE public.raci_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id         UUID NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  stakeholder_id   UUID NOT NULL REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  role             TEXT CHECK (role IN ('R','A','C','I')),
  updated_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phase_id, stakeholder_id)
);
```

### 6.9 `risk_items`
```sql
CREATE TABLE public.risk_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id      UUID NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL
                CHECK (category IN ('teknis','hukum','keuangan','sosial','lingkungan','lainnya')),
  probability   INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
  impact        INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  -- score = probability * impact, computed column
  score         INTEGER GENERATED ALWAYS AS (probability * impact) STORED,
  mitigation    TEXT,
  owner         TEXT,             -- PIC/instansi penanggung jawab risiko
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','mitigated','closed')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES public.profiles(id),
  updated_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risks_phase_id ON public.risk_items(phase_id);
```

### 6.10 `work_calendar`
```sql
-- Daftar hari tidak bekerja (libur nasional + cuti bersama)
CREATE TABLE public.work_calendar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name         TEXT NOT NULL,       -- "Hari Raya Idul Fitri"
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_work_calendar_date ON public.work_calendar(holiday_date);
```

### 6.11 `kk_consent` (Tracker Persetujuan Warga — Fase 1)
```sql
CREATE TABLE public.kk_consent (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE UNIQUE,
  target_kk       INTEGER NOT NULL DEFAULT 0,    -- total KK di lokasi
  setuju          INTEGER NOT NULL DEFAULT 0,
  menolak         INTEGER NOT NULL DEFAULT 0,
  belum_dihubungi INTEGER GENERATED ALWAYS AS
                  (target_kk - setuju - menolak) STORED,
  -- Threshold 60% sesuai UU No. 20/2011 Pasal 65 Ayat (2)
  threshold_pct   INTEGER NOT NULL DEFAULT 60,
  catatan         TEXT,
  updated_by      UUID REFERENCES public.profiles(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.12 `reporting_items`
```sql
CREATE TABLE public.reporting_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_order  INTEGER NOT NULL DEFAULT 0,
  jenis_laporan  TEXT NOT NULL,
  dari_pic       TEXT NOT NULL,
  kepada         TEXT NOT NULL,
  frekuensi      TEXT NOT NULL,
  isi_konten     TEXT NOT NULL,
  format_media   TEXT NOT NULL,
  updated_by     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.13 `audit_logs`
```sql
CREATE TABLE public.audit_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES public.profiles(id),
  user_email         TEXT NOT NULL,
  user_name          TEXT NOT NULL,
  action             TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','BASELINE_SAVE','RECALCULATE')),
  entity_type        TEXT NOT NULL,
  entity_id          UUID,
  entity_description TEXT,
  old_value          JSONB,
  new_value          JSONB,
  ip_address         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user    ON public.audit_logs(user_id);
CREATE INDEX idx_audit_entity  ON public.audit_logs(entity_type);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
```

---

## 7. Row Level Security (RLS)

```sql
-- Helper: ambil role user yang sedang login
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;

-- Pola umum untuk semua tabel data (locations, phases, activities, dll):
--   SELECT  → semua authenticated user
--   INSERT/UPDATE/DELETE → hanya admin dan super_admin

-- Contoh implementasi (ulangi pola ini untuk setiap tabel):
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_all_auth" ON public.activities
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "write_admin_only" ON public.activities
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','super_admin'))
  WITH CHECK (get_my_role() IN ('admin','super_admin'));

-- audit_logs: INSERT hanya dari service_role (via API server)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','super_admin'));

CREATE POLICY "audit_insert_service" ON public.audit_logs
  FOR INSERT TO service_role WITH CHECK (TRUE);

-- profiles: aturan khusus (lihat Bagian 4)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (is_active = TRUE);

CREATE POLICY "profiles_insert_sa" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_admin');

CREATE POLICY "profiles_insert_admin_viewer_only" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin' AND NEW.role = 'viewer');

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'super_admin' OR
    (get_my_role() = 'admin' AND role = 'viewer')
  );
```

---

## 8. CPM Engine — Algoritma & Logika

> Implementasikan seluruh bagian ini sebagai pure TypeScript di `lib/cpm.ts`. Tidak ada query DB di dalam fungsi CPM — data dependensi dan aktivitas sudah diambil sebelum dipanggil.

### 8.1 Tipe Data

```typescript
// lib/cpm.ts

export type DepType = 'FS' | 'SS' | 'FF' | 'SF'

export interface CpmActivity {
  id: string
  duration: number          // working days (dihitung dari tanggal_mulai/selesai_rencana)
  dateLocked: boolean       // true = tanggal tidak boleh digeser oleh CPM
}

export interface CpmDependency {
  predecessorId: string
  successorId: string
  type: DepType
  lagDays: number           // bisa negatif (lead time)
}

export interface CpmNode extends CpmActivity {
  earliestStart: number     // hari ke-N dari project epoch (0-based)
  earliestFinish: number
  latestStart: number
  latestFinish: number
  totalFloat: number
  isCritical: boolean
}

export interface CpmResult {
  nodes: Map<string, CpmNode>
  criticalPath: string[]    // array activity IDs dalam urutan jalur kritis
  hasCycle: boolean
  cycleIds: string[]        // IDs yang terlibat dalam siklus (jika ada)
}
```

### 8.2 Fungsi Utama

```typescript
/**
 * Jalankan CPM untuk seluruh kegiatan dalam satu lokasi.
 * 
 * @param activities    - Semua kegiatan di lokasi ini
 * @param dependencies  - Semua dependensi di lokasi ini
 * @param projectStart  - Tanggal awal proyek (epoch = hari ke-0)
 * @param holidays      - Daftar tanggal hari libur (untuk kalkulasi working days)
 */
export function runCpm(
  activities: CpmActivity[],
  dependencies: CpmDependency[],
  projectStart: Date,
  holidays: Date[]
): CpmResult
```

### 8.3 Langkah Implementasi CPM

#### Langkah 1 — Deteksi Siklus (wajib sebelum CPM)
Gunakan DFS (Depth-First Search) topological sort. Jika ditemukan back-edge, kembalikan `{ hasCycle: true, cycleIds: [...] }` dan hentikan proses. API harus menolak penyimpanan dependensi yang menciptakan siklus.

#### Langkah 2 — Topological Sort
Gunakan algoritma Kahn (BFS-based). Hasilkan urutan kegiatan dari yang tidak punya predecessor sampai yang paling hilir.

#### Langkah 3 — Forward Pass (Hitung ES dan EF)
Proses dalam urutan topological. Untuk setiap kegiatan, hitung `earliestStart` berdasarkan semua predecessornya:

```
Untuk setiap dependency (predecessor → successor, type, lag):

FS: ES(successor) = max(ES(successor), EF(predecessor) + lag)
SS: ES(successor) = max(ES(successor), ES(predecessor) + lag)
FF: EF(successor) = max(EF(successor), EF(predecessor) + lag)
    → ES(successor) = EF(successor) - duration
SF: EF(successor) = max(EF(successor), ES(predecessor) + lag)
    → ES(successor) = EF(successor) - duration

Kegiatan tanpa predecessor:
  ES = 0 (atau berdasarkan tanggal_mulai_rencana existing jika date_locked = true)

EF = ES + duration (dalam working days)
```

Untuk kegiatan dengan `dateLocked = true`: gunakan tanggal existing sebagai ES/EF, tidak diubah.

#### Langkah 4 — Backward Pass (Hitung LS dan LF)
Proses dalam urutan topological terbalik. `projectFinish` = max(EF) semua kegiatan.

```
Untuk setiap dependency (predecessor → successor, type, lag):

FS: LF(predecessor) = min(LF(predecessor), LS(successor) - lag)
SS: LS(predecessor) = min(LS(predecessor), LS(successor) - lag)
FF: LF(predecessor) = min(LF(predecessor), LF(successor) - lag)
SF: LS(predecessor) = min(LS(predecessor), LF(successor) - lag)

Kegiatan tanpa successor:
  LF = projectFinish
  LS = LF - duration
```

#### Langkah 5 — Hitung Float & Jalur Kritis
```
totalFloat = LS - ES   (atau LF - EF, keduanya sama)
isCritical = (totalFloat == 0)
```

Jalur kritis = urutan kegiatan dengan `isCritical = true` yang terhubung dari start ke finish.

#### Langkah 6 — Konversi Kembali ke Tanggal Kalender
Setelah CPM selesai, konversi nilai `earliestStart` (hari ke-N) kembali ke tanggal kalender menggunakan fungsi `addWorkingDays(projectStart, N, holidays)`.

### 8.4 Fungsi Kalender Kerja

```typescript
// lib/calendar.ts

/**
 * Tambahkan N hari kerja ke startDate, melewati akhir pekan dan holidays.
 */
export function addWorkingDays(startDate: Date, days: number, holidays: Date[]): Date

/**
 * Hitung jumlah hari kerja antara dua tanggal (exclusive end).
 */
export function workingDaysBetween(start: Date, end: Date, holidays: Date[]): number
```

Aturan:
- Senin–Jumat = hari kerja
- Sabtu & Minggu = tidak dihitung
- Tanggal dalam `holidays` = tidak dihitung
- Jika hasil landing di hari libur, geser ke hari kerja berikutnya

### 8.5 Kapan CPM Dijalankan

CPM dijalankan server-side setiap kali salah satu kondisi berikut terpenuhi:

| Pemicu | Endpoint |
|--------|----------|
| Tanggal rencana activity berubah (manual) | `PATCH /api/activities/[id]` |
| Dependensi baru ditambahkan | `POST /api/dependencies` |
| Dependensi dihapus | `DELETE /api/dependencies/[id]` |
| Lag/type dependensi berubah | `PATCH /api/dependencies/[id]` |
| Admin trigger manual | `POST /api/locations/[locationId]/recalculate` |
| Hari libur ditambah/dihapus | `POST/DELETE /api/work-calendar` |

**Alur eksekusi di API route:**
```
1. Simpan perubahan yang diminta ke DB
2. Ambil semua activities + dependencies untuk lokasi ini
3. Ambil daftar holidays dari work_calendar
4. Panggil runCpm(...)
5. Jika hasCycle → rollback, kembalikan error 422 dengan cycleIds
6. Jika OK → batch UPDATE activities: 
     tanggal_mulai_rencana, tanggal_selesai_rencana, is_on_critical_path
   (skip activities dengan date_locked = true)
7. Insert audit_log dengan action = 'RECALCULATE', sertakan summary perubahan
8. Return updated activities ke client
```

**Penting:** Jika satu activity memiliki `date_locked = true`, CPM tetap berjalan tapi activity tersebut tidak diubah. Successor-nya tetap dihitung berdasarkan tanggal locked tersebut.

### 8.6 UI — Visualisasi Dependensi di Gantt

- Gambar panah dari bar predecessor ke bar successor
- Warna panah: abu-abu default, **merah** jika keduanya ada di jalur kritis
- Tooltip pada panah: tipe dependensi + lag
- Jalur kritis: bar activity berwarna **merah** (bukan warna fase), badge "🔴 Kritis"
- Kegiatan dengan `date_locked = true`: tampilkan ikon 🔒 di baris

### 8.7 UI — Manajemen Dependensi per Activity

Di setiap baris kegiatan (mode Admin), tambahkan kolom **"Dep"**:
- Badge menampilkan jumlah dependensi yang ada (contoh: `2 dep`)
- Klik badge → panel/modal **"Dependensi Kegiatan"**:
  - **Tab "Predecessor":** daftar kegiatan yang harus selesai/mulai sebelum ini
  - **Tab "Successor":** daftar kegiatan yang bergantung pada ini
  - Tombol **"+ Tambah Predecessor"**:
    - Dropdown pilih activity (dari fase mana saja dalam lokasi yang sama)
    - Pilih tipe: FS / SS / FF / SF
    - Input lag (hari, boleh negatif)
    - Jika menimbulkan siklus → tampilkan error, jangan simpan
  - Tombol hapus per baris dependensi

---

## 9. API Routes

### Konvensi

```
Base: /api/
Auth: semua endpoint kecuali /api/auth/login memerlukan session valid
Response: { data: T | null, error: { code: string, message: string } | null }
```

Otorisasi role divalidasi di setiap handler server-side (tidak hanya via RLS).

### 9.1 Auth

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| POST | `/api/auth/login` | — | Login email+password |
| POST | `/api/auth/logout` | Semua | Hapus session |
| GET | `/api/auth/me` | Semua | Profil user aktif |

### 9.2 Users

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/users` | Admin, SA | Daftar user |
| POST | `/api/users` | Admin, SA | Buat user baru |
| PATCH | `/api/users/[id]` | Admin, SA | Update role/status |
| DELETE | `/api/users/[id]` | SA | Nonaktifkan user |

Body POST: `{ email, full_name, password, role: "admin"|"viewer" }`

### 9.3 Locations

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/locations` | Semua | Semua lokasi aktif + summary stats |
| POST | `/api/locations` | Admin, SA | Buat lokasi + 4 fase template |
| PATCH | `/api/locations/[id]` | Admin, SA | Update nama/deskripsi |
| DELETE | `/api/locations/[id]` | SA | Soft delete |

Body POST: `{ name, code, description, project_start_date: "YYYY-MM-DD" }`

Saat POST, server:
1. Insert lokasi
2. Insert 4 fase (F1–F4) dengan nama & PIC dari template
3. Insert semua kegiatan default dari `PHASE_TEMPLATES` dengan tanggal dihitung dari `project_start_date`
4. Insert baris default `kk_consent` dengan `target_kk = 0` (admin update kemudian)

### 9.4 Phases

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/locations/[locationId]/phases` | Semua | Semua fase + activities + dependencies |
| PATCH | `/api/phases/[id]` | Admin, SA | Update nama fase atau PIC utama |

### 9.5 Activities

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/phases/[phaseId]/activities` | Semua | Kegiatan + deps |
| POST | `/api/phases/[phaseId]/activities` | Admin, SA | Tambah kegiatan → trigger CPM |
| PATCH | `/api/activities/[id]` | Admin, SA | Update kegiatan → trigger CPM jika tanggal berubah |
| DELETE | `/api/activities/[id]` | Admin, SA | Hapus (cascade hapus deps) → trigger CPM |
| PATCH | `/api/activities/reorder` | Admin, SA | Update display_order batch |
| PATCH | `/api/activities/[id]/lock` | Admin, SA | Toggle date_locked |

Body PATCH `/api/activities/[id]`:
```json
{
  "kegiatan": "...",
  "pic": "...",
  "tanggal_mulai_rencana": "YYYY-MM-DD",
  "tanggal_selesai_rencana": "YYYY-MM-DD",
  "tanggal_mulai_realisasi": "YYYY-MM-DD",
  "tanggal_selesai_realisasi": "YYYY-MM-DD",
  "status": "belum_mulai|sedang_berjalan|selesai|ditunda",
  "progress_pct": 0,
  "catatan": "...",
  "is_milestone": false
}
```

### 9.6 Dependencies

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/locations/[locationId]/dependencies` | Semua | Semua dependensi di lokasi |
| POST | `/api/dependencies` | Admin, SA | Tambah dependensi → deteksi siklus → CPM |
| PATCH | `/api/dependencies/[id]` | Admin, SA | Update type/lag → CPM |
| DELETE | `/api/dependencies/[id]` | Admin, SA | Hapus → CPM |

Body POST:
```json
{
  "predecessor_id": "uuid",
  "successor_id": "uuid",
  "dep_type": "FS|SS|FF|SF",
  "lag_days": 0
}
```

Error jika siklus: `{ error: { code: "CYCLE_DETECTED", message: "...", cycleIds: ["uuid","uuid"] } }`

### 9.7 CPM Manual Trigger

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| POST | `/api/locations/[locationId]/recalculate` | Admin, SA | Paksa jalankan ulang CPM |

Response: `{ data: { updatedCount: number, criticalPath: string[] } }`

### 9.8 Baselines

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/locations/[locationId]/baselines` | Semua | Daftar baseline |
| POST | `/api/locations/[locationId]/baselines` | Admin, SA | Simpan baseline baru (snapshot) |
| PATCH | `/api/baselines/[id]/activate` | Admin, SA | Aktifkan baseline ini sebagai acuan |
| DELETE | `/api/baselines/[id]` | SA | Hapus baseline |

Body POST: `{ name: "Baseline Awal", description: "..." }`

Server melakukan:
1. Set `is_active = false` pada semua baseline lokasi ini
2. Insert baseline baru dengan `is_active = true`
3. Insert `baseline_activities` (snapshot semua activities saat ini)
4. Audit log: `action = 'BASELINE_SAVE'`

### 9.9 Stakeholders

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/stakeholders` | Semua | Semua stakeholder aktif |
| POST | `/api/stakeholders` | Admin, SA | Tambah stakeholder |
| PATCH | `/api/stakeholders/[id]` | Admin, SA | Update data |
| DELETE | `/api/stakeholders/[id]` | Admin, SA | Soft delete |

### 9.10 RACI

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/phases/[phaseId]/raci` | Semua | Semua entri RACI fase ini |
| PUT | `/api/phases/[phaseId]/raci/[stakeholderId]` | Admin, SA | Upsert nilai R/A/C/I atau null |

### 9.11 Risk Items

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/phases/[phaseId]/risks` | Semua | Semua risiko fase ini |
| POST | `/api/phases/[phaseId]/risks` | Admin, SA | Tambah risiko |
| PATCH | `/api/risks/[id]` | Admin, SA | Update risiko |
| DELETE | `/api/risks/[id]` | Admin, SA | Hapus risiko |

### 9.12 Work Calendar

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/work-calendar` | Semua | Semua hari libur |
| POST | `/api/work-calendar` | Admin, SA | Tambah hari libur → trigger CPM semua lokasi |
| DELETE | `/api/work-calendar/[id]` | Admin, SA | Hapus hari libur → trigger CPM semua lokasi |

### 9.13 KK Consent

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/locations/[locationId]/kk-consent` | Semua | Data persetujuan warga |
| PATCH | `/api/locations/[locationId]/kk-consent` | Admin, SA | Update jumlah setuju/menolak/target |

### 9.14 Audit Logs

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/audit-logs` | Admin, SA | Query log dengan filter |

Query params: `?entity_type=&user_id=&from=&to=&page=1&limit=50`

### 9.15 Reporting Items

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/reporting-items` | Semua | Semua baris pelaporan |
| POST | `/api/reporting-items` | Admin, SA | Tambah baris |
| PATCH | `/api/reporting-items/[id]` | Admin, SA | Update baris |
| DELETE | `/api/reporting-items/[id]` | Admin, SA | Hapus baris |

### 9.16 Weekly Summary

| Method | Path | Role | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/locations/[locationId]/weekly-summary` | Semua | Generate ringkasan mingguan |

Response:
```json
{
  "data": {
    "week": "30 Jun – 6 Jul 2026",
    "selesai_minggu_ini": [...],
    "mulai_minggu_depan": [...],
    "terlambat": [...],
    "ditunda": [...],
    "whatsapp_text": "*Laporan Mingguan Revitalisasi — Tanah Abang*\n..."
  }
}
```

---

## 10. Fitur & Persyaratan Fungsional

### 10.1 Autentikasi

- Form login email + password
- Session via `@supabase/ssr` (httpOnly cookie)
- Middleware `middleware.ts` melindungi semua route kecuali `/login`
- Redirect: belum login → `/login`, sudah login akses `/login` → `/`
- Tidak ada self-registration, tidak ada lupa-password di v1

### 10.2 Navigasi & Layout

```
Sidebar kiri (fixed):
├── [Logo Perumnas]
├── 🌐 Dashboard Lintas-Lokasi    ← halaman /
├── ── PILIH LOKASI ──
│   └── [Dropdown 4 lokasi + tambah]
│       ↓ Setelah pilih lokasi:
│       ├── 📊 Ringkasan
│       ├── 📅 Timeline / Gantt
│       ├── 📋 Fase 1 – Sosialisasi
│       ├── 📋 Fase 2 – Investor
│       ├── 📋 Fase 3 – Pemasaran
│       ├── 📋 Fase 4 – Legal
│       ├── ⚠️  Risk Register
│       └── 🏘️  Persetujuan Warga   ← hanya Fase 1
├── ── GLOBAL ──
├── 👥 RACI
├── 📋 Pelaporan
├── 👔 Workload View
├── 📅 Kalender Kerja              ← Admin & SA
├── 📜 Audit Log                   ← Admin & SA
└── ⚙️  Users & Lokasi             ← Admin & SA

Footer sidebar:
└── [Avatar + Nama + Role] [Logout]
```

URL scheme: `/dashboard/[locationCode]/[tab]`  
Contoh: `/dashboard/TA/fase-1`, `/dashboard/KK/timeline`, `/dashboard/TA/risks`

### 10.3 Dashboard Lintas-Lokasi (Landing Page)

**URL:** `/`

**Komponen:**
1. **Header:** "Program Revitalisasi Rusun — Ringkasan Semua Lokasi"
2. **Grid 4 kartu lokasi**, masing-masing menampilkan:
   - Nama lokasi + kode
   - Progress bar keseluruhan + persentase
   - 4 mini-badge fase (warna + %) 
   - Jumlah kegiatan kritis (merah) | ditunda (kuning) | selesai/total
   - Link → masuk ke dashboard lokasi tersebut
3. **Tabel Ringkasan Komparatif:** semua lokasi sebagai baris, kolom = fase F1–F4, nilai = %
4. **Panel Isu Lintas-Lokasi:** gabungan semua kegiatan `ditunda` atau terlambat dari semua lokasi, diurutkan berdasarkan tingkat keparahan

### 10.4 Dashboard Per-Lokasi

**URL:** `/dashboard/[locationCode]`

**Komponen:**
1. Header lokasi + breadcrumb + tombol "Pilih Lokasi Lain"
2. **Kartu Progres Keseluruhan** (angka besar + progress bar)
3. **4 Kartu Fase** (F1–F4): nama, PIC, X/Y selesai, %, badge ditunda
4. **Kartu Jalur Kritis:** jumlah kegiatan kritis, estimasi tanggal selesai proyek
5. **Panel "Kegiatan Mendatang":** 5 kegiatan berikutnya (belum selesai)
6. **Panel "Perlu Perhatian":** ditunda ATAU `selesai_rencana < today` AND bukan selesai
7. **KK Consent Summary** (jika lokasi ini punya data): mini progress bar threshold 60%

### 10.5 Halaman Timeline / Gantt Chart

**URL:** `/dashboard/[locationCode]/timeline`

**Tiga Lapis Bar per Kegiatan:**
```
[██████████████░░░░░░░░]  ← Baseline (abu-abu tipis, di belakang)
[████████████░░░░░░░░░░]  ← Rencana (warna fase, opacity penuh)
[██████░░░░░░░░░░░░░░░░]  ← Realisasi (warna gelap/hatched)
```

Jika tidak ada baseline → hanya rencana + realisasi.  
Jika tidak ada realisasi → hanya rencana (+ baseline jika ada).

**Fitur:**
- Panah dependensi antar-bar (SVG overlay)
  - Warna merah = keduanya di jalur kritis
  - Hover panah → tooltip: tipe + lag
- Bar jalur kritis berwarna merah
- Milestone: ♦ diamond marker, tidak ada bar (hanya titik)
- Kolom bulan berjalan: latar lebih gelap
- Kolom weekend: latar strip tipis (jika tampilan mingguan)
- Toggle: "Tampilan Bulan" | "Tampilan Minggu"
- Toggle: "Tampilkan Baseline" on/off
- Toggle: "Tampilkan Panah Dependensi" on/off
- Toggle: "Highlight Jalur Kritis" on/off
- Scroll horizontal, frozen kolom nama di kiri
- Tooltip hover bar: nama, PIC, tanggal rencana, tanggal baseline (deviasi), tanggal realisasi, status, float

### 10.6 Halaman Fase (F1–F4)

**URL:** `/dashboard/[locationCode]/fase-[1-4]`

**Tabel Kegiatan — Kolom:**

| Kolom | Deskripsi |
|-------|-----------|
| ⋮⋮ | Drag handle reorder (Admin) |
| # | Nomor urut |
| ♦ | Indikator milestone (toggle Admin) |
| 🔒 | Toggle date_locked (Admin) |
| 🔴 | Badge kritis (auto, read-only) |
| Kegiatan | Teks editable inline (Admin) |
| PIC | Teks editable inline (Admin) |
| Dep | Badge jumlah dep → buka panel dependensi |
| Rencana Mulai | Date picker (Admin) |
| Rencana Selesai | Date picker (Admin) |
| Durasi (HK) | Auto-hitung dalam hari kerja (read-only) |
| Baseline Mulai | Dari baseline aktif (read-only, abu-abu) |
| Deviasi (hari) | Rencana - Baseline dalam hari kerja |
| Realisasi Mulai | Date picker (Admin) |
| Realisasi Selesai | Date picker (Admin) |
| Status | Dropdown (Admin) / Badge (Viewer) |
| % | Tombol cepat 0/25/50/75/100 + input angka |
| Catatan | Textarea inline |
| Risiko | Badge jumlah risiko open → link ke risk register fase ini |
| 🗑️ | Hapus (Admin, konfirmasi dialog) |

**Perilaku Auto-save:**
- Setiap perubahan field → debounce 600ms → PATCH API
- Indicator: "Menyimpan…" / "✓ Tersimpan" / "⚠ Gagal"
- Jika perubahan tanggal → server jalankan CPM → client menerima `updatedActivities` dan re-render tanggal yang bergeser

**Validasi:**
- `selesai_rencana >= mulai_rencana`
- `selesai_realisasi >= mulai_realisasi` (jika keduanya ada)
- `progress_pct` = 100 otomatis saat status → "selesai"
- `progress_pct` = 0 otomatis saat status → "belum_mulai"
- Hapus kegiatan yang punya successor → tampilkan daftar successor yang terdampak, minta konfirmasi

**Notifikasi CPM setelah perubahan tanggal:**
Tampilkan toast/banner: *"Tanggal bergeser: [N] kegiatan lain telah disesuaikan oleh CPM engine. [Lihat detail]"*

### 10.7 Halaman Risk Register

**URL:** `/dashboard/[locationCode]/fase-[1-4]/risks` atau `/dashboard/[locationCode]/risks`

**Komponen:**
1. **Filter:** per fase, status (open/mitigated/closed), kategori
2. **Tabel risiko:**

| Kolom | Deskripsi |
|-------|-----------|
| # | Nomor |
| Risiko | Judul + deskripsi (expand) |
| Kategori | Badge: teknis/hukum/keuangan/sosial/lingkungan |
| Fase | F1–F4 |
| Probabilitas | 1–5 (dropdown Admin) |
| Dampak | 1–5 (dropdown Admin) |
| Skor | P×D, warna: hijau (1–6), kuning (7–12), merah (13–25) |
| Mitigasi | Teks |
| Owner | PIC risiko |
| Status | Badge: open/mitigated/closed |
| Aksi | Edit / Hapus (Admin) |

3. **Risk Matrix 5×5** (heatmap visual): baris = probabilitas, kolom = dampak, sel berisi jumlah risiko
4. **Tombol "+ Tambah Risiko"** → modal form

### 10.8 Halaman Persetujuan Warga / KK (Fase 1)

**URL:** `/dashboard/[locationCode]/kk-consent`

**Komponen:**
1. **Header:** nama lokasi + keterangan "Sesuai UU No. 20/2011 Pasal 65 Ayat (2)"
2. **Input (Admin):**
   - Target KK (total warga)
   - Jumlah Setuju
   - Jumlah Menolak
   - Belum Dihubungi (auto: target - setuju - menolak)
3. **Visualisasi:**
   - Progress bar besar: % setuju dari total
   - Garis threshold merah di 60%
   - Label: "X dari Y KK setuju (Z%) — Threshold 60% [TERCAPAI/BELUM TERCAPAI]"
   - Donut chart: komposisi setuju/menolak/belum dihubungi
4. **Riwayat update** (dari audit log, 10 entri terakhir)

### 10.9 Halaman RACI

**URL:** `/raci`

**Tampilan:** Matriks, baris = fase (F1–F4), kolom = stakeholder aktif.

**Mode Admin:**
- Klik sel → dropdown R/A/C/I/hapus → auto-save
- **"+ Tambah Stakeholder"** → modal: kode, nama, grup
- Ikon × di header kolom → soft delete (konfirmasi)
- Drag reorder kolom

**Bawah tabel:** Legend RACI + daftar kode lengkap (kode → nama instansi + grup)

### 10.10 Halaman Workload View

**URL:** `/workload`

**Komponen:**
1. **Filter:** lokasi, fase, rentang tanggal
2. **Daftar PIC** (semua unique PIC dari semua kegiatan):
   - Untuk setiap PIC: kartu berisi jumlah kegiatan aktif, jadwal terdekat, progress rata-rata
3. **Tabel Heatmap Mingguan:**
   - Baris = PIC, Kolom = minggu (12 minggu ke depan)
   - Nilai sel = jumlah kegiatan aktif PIC di minggu tersebut
   - Warna: hijau (0-1), kuning (2-3), merah (4+)
4. **Klik sel** → popover daftar kegiatan PIC di minggu tersebut

### 10.11 Halaman Kalender Kerja

**URL:** `/work-calendar`  
**Akses:** Admin & SA

**Komponen:**
1. **Tampilan kalender** tahunan (12 bulan)
2. Hari libur ditandai dengan warna merah + nama libur
3. **"+ Tambah Hari Libur"** → modal: tanggal, nama
4. Klik hari libur → hapus (konfirmasi)
5. **Tombol "Import Libur Nasional [Tahun]"** → pre-fill hari libur nasional Indonesia standar
6. **Peringatan:** "Perubahan kalender akan mentrigger recalculate CPM di semua lokasi"

**Default holidays yang di-seed:** Libur nasional Indonesia 2026–2027 (seed di `003_seed_data.sql`)

### 10.12 Halaman Weekly Summary Report

**URL:** `/dashboard/[locationCode]/weekly-summary`

**Komponen:**
1. **Periode:** otomatis minggu berjalan (Senin–Jumat), bisa navigasi minggu lain
2. **4 Panel ringkasan:**
   - ✅ Selesai minggu ini (kegiatan yang status → selesai dalam 7 hari terakhir)
   - 🚀 Mulai minggu depan (kegiatan dengan mulai_rencana dalam 7 hari ke depan)
   - ⏰ Terlambat (selesai_rencana < today AND bukan selesai)
   - ⚠️ Ditunda
3. **Teks otomatis format WhatsApp** (box dengan font monospace):
```
*LAPORAN MINGGUAN REVITALISASI RUSUN*
*Lokasi: Tanah Abang | 30 Jun – 4 Jul 2026*

✅ *SELESAI MINGGU INI*
• Sosialisasi Tahap 1 (F1) — Tim Revitalisasi

🚀 *DIMULAI MINGGU DEPAN*
• Sosialisasi Tahap 2 — FGD & door-to-door (F1)

⚠️ *PERLU PERHATIAN*
• [nama kegiatan] terlambat 3 hari kerja

📊 *PROGRES KESELURUHAN: 12%*
F1: 20% | F2: 5% | F3: 0% | F4: 8%
```
4. **Tombol "Salin Teks WhatsApp"** → copy ke clipboard

### 10.13 Halaman Audit Log

**URL:** `/audit-log`  
**Akses:** Admin & SA

**Tabel:**
| Waktu | User | Aksi | Entitas | Perubahan Ringkas |
|-------|------|------|---------|-------------------|

- Filter: entity_type, user, dari–sampai tanggal, action type
- Pagination 50 per halaman
- Klik baris → modal detail (old_value vs new_value JSON diff)

### 10.14 Halaman Manajemen User

**URL:** `/users`  
**Akses:** Admin & SA

Tabel: Nama, Email, Role (badge), Status, Dibuat oleh, Tanggal dibuat.  
Tombol: "+ Buat User" → modal. Toggle aktif/nonaktif per baris.

### 10.15 Halaman Manajemen Lokasi

**URL:** `/locations`  
**Akses:** Admin & SA

Kartu per lokasi + tombol edit. Tombol "+ Tambah Lokasi" → modal form. SA: tombol nonaktifkan lokasi.

---

## 11. Persyaratan Non-Fungsional

| Kategori | Requirement |
|----------|-------------|
| Performa | TTFB halaman utama < 1.5 detik di koneksi 10 Mbps |
| Performa | CPM recalculate (60 activities, 80 deps) < 200ms server-side |
| Performa | Auto-save PATCH activity < 500ms |
| Keamanan | Semua endpoint divalidasi role server-side |
| Keamanan | RLS Supabase aktif di semua tabel |
| Keamanan | Session di httpOnly cookie, bukan localStorage |
| Keamanan | Semua input divalidasi via Zod sebelum query DB |
| Keamanan | `SUPABASE_SERVICE_ROLE_KEY` hanya di server, tidak pernah `NEXT_PUBLIC_` |
| Integritas | CPM mendeteksi dan menolak siklus dependensi |
| Integritas | Hapus kegiatan dengan successor harus melalui konfirmasi eksplisit |
| Integritas | Baseline tidak bisa diedit setelah disimpan (immutable snapshot) |
| Audit | Setiap perubahan data terekam dalam audit_logs dalam 500ms |
| Skalabilitas | Skema mendukung penambahan lokasi tanpa perubahan struktur tabel |
| Responsif | Minimum 1280px (laptop), Gantt chart scroll horizontal di layar lebih kecil |
| Aksesibilitas | Keyboard navigable untuk form dan tabel utama |

---

## 12. Struktur Proyek Next.js

```
project-root/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                     ← Sidebar + session guard
│   │   ├── page.tsx                       ← Dashboard lintas-lokasi (/)
│   │   ├── dashboard/[locationCode]/
│   │   │   ├── page.tsx                   ← Ringkasan per-lokasi
│   │   │   ├── timeline/page.tsx          ← Gantt 3 lapis + deps
│   │   │   ├── fase-[phase]/page.tsx      ← Tabel kegiatan CRUD
│   │   │   ├── risks/page.tsx             ← Risk register semua fase
│   │   │   ├── kk-consent/page.tsx        ← Tracker persetujuan warga
│   │   │   └── weekly-summary/page.tsx    ← Laporan mingguan
│   │   ├── raci/page.tsx
│   │   ├── pelaporan/page.tsx
│   │   ├── workload/page.tsx
│   │   ├── work-calendar/page.tsx
│   │   ├── audit-log/page.tsx
│   │   ├── users/page.tsx
│   │   └── locations/page.tsx
│   └── api/
│       ├── auth/{login,logout,me}/route.ts
│       ├── users/route.ts
│       ├── users/[id]/route.ts
│       ├── locations/route.ts
│       ├── locations/[locationId]/route.ts
│       ├── locations/[locationId]/phases/route.ts
│       ├── locations/[locationId]/baselines/route.ts
│       ├── locations/[locationId]/recalculate/route.ts
│       ├── locations/[locationId]/kk-consent/route.ts
│       ├── locations/[locationId]/weekly-summary/route.ts
│       ├── locations/[locationId]/dependencies/route.ts
│       ├── phases/[phaseId]/route.ts
│       ├── phases/[phaseId]/activities/route.ts
│       ├── phases/[phaseId]/raci/route.ts
│       ├── phases/[phaseId]/raci/[stakeholderId]/route.ts
│       ├── phases/[phaseId]/risks/route.ts
│       ├── activities/[id]/route.ts
│       ├── activities/[id]/lock/route.ts
│       ├── activities/reorder/route.ts
│       ├── dependencies/route.ts
│       ├── dependencies/[id]/route.ts
│       ├── baselines/[id]/route.ts
│       ├── baselines/[id]/activate/route.ts
│       ├── stakeholders/route.ts
│       ├── stakeholders/[id]/route.ts
│       ├── risks/[id]/route.ts
│       ├── work-calendar/route.ts
│       ├── work-calendar/[id]/route.ts
│       ├── reporting-items/route.ts
│       ├── reporting-items/[id]/route.ts
│       └── audit-logs/route.ts
│
├── components/
│   ├── ui/                                ← shadcn/ui
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── LocationSwitcher.tsx
│   │   └── UserMenu.tsx
│   ├── dashboard/
│   │   ├── CrossLocationGrid.tsx          ← 4 kartu lokasi
│   │   ├── PhaseCard.tsx
│   │   ├── CriticalPathSummary.tsx
│   │   ├── UpcomingPanel.tsx
│   │   └── AtRiskPanel.tsx
│   ├── timeline/
│   │   ├── GanttChart.tsx                 ← kontainer utama
│   │   ├── GanttRow.tsx                   ← baris per kegiatan
│   │   ├── GanttBar.tsx                   ← satu bar (baseline/rencana/realisasi)
│   │   ├── GanttArrows.tsx                ← SVG overlay panah dependensi
│   │   ├── GanttMilestone.tsx             ← ♦ diamond marker
│   │   ├── GanttTooltip.tsx
│   │   └── GanttControls.tsx              ← toggle-toggle view
│   ├── phase/
│   │   ├── ActivityTable.tsx
│   │   ├── ActivityRow.tsx
│   │   ├── DependencyPanel.tsx            ← panel kelola dependensi
│   │   ├── AddActivityModal.tsx
│   │   └── SaveIndicator.tsx
│   ├── raci/
│   │   ├── RaciMatrix.tsx
│   │   ├── RaciCell.tsx
│   │   └── AddStakeholderModal.tsx
│   ├── risks/
│   │   ├── RiskTable.tsx
│   │   ├── RiskMatrix5x5.tsx
│   │   └── AddRiskModal.tsx
│   ├── workload/
│   │   ├── WorkloadHeatmap.tsx
│   │   └── PicCard.tsx
│   ├── kk-consent/
│   │   └── ConsentTracker.tsx
│   ├── weekly-summary/
│   │   └── WeeklySummary.tsx
│   └── shared/
│       ├── StatusBadge.tsx
│       ├── ProgressBar.tsx
│       └── ConfirmDialog.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                      ← createBrowserClient
│   │   ├── server.ts                      ← createServerClient (RSC)
│   │   └── middleware.ts
│   ├── cpm.ts                             ← CPM engine (pure TS)
│   ├── calendar.ts                        ← addWorkingDays, workingDaysBetween
│   ├── audit.ts                           ← helper insertAuditLog(...)
│   ├── templates.ts                       ← PHASE_TEMPLATES untuk lokasi baru
│   └── validations.ts                     ← Zod schemas
│
├── middleware.ts                          ← Auth guard global
│
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_rls_policies.sql
│       └── 003_seed_data.sql
│
├── tests/
│   ├── unit/
│   │   ├── cpm.test.ts                    ← Unit test CPM engine
│   │   └── calendar.test.ts
│   └── e2e/
│       ├── auth.spec.ts
│       ├── activities.spec.ts
│       ├── dependencies.spec.ts           ← Test siklus, auto-shift
│       ├── cpm.spec.ts
│       ├── raci.spec.ts
│       ├── risks.spec.ts
│       └── audit.spec.ts
│
├── .env.local.example
├── playwright.config.ts
└── package.json
```

---

## 13. Environment Variables

### `.env.local.example`
```env
# Supabase (local dari supabase start)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production (Vercel Dashboard)
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<prod-service-role-key>
NEXT_PUBLIC_APP_URL=https://<domain>.vercel.app
```

> **WAJIB:** `SUPABASE_SERVICE_ROLE_KEY` hanya boleh digunakan di API routes server-side. Jangan pernah prefix dengan `NEXT_PUBLIC_`.

---

## 14. Panduan Local Testing

### Prasyarat
- Node.js ≥ 20
- Docker Desktop (aktif)
- `npm install -g supabase`

### Setup

```bash
# 1. Clone & install
git clone <repo-url> && cd <project>
npm install

# 2. Env file
cp .env.local.example .env.local

# 3. Supabase lokal
supabase init
supabase start
# → Salin URL dan keys ke .env.local

# 4. Migrasi + seed
supabase db migrate
supabase db execute --file supabase/migrations/003_seed_data.sql

# 5. Dev server
npm run dev
# → http://localhost:3000
```

### Akun Default Seed

| Email | Password | Role |
|-------|----------|------|
| `superadmin@perumnas.co.id` | `SuperAdmin123!` | Super Admin |
| `admin@perumnas.co.id` | `Admin123!` | Admin |
| `viewer@perumnas.co.id` | `Viewer123!` | Viewer |

> Ganti semua password ini setelah deploy ke production.

### Unit Test CPM (Wajib Sebelum E2E)

```bash
npm run test:unit
```

Skenario unit test CPM yang wajib ada di `tests/unit/cpm.test.ts`:

| Test Case | Deskripsi |
|-----------|-----------|
| `FS basic` | A → FS → B: B.ES = A.EF |
| `SS basic` | A → SS → B: B.ES = A.ES |
| `FF basic` | A → FF → B: B.EF = A.EF |
| `SF basic` | A → SF → B: B.EF = A.ES |
| `FS with lag` | A → FS(+3) → B: B.ES = A.EF + 3 |
| `SS with lead` | A → SS(-2) → B: B.ES = A.ES - 2 |
| `Multi-predecessor` | B bergantung pada A (FS) dan C (FS): B.ES = max(A.EF, C.EF) |
| `Critical path` | Chain A→B→C lebih panjang dari A→D→C: A,B,C harus kritis |
| `Date locked` | Activity dengan dateLocked=true tidak bergeser |
| `Cycle detection` | A→B→A harus return hasCycle=true |
| `Calendar: weekend skip` | addWorkingDays(Jumat, 1) = Senin |
| `Calendar: holiday skip` | addWorkingDays(sebelum libur, 1) melewati hari libur |

### Skenario E2E Manual

#### Auth
- [ ] Login Viewer → tidak ada tombol edit, tidak ada menu admin
- [ ] Login Admin → semua fitur edit terbuka
- [ ] Nonaktifkan akun → tidak bisa login

#### Dependensi & CPM
- [ ] Tambah dependensi FS antara 2 kegiatan → tanggal successor bergeser
- [ ] Ubah lag → tanggal bergeser sesuai
- [ ] Tambah dependensi yang menciptakan siklus A→B→A → error ditampilkan, tidak tersimpan
- [ ] Lock tanggal satu activity → tidak bergeser meski predecessor berubah
- [ ] Hapus predecessor → successor tanggalnya kembali ke nilai asli (atau recalculate)
- [ ] Cek jalur kritis ter-highlight merah di Gantt

#### Gantt Chart
- [ ] Baseline tersimpan → tampil bar abu-abu di belakang
- [ ] Ubah tanggal rencana → deviasi baseline muncul
- [ ] Toggle "Tampilkan Dependensi" → panah muncul/hilang
- [ ] Milestone tampil sebagai ♦ bukan bar
- [ ] Tooltip hover bar menampilkan info lengkap

#### Risk Register
- [ ] Tambah risiko → skor auto-hitung
- [ ] Risk Matrix 5×5 update otomatis
- [ ] Filter by status

#### Weekly Summary
- [ ] Generate laporan → teks WhatsApp akurat
- [ ] Salin ke clipboard → bisa paste di WA

#### Workload View
- [ ] Heatmap menampilkan semua PIC
- [ ] Sel merah jika PIC punya ≥4 kegiatan aktif di minggu tersebut

### Playwright E2E

```bash
npx playwright install chromium
npm run test:e2e

# Satu file:
npx playwright test tests/e2e/dependencies.spec.ts --ui
```

---

## 15. Panduan Deployment ke Vercel + Supabase

```bash
# 1. Setup Supabase production (di dashboard supabase.com)
#    Region: ap-southeast-1 (Singapore)

# 2. Link dan push migrasi
supabase link --project-ref <ref>
supabase db push
supabase db execute --remote --file supabase/migrations/003_seed_data.sql

# 3. Buat Super Admin pertama:
#    Supabase Dashboard → Authentication → Invite User
#    Lalu update kolom role di tabel profiles → 'super_admin'

# 4. Deploy Vercel
#    → vercel.com → New Project → Import GitHub → Set env vars → Deploy

# 5. Set env vars di Vercel:
#    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#    SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL
```

### Checklist Go-Live

- [ ] Unit test CPM: semua lulus
- [ ] E2E Playwright: semua lulus di lokal
- [ ] Migrasi production tanpa error
- [ ] RLS aktif di semua tabel (verifikasi di Supabase Dashboard → Authentication → Policies)
- [ ] Login Super Admin di production berhasil
- [ ] CPM recalculate berjalan di production (test dengan 1 dependensi sederhana)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` tidak ada di environment `NEXT_PUBLIC_`
- [ ] Password default sudah diganti
- [ ] URL production bisa diakses oleh stakeholder

---

## 16. Estimasi Milestone

Estimasi untuk **1 developer full-time** menggunakan Claude Code.

| Minggu | Milestone | Deliverable Kunci |
|--------|-----------|-------------------|
| 1 | **Fondasi** | Repo, Supabase lokal, semua migrasi DB, auth flow, middleware, sidebar layout |
| 2 | **Data Layer** | Semua API routes (locations, phases, activities, stakeholders, RACI) |
| 3 | **Fase CRUD** | Tabel kegiatan full: add/edit/delete/reorder, auto-save, validasi, status, progress |
| 4 | **CPM Engine** | `lib/cpm.ts` + `lib/calendar.ts`, unit test lengkap, API recalculate |
| 5 | **Dependensi UI** | Panel dependensi per activity, deteksi siklus, notifikasi auto-shift |
| 6 | **Gantt 3 Lapis** | Bar baseline + rencana + realisasi, panah dependensi SVG, milestone ♦ |
| 7 | **Baseline & Kritis** | Simpan/aktivasi baseline, highlight jalur kritis, deviasi kolom |
| 8 | **Dashboard** | Cross-location grid, per-lokasi summary, KK consent tracker |
| 9 | **Risk Register** | Tabel risiko CRUD, Risk Matrix 5×5, filter |
| 10 | **PM Views** | Workload heatmap, Weekly Summary + copy WA, Kalender Kerja |
| 11 | **RACI & Pelaporan** | RACI editable + drag reorder, halaman pelaporan editable |
| 12 | **Audit & Users** | Audit log + filter + diff view, manajemen user & lokasi |
| 13 | **E2E Testing** | Playwright semua skenario, bug fix |
| 14 | **QA & Polish** | Performance check, edge cases, UI consistency pass |
| 15 | **Staging** | Deploy Vercel staging, UAT dengan stakeholder internal Perumnas |
| 16 | **Production** | Fix UAT issues, deploy production, handover & dokumentasi |

---

## 17. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| CPM siklus lolos ke DB | Tinggi | Deteksi siklus di server sebelum simpan + constraint DB `CHECK predecessor <> successor` |
| CPM lambat untuk >200 activities | Sedang | CPM pure in-memory (bukan query-per-node); benchmark di Minggu 4 |
| Perubahan kalender kerja mentrigger recalculate semua lokasi sekaligus | Sedang | Queue sequential per lokasi, bukan paralel; batasi UI 1 klik per 10 detik |
| `date_locked` diabaikan saat recalculate | Tinggi | Unit test wajib cover skenario ini; cek flag sebelum update |
| Baseline snapshot tidak konsisten jika disimpan saat recalculate berjalan | Sedang | Baseline menggunakan DB transaction; ambil snapshot setelah recalculate selesai |
| RLS salah → Viewer bisa edit | Kritis | Test RLS eksplisit dengan Supabase RLS tester; E2E sebagai Viewer |
| Service role key bocor ke client | Kritis | Review semua komponen; CI check: tidak ada string `SERVICE_ROLE` di file `/app/` |
| Gantt SVG arrows render lambat untuk 60+ activities | Sedang | Virtualisasi baris Gantt; render panah hanya untuk baris yang visible |
| Data lokasi baru tidak dapat template fase yang benar | Sedang | Unit test `createLocationWithTemplate` di `lib/templates.ts` |

---

## 18. Seed Data

### Lokasi (4)
```sql
INSERT INTO public.locations (name, code, description, display_order) VALUES
  ('Tanah Abang',    'TA',  'Rusun Tanah Abang, Jakarta Pusat',   1),
  ('Kebon Kacang',  'KK',  'Rusun Kebon Kacang, Jakarta Pusat',  2),
  ('Klender',        'KL',  'Rusun Klender, Jakarta Timur',       3),
  ('Kemayoran Blok A','KMY','Rusun Kemayoran, Jakarta Pusat',     4);
```

### Stakeholders (15)
```sql
INSERT INTO public.stakeholders (code, name, group_name, display_order) VALUES
  ('TR',      'Tim Revitalisasi (Perumnas)',                         'Perumnas',    1),
  ('DB',      'Div. Pengembangan Bisnis',                            'Perumnas',    2),
  ('DPm',     'Div. Pemasaran',                                      'Perumnas',    3),
  ('DPT',     'Div. Perencanaan Teknis',                             'Perumnas',    4),
  ('DH',      'Div. Hukum',                                          'Perumnas',    5),
  ('DPr',     'Div. Pertanahan',                                     'Perumnas',    6),
  ('DIR',     'Direksi Perumnas',                                    'Perumnas',    7),
  ('B-PM',    'Bappenas – Penasihat Menteri',                        'Bappenas',    8),
  ('B-SA',    'Bappenas – Staf Ahli Menteri',                        'Bappenas',    9),
  ('P-PKP',   'Pemprov DKI – Dinas Perumahan Rakyat & KP',          'Pemprov DKI', 10),
  ('P-CKTRP', 'Pemprov DKI – Dinas Cipta Karya, Tata Ruang & Ptnh', 'Pemprov DKI', 11),
  ('P-PTSP',  'Pemprov DKI – Dinas Penanaman Modal & PTSP',         'Pemprov DKI', 12),
  ('P-DLH',   'Pemprov DKI – Dinas Lingkungan Hidup',               'Pemprov DKI', 13),
  ('P-DSHB',  'Pemprov DKI – Dinas Perhubungan',                    'Pemprov DKI', 14),
  ('P-BPD',   'Pemprov DKI – Bappeda',                              'Pemprov DKI', 15);
```

### KK Consent Target
```sql
-- Diisi setelah locations ter-seed
INSERT INTO public.kk_consent (location_id, target_kk, threshold_pct)
SELECT id, 
  CASE code
    WHEN 'TA'  THEN 960
    WHEN 'KK'  THEN 0    -- update sesuai data aktual
    WHEN 'KL'  THEN 0
    WHEN 'KMY' THEN 0
  END,
  60
FROM public.locations;
```

### Hari Libur Nasional (seed 2026–2027)
Seed ke tabel `work_calendar` seluruh hari libur nasional Indonesia 2026 dan 2027 (Tahun Baru, Imlek, Isra Mi'raj, Nyepi, Wafat Isa, Kenaikan Isa, Waisak, Idul Fitri + cuti bersama, Idul Adha, Muharram, HUT RI, Maulid Nabi, Natal + cuti bersama). Cek kalender resmi Setneg / Kemenpan untuk tanggal aktual.

### Template Fase untuk Lokasi Baru
File `lib/templates.ts` mendefinisikan `PHASE_TEMPLATES`: array 4 fase, masing-masing berisi array item kegiatan dengan field `kegiatan`, `pic`, `offsetDaysStart`, `durationWorkingDays`. Fungsi `createLocationWithTemplate(locationId, projectStartDate, holidays)` mengkonversi offset ke tanggal aktual menggunakan `addWorkingDays`, lalu batch-insert ke DB.

Konten template: gunakan 60 kegiatan dari file `Data_Aktivitas.csv` yang sudah dihasilkan sebelumnya sebagai basis, konversi tanggal ke offset hari kerja relatif dari tanggal mulai proyek.

---

## 19. Glosarium

| Istilah | Definisi |
|---------|----------|
| **CPM** | Critical Path Method — algoritma PM untuk menentukan jalur terpanjang (jalur kritis) dalam jaringan kegiatan |
| **Float / Slack** | Jumlah hari sebuah kegiatan dapat tertunda tanpa mempengaruhi tanggal selesai proyek; float=0 → kegiatan kritis |
| **FS/SS/FF/SF** | Finish-to-Start, Start-to-Start, Finish-to-Finish, Start-to-Finish — tipe dependensi antar-kegiatan |
| **Lag** | Jeda positif antar-kegiatan (successor mulai N hari setelah kondisi terpenuhi) |
| **Lead** | Jeda negatif — successor dapat mulai N hari sebelum predecessor memenuhi kondisi |
| **Baseline** | Snapshot jadwal rencana yang disimpan pada titik waktu tertentu sebagai acuan deviasi |
| **date_locked** | Flag pada activity yang mencegah CPM engine menggeser tanggalnya secara otomatis |
| **Milestone** | Kegiatan tanpa durasi yang menandai tonggak penting program |
| **Rusun** | Rumah susun — hunian bertingkat bersubsidi |
| **KK** | Kepala Keluarga |
| **NUP** | Nomor Urut Pemesanan — reservasi unit baru |
| **KSO/JVco** | Kerja Sama Operasi / Joint Venture Company — skema kemitraan |
| **HGB Induk** | Hak Guna Bangunan — status kepemilikan tanah Perumnas |
| **PBG** | Persetujuan Bangunan Gedung |
| **KKPR** | Kesesuaian Kegiatan Pemanfaatan Ruang |
| **P3SRS** | Perhimpunan Pemilik & Penghuni Satuan Rumah Susun |
| **SHM Sarusun** | Sertifikat Hak Milik Satuan Rumah Susun |
| **RACI** | Responsible, Accountable, Consulted, Informed |
| **RLS** | Row Level Security — otorisasi per-baris di PostgreSQL/Supabase |
| **RSC** | React Server Component |
| **HK** | Hari Kerja (hari kalender dikurangi akhir pekan dan libur nasional) |

---

*PRD v2.0 — Dokumen ini adalah referensi tunggal untuk Claude Code. Perubahan requirement didokumentasikan sebagai amandemen bernomor (v2.1, v2.2, dst) dengan tanggal dan alasan perubahan.*
