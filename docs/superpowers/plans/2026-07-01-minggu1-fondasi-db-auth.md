# Minggu 1 — Fondasi DB + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setup Next.js 14 project + Supabase lokal + semua 13 tabel DB dengan RLS + auth flow lengkap (login / logout / middleware / session).

**Architecture:** Next.js 14 App Router dengan dua route groups: `(auth)` untuk login page (unprotected) dan `(app)` untuk semua halaman aplikasi (protected via root middleware). Session management via httpOnly cookie menggunakan `@supabase/ssr`. DB migrations dalam 2 file SQL terurut (`001_initial_schema.sql` → `002_rls_policies.sql`) plus `supabase/seed.sql` yang hanya jalan lokal.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase CLI + Docker, `@supabase/ssr` v0.5, Zod v3.

## Global Constraints

- Node.js ≥ 20, Docker Desktop harus aktif sebelum `supabase start`
- `SUPABASE_SERVICE_ROLE_KEY` TIDAK BOLEH prefix `NEXT_PUBLIC_` — hanya boleh di server-side
- Session disimpan di httpOnly cookie, bukan localStorage
- Semua input divalidasi via Zod sebelum query DB
- UUID primary key + `timestamptz` timestamp di semua tabel
- Soft delete via `is_active = false`, bukan `DELETE`
- Tidak ada self-registration — semua akun dibuat oleh admin
- API response selalu berformat `{ data: T | null, error: { code, message } | null }`
- CPM dan Gantt **tidak disentuh** di Minggu 1

---

## File Map

```
d:\ngoding_lagi\revitalisasi-monitoring\
├── app/
│   ├── layout.tsx                         ← root layout (html/body saja)
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                   ← LOGIN PAGE (unprotected)
│   ├── (app)/
│   │   ├── layout.tsx                     ← Sidebar + session guard (RSC)
│   │   └── page.tsx                       ← Placeholder home (/)
│   └── api/
│       └── auth/
│           ├── login/route.ts
│           ├── logout/route.ts
│           └── me/route.ts
├── components/
│   ├── ui/                                ← shadcn/ui (auto-generated)
│   └── layout/
│       ├── Sidebar.tsx                    ← full nav per PRD §10.2
│       └── UserMenu.tsx                   ← avatar + logout
├── lib/
│   ├── supabase/
│   │   ├── client.ts                      ← createBrowserClient
│   │   ├── server.ts                      ← createServerClient (RSC/Route)
│   │   └── middleware.ts                  ← updateSession helper
│   └── validations.ts                     ← Zod: loginSchema
├── middleware.ts                          ← Auth guard global
├── supabase/
│   ├── config.toml                        ← auto-generated, default OK
│   ├── migrations/
│   │   ├── 001_initial_schema.sql         ← 13 tabel + trigger + index
│   │   └── 002_rls_policies.sql           ← get_my_role() + semua policy
│   └── seed.sql                           ← local-only: users, lokasi, holidays
├── .env.local.example
└── .env.local                             ← JANGAN commit — ada di .gitignore
```

---

## Task 1: Initialize Next.js 14 Project + Git

**Files:**
- Create: seluruh scaffolding via `create-next-app`
- Create: `.env.local.example`
- Modify: `.gitignore` (tambahkan `.env.local`)
- Delete: `app/page.tsx` (digantikan oleh `app/(app)/page.tsx` di Task 14)

**Interfaces:**
- Produces: project yang bisa `npm run dev`, path alias `@/*` → root, Tailwind + TypeScript aktif

- [ ] **Step 1: Scaffold Next.js 14**

  Dari direktori `d:\ngoding_lagi\revitalisasi-monitoring\` (sudah ada PRD di sana — pilih `y` jika ada prompt "continue in non-empty directory"):

  ```bash
  npx create-next-app@14 . --typescript --tailwind --eslint --app --import-alias "@/*" --no-git
  ```

  Jawab prompt interaktif jika muncul: pilih App Router = Yes, src/ dir = No.

- [ ] **Step 2: Install semua dependencies**

  ```bash
  npm install @supabase/supabase-js@^2.45.0 @supabase/ssr@^0.5.0
  npm install lucide-react@^0.383.0 date-fns@^3.6.0 zod@^3.23.0
  npm install @dnd-kit/core@^6.1.0 @dnd-kit/sortable@^8.0.0
  npm install --save-dev playwright@^1.45.0
  ```

- [ ] **Step 3: Buat `.env.local.example`**

  ```
  # Supabase — Local (dari output `supabase start`)
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-dari-supabase-start>
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key-dari-supabase-start>

  # App
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

- [ ] **Step 4: Tambahkan `.env.local` ke `.gitignore`**

  Buka `.gitignore` (sudah ada dari create-next-app). Pastikan baris ini ada:
  ```
  .env.local
  ```

- [ ] **Step 5: Git init + commit awal**

  ```bash
  git init
  git add -A
  git commit -m "feat: initialize Next.js 14 project with Tailwind + TS"
  ```

- [ ] **Step 6: Verify**

  ```bash
  npm run dev
  ```
  Expected: server berjalan di `http://localhost:3000`, halaman default Next.js tampil. Ctrl+C untuk stop.

---

## Task 2: shadcn/ui Setup

**Files:**
- Create: `components/ui/` (via shadcn CLI)
- Create: `lib/utils.ts` (via shadcn CLI)
- Modify: `tailwind.config.ts`, `app/globals.css` (via shadcn CLI)

**Interfaces:**
- Produces: `cn()` di `lib/utils.ts`, komponen `Button`, `Input`, `Label`, `Card` siap diimport dari `@/components/ui/`

- [ ] **Step 1: Init shadcn**

  ```bash
  npx shadcn@latest init
  ```

  Ketika ditanya:
  - Style: **Default**
  - Base color: **Slate**
  - CSS variables: **Yes**

- [ ] **Step 2: Install komponen yang dibutuhkan di Minggu 1**

  ```bash
  npx shadcn@latest add button input label card
  ```

- [ ] **Step 3: Verify**

  Pastikan file-file ini ada:
  ```
  components/ui/button.tsx
  components/ui/input.tsx
  components/ui/label.tsx
  components/ui/card.tsx
  lib/utils.ts
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add -A
  git commit -m "feat: add shadcn/ui with button, input, label, card"
  ```

---

## Task 3: Supabase Local Setup

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `.env.local` (dari output `supabase start`)

**Interfaces:**
- Produces: Supabase lokal berjalan di port 54321 (API), 54322 (DB), 54323 (Studio)

- [ ] **Step 1: Supabase init**

  ```bash
  supabase init
  ```
  
  Output: `supabase/config.toml` dibuat.

- [ ] **Step 2: Start Supabase**

  ```bash
  supabase start
  ```

  Tunggu sampai selesai (bisa 1-3 menit pertama kali karena pull Docker images).

  Output akan muncul seperti ini:
  ```
  API URL: http://127.0.0.1:54321
  GraphQL URL: http://127.0.0.1:54321/graphql/v1
  DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
  Studio URL: http://127.0.0.1:54323
  Inbucket URL: http://127.0.0.1:54324
  anon key: eyJ...
  service_role key: eyJ...
  ```

- [ ] **Step 3: Buat `.env.local` dari output**

  Copy nilai-nilai dari output `supabase start` ke file `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key dari output>
  SUPABASE_SERVICE_ROLE_KEY=<service_role key dari output>
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

- [ ] **Step 4: Verify Supabase Studio**

  Buka `http://127.0.0.1:54323` di browser — Supabase Studio harus terbuka.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/config.toml .env.local.example
  git commit -m "feat: initialize Supabase local development"
  ```

---

## Task 4: Migration 001 — Initial Schema (13 Tabel)

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Interfaces:**
- Produces: 13 tabel di schema `public`, trigger `on_auth_user_created`, semua index

- [ ] **Step 1: Buat file migration**

  Buat `supabase/migrations/001_initial_schema.sql` dengan konten berikut:

  ```sql
  -- 001_initial_schema.sql
  -- Semua tabel untuk Dashboard Revitalisasi Perumnas

  -- =============================================
  -- profiles
  -- =============================================
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

  -- Auto-create profile saat user baru dibuat di auth.users
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
    );
    RETURN NEW;
  END;
  $$;

  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

  -- =============================================
  -- locations
  -- =============================================
  CREATE TABLE public.locations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    code          TEXT NOT NULL UNIQUE,
    description   TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_by    UUID REFERENCES public.profiles(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- =============================================
  -- phases
  -- =============================================
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

  -- =============================================
  -- activities
  -- =============================================
  CREATE TABLE public.activities (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id                  UUID NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
    display_order             INTEGER NOT NULL DEFAULT 0,
    kegiatan                  TEXT NOT NULL,
    pic                       TEXT NOT NULL,
    tanggal_mulai_rencana     DATE NOT NULL,
    tanggal_selesai_rencana   DATE NOT NULL,
    tanggal_mulai_realisasi   DATE,
    tanggal_selesai_realisasi DATE,
    status                    TEXT NOT NULL DEFAULT 'belum_mulai'
                              CHECK (status IN ('belum_mulai','sedang_berjalan','selesai','ditunda')),
    progress_pct              INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    catatan                   TEXT,
    is_milestone              BOOLEAN NOT NULL DEFAULT FALSE,
    is_on_critical_path       BOOLEAN NOT NULL DEFAULT FALSE,
    -- TRUE = tanggal tidak digeser oleh CPM engine
    date_locked               BOOLEAN NOT NULL DEFAULT FALSE,
    created_by                UUID REFERENCES public.profiles(id),
    updated_by                UUID REFERENCES public.profiles(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_activities_phase_id ON public.activities(phase_id);
  CREATE INDEX idx_activities_critical ON public.activities(is_on_critical_path)
    WHERE is_on_critical_path = TRUE;

  -- =============================================
  -- activity_dependencies
  -- =============================================
  CREATE TABLE public.activity_dependencies (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predecessor_id   UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    successor_id     UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    dep_type         TEXT NOT NULL CHECK (dep_type IN ('FS','SS','FF','SF')),
    lag_days         INTEGER NOT NULL DEFAULT 0,
    created_by       UUID REFERENCES public.profiles(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (predecessor_id, successor_id),
    CHECK (predecessor_id <> successor_id)
  );

  CREATE INDEX idx_deps_predecessor ON public.activity_dependencies(predecessor_id);
  CREATE INDEX idx_deps_successor   ON public.activity_dependencies(successor_id);

  -- =============================================
  -- baselines
  -- =============================================
  CREATE TABLE public.baselines (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id  UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_by   UUID REFERENCES public.profiles(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- =============================================
  -- baseline_activities
  -- =============================================
  CREATE TABLE public.baseline_activities (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baseline_id              UUID NOT NULL REFERENCES public.baselines(id) ON DELETE CASCADE,
    activity_id              UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    kegiatan                 TEXT NOT NULL,
    tanggal_mulai_rencana    DATE NOT NULL,
    tanggal_selesai_rencana  DATE NOT NULL,
    is_milestone             BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (baseline_id, activity_id)
  );

  -- =============================================
  -- stakeholders
  -- =============================================
  CREATE TABLE public.stakeholders (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code           TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL,
    group_name     TEXT NOT NULL,
    display_order  INTEGER NOT NULL DEFAULT 0,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_by     UUID REFERENCES public.profiles(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- =============================================
  -- raci_entries
  -- =============================================
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

  -- =============================================
  -- risk_items
  -- =============================================
  CREATE TABLE public.risk_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id      UUID NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    description   TEXT,
    category      TEXT NOT NULL
                  CHECK (category IN ('teknis','hukum','keuangan','sosial','lingkungan','lainnya')),
    probability   INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
    impact        INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
    score         INTEGER GENERATED ALWAYS AS (probability * impact) STORED,
    mitigation    TEXT,
    owner         TEXT,
    status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','mitigated','closed')),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_by    UUID REFERENCES public.profiles(id),
    updated_by    UUID REFERENCES public.profiles(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_risks_phase_id ON public.risk_items(phase_id);

  -- =============================================
  -- work_calendar
  -- =============================================
  CREATE TABLE public.work_calendar (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date DATE NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    created_by   UUID REFERENCES public.profiles(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_work_calendar_date ON public.work_calendar(holiday_date);

  -- =============================================
  -- kk_consent  (1 baris per lokasi — Fase 1)
  -- =============================================
  CREATE TABLE public.kk_consent (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE UNIQUE,
    target_kk       INTEGER NOT NULL DEFAULT 0,
    setuju          INTEGER NOT NULL DEFAULT 0,
    menolak         INTEGER NOT NULL DEFAULT 0,
    belum_dihubungi INTEGER GENERATED ALWAYS AS (target_kk - setuju - menolak) STORED,
    threshold_pct   INTEGER NOT NULL DEFAULT 60,
    catatan         TEXT,
    updated_by      UUID REFERENCES public.profiles(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- =============================================
  -- reporting_items
  -- =============================================
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

  -- =============================================
  -- audit_logs
  -- =============================================
  CREATE TABLE public.audit_logs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID REFERENCES public.profiles(id),
    user_email         TEXT NOT NULL,
    user_name          TEXT NOT NULL,
    action             TEXT NOT NULL CHECK (action IN (
                         'CREATE','UPDATE','DELETE','LOGIN','LOGOUT',
                         'BASELINE_SAVE','RECALCULATE'
                       )),
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

- [ ] **Step 2: Commit**

  ```bash
  git add supabase/migrations/001_initial_schema.sql
  git commit -m "feat: add initial DB schema (13 tables + trigger)"
  ```

---

## Task 5: Migration 002 — RLS Policies

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`

**Interfaces:**
- Produces: `get_my_role()` function + RLS aktif di semua 13 tabel. Pola: SELECT = semua `authenticated`, INSERT/UPDATE/DELETE = `admin` + `super_admin`. Exception: `audit_logs` INSERT = hanya `service_role`.

- [ ] **Step 1: Buat file RLS**

  Buat `supabase/migrations/002_rls_policies.sql`:

  ```sql
  -- 002_rls_policies.sql

  -- Helper: ambil role user yang sedang login
  CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
  $$;

  -- =============================================
  -- profiles — aturan khusus (lihat PRD §4)
  -- =============================================
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT TO authenticated USING (is_active = TRUE);

  -- Super Admin bisa create siapa saja
  CREATE POLICY "profiles_insert_sa" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (get_my_role() = 'super_admin');

  -- Admin hanya bisa create viewer
  CREATE POLICY "profiles_insert_admin" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (get_my_role() = 'admin' AND role = 'viewer');

  CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (
      get_my_role() = 'super_admin' OR
      (get_my_role() = 'admin' AND role = 'viewer')
    );

  -- =============================================
  -- locations
  -- =============================================
  ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "locations_select" ON public.locations
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "locations_write" ON public.locations
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- phases
  -- =============================================
  ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "phases_select" ON public.phases
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "phases_write" ON public.phases
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- activities
  -- =============================================
  ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "activities_select" ON public.activities
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "activities_write" ON public.activities
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- activity_dependencies
  -- =============================================
  ALTER TABLE public.activity_dependencies ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "deps_select" ON public.activity_dependencies
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "deps_write" ON public.activity_dependencies
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- baselines
  -- =============================================
  ALTER TABLE public.baselines ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "baselines_select" ON public.baselines
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "baselines_write" ON public.baselines
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- baseline_activities
  -- =============================================
  ALTER TABLE public.baseline_activities ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "baseline_acts_select" ON public.baseline_activities
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "baseline_acts_write" ON public.baseline_activities
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- stakeholders
  -- =============================================
  ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "stakeholders_select" ON public.stakeholders
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "stakeholders_write" ON public.stakeholders
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- raci_entries
  -- =============================================
  ALTER TABLE public.raci_entries ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "raci_select" ON public.raci_entries
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "raci_write" ON public.raci_entries
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- risk_items
  -- =============================================
  ALTER TABLE public.risk_items ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "risks_select" ON public.risk_items
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "risks_write" ON public.risk_items
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- work_calendar
  -- =============================================
  ALTER TABLE public.work_calendar ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "workcal_select" ON public.work_calendar
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "workcal_write" ON public.work_calendar
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- kk_consent
  -- =============================================
  ALTER TABLE public.kk_consent ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "kk_select" ON public.kk_consent
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "kk_write" ON public.kk_consent
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- reporting_items
  -- =============================================
  ALTER TABLE public.reporting_items ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "reporting_select" ON public.reporting_items
    FOR SELECT TO authenticated USING (TRUE);

  CREATE POLICY "reporting_write" ON public.reporting_items
    FOR ALL TO authenticated
    USING (get_my_role() IN ('admin','super_admin'))
    WITH CHECK (get_my_role() IN ('admin','super_admin'));

  -- =============================================
  -- audit_logs — INSERT hanya dari service_role (API server)
  -- =============================================
  ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "audit_select_admin" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (get_my_role() IN ('admin','super_admin'));

  CREATE POLICY "audit_insert_service" ON public.audit_logs
    FOR INSERT TO service_role WITH CHECK (TRUE);
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add supabase/migrations/002_rls_policies.sql
  git commit -m "feat: add RLS policies for all 13 tables"
  ```

---

## Task 6: Seed Data (Local Only)

**Files:**
- Create: `supabase/seed.sql`

**Interfaces:**
- Produces: 3 test auth users → profiles, 4 lokasi, kk_consent per lokasi, 15 stakeholders, libur nasional 2026–2027

> **PENTING:** `supabase/seed.sql` hanya jalan di `supabase db reset` (lokal). JANGAN di-push ke production via `supabase db push`.

- [ ] **Step 1: Buat `supabase/seed.sql`**

  ```sql
  -- supabase/seed.sql
  -- LOCAL ONLY — tidak untuk production
  -- Tanggal libur bertanda (est.) harus diverifikasi di:
  -- https://www.setneg.go.id/baca/index/penetapan_hari_libur_nasional_dan_cuti_bersama

  -- =============================================
  -- AUTH USERS (3 test accounts)
  -- =============================================
  DO $$
  DECLARE
    sa_id     uuid := '11111111-1111-1111-1111-111111111111';
    admin_id  uuid := '22222222-2222-2222-2222-222222222222';
    viewer_id uuid := '33333333-3333-3333-3333-333333333333';
  BEGIN
    -- Super Admin
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      aud, role, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      sa_id, '00000000-0000-0000-0000-000000000000',
      'superadmin@perumnas.co.id',
      crypt('SuperAdmin123!', gen_salt('bf')),
      NOW(), NOW(), NOW(), 'authenticated', 'authenticated',
      '{"full_name":"Super Admin Perumnas","role":"super_admin"}'::jsonb,
      '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      sa_id, sa_id, 'superadmin@perumnas.co.id', 'email',
      format('{"sub":"%s","email":"superadmin@perumnas.co.id","email_verified":true}',
             sa_id::text)::jsonb,
      NOW(), NOW(), NOW()
    ) ON CONFLICT DO NOTHING;

    -- Admin
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      aud, role, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      admin_id, '00000000-0000-0000-0000-000000000000',
      'admin@perumnas.co.id',
      crypt('Admin123!', gen_salt('bf')),
      NOW(), NOW(), NOW(), 'authenticated', 'authenticated',
      '{"full_name":"Admin Perumnas","role":"admin"}'::jsonb,
      '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      admin_id, admin_id, 'admin@perumnas.co.id', 'email',
      format('{"sub":"%s","email":"admin@perumnas.co.id","email_verified":true}',
             admin_id::text)::jsonb,
      NOW(), NOW(), NOW()
    ) ON CONFLICT DO NOTHING;

    -- Viewer
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      aud, role, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      viewer_id, '00000000-0000-0000-0000-000000000000',
      'viewer@perumnas.co.id',
      crypt('Viewer123!', gen_salt('bf')),
      NOW(), NOW(), NOW(), 'authenticated', 'authenticated',
      '{"full_name":"Viewer Perumnas","role":"viewer"}'::jsonb,
      '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      viewer_id, viewer_id, 'viewer@perumnas.co.id', 'email',
      format('{"sub":"%s","email":"viewer@perumnas.co.id","email_verified":true}',
             viewer_id::text)::jsonb,
      NOW(), NOW(), NOW()
    ) ON CONFLICT DO NOTHING;
  END $$;

  -- =============================================
  -- LOCATIONS (4)
  -- =============================================
  INSERT INTO public.locations (name, code, description, display_order) VALUES
    ('Tanah Abang',      'TA',  'Rusun Tanah Abang, Jakarta Pusat',       1),
    ('Kebon Kacang',     'KK',  'Rusun Kebon Kacang, Jakarta Pusat',      2),
    ('Klender',           'KL',  'Rusun Klender, Jakarta Timur',           3),
    ('Kemayoran Blok A', 'KMY', 'Rusun Kemayoran Blok A, Jakarta Pusat',  4)
  ON CONFLICT (code) DO NOTHING;

  -- =============================================
  -- KK CONSENT (1 baris per lokasi)
  -- =============================================
  INSERT INTO public.kk_consent (location_id, target_kk, threshold_pct)
  SELECT id,
    CASE code
      WHEN 'TA'  THEN 960
      WHEN 'KK'  THEN 0
      WHEN 'KL'  THEN 0
      WHEN 'KMY' THEN 0
    END,
    60
  FROM public.locations
  ON CONFLICT (location_id) DO NOTHING;

  -- =============================================
  -- STAKEHOLDERS (15)
  -- =============================================
  INSERT INTO public.stakeholders (code, name, group_name, display_order) VALUES
    ('TR',      'Tim Revitalisasi (Perumnas)',                           'Perumnas',    1),
    ('DB',      'Div. Pengembangan Bisnis',                              'Perumnas',    2),
    ('DPm',     'Div. Pemasaran',                                        'Perumnas',    3),
    ('DPT',     'Div. Perencanaan Teknis',                               'Perumnas',    4),
    ('DH',      'Div. Hukum',                                            'Perumnas',    5),
    ('DPr',     'Div. Pertanahan',                                       'Perumnas',    6),
    ('DIR',     'Direksi Perumnas',                                      'Perumnas',    7),
    ('B-PM',    'Bappenas – Penasihat Menteri',                          'Bappenas',    8),
    ('B-SA',    'Bappenas – Staf Ahli Menteri',                          'Bappenas',    9),
    ('P-PKP',   'Pemprov DKI – Dinas Perumahan Rakyat & KP',            'Pemprov DKI', 10),
    ('P-CKTRP', 'Pemprov DKI – Dinas Cipta Karya, Tata Ruang & Ptnh',  'Pemprov DKI', 11),
    ('P-PTSP',  'Pemprov DKI – Dinas Penanaman Modal & PTSP',           'Pemprov DKI', 12),
    ('P-DLH',   'Pemprov DKI – Dinas Lingkungan Hidup',                 'Pemprov DKI', 13),
    ('P-DSHB',  'Pemprov DKI – Dinas Perhubungan',                      'Pemprov DKI', 14),
    ('P-BPD',   'Pemprov DKI – Bappeda',                                'Pemprov DKI', 15)
  ON CONFLICT (code) DO NOTHING;

  -- =============================================
  -- WORK CALENDAR — Libur Nasional 2026-2027
  -- Tanggal (est.) = estimasi, wajib diverifikasi sebelum produksi
  -- =============================================
  INSERT INTO public.work_calendar (holiday_date, name) VALUES
    -- 2026
    ('2026-01-01', 'Tahun Baru Masehi 2026'),
    ('2026-01-29', 'Tahun Baru Imlek 2577 Kong Zi'),
    ('2026-02-18', 'Isra Mikraj Nabi Muhammad SAW 1447 H'),       -- est.
    ('2026-03-22', 'Hari Suci Nyepi – Tahun Baru Saka 1948'),     -- est.
    ('2026-04-03', 'Wafat Isa Al Masih'),
    ('2026-04-20', 'Cuti Bersama Idul Fitri 1447 H'),             -- est.
    ('2026-04-21', 'Hari Raya Idul Fitri 1447 H'),                -- est.
    ('2026-04-22', 'Hari Raya Idul Fitri 1447 H Hari ke-2'),      -- est.
    ('2026-04-23', 'Cuti Bersama Idul Fitri 1447 H'),             -- est.
    ('2026-04-24', 'Cuti Bersama Idul Fitri 1447 H'),             -- est.
    ('2026-05-14', 'Kenaikan Yesus Kristus'),
    ('2026-05-23', 'Hari Raya Waisak 2570 BE'),                   -- est.
    ('2026-06-06', 'Hari Raya Idul Adha 1447 H'),                 -- est.
    ('2026-06-26', 'Tahun Baru Islam 1448 H'),                    -- est.
    ('2026-08-17', 'Hari Kemerdekaan Republik Indonesia'),
    ('2026-09-04', 'Maulid Nabi Muhammad SAW 1448 H'),            -- est.
    ('2026-12-25', 'Hari Raya Natal'),
    ('2026-12-26', 'Cuti Bersama Natal'),                         -- est.
    -- 2027
    ('2027-01-01', 'Tahun Baru Masehi 2027'),
    ('2027-01-17', 'Tahun Baru Imlek 2578 Kong Zi'),               -- est.
    ('2027-02-07', 'Isra Mikraj Nabi Muhammad SAW 1448 H'),        -- est.
    ('2027-03-11', 'Hari Suci Nyepi – Tahun Baru Saka 1949'),      -- est.
    ('2027-03-26', 'Wafat Isa Al Masih'),                           -- est.
    ('2027-04-10', 'Hari Raya Idul Fitri 1448 H'),                  -- est.
    ('2027-04-11', 'Hari Raya Idul Fitri 1448 H Hari ke-2'),        -- est.
    ('2027-05-03', 'Kenaikan Yesus Kristus'),                       -- est.
    ('2027-05-12', 'Hari Raya Waisak 2571 BE'),                     -- est.
    ('2027-05-27', 'Hari Raya Idul Adha 1448 H'),                   -- est.
    ('2027-06-15', 'Tahun Baru Islam 1449 H'),                      -- est.
    ('2027-08-17', 'Hari Kemerdekaan Republik Indonesia'),
    ('2027-08-24', 'Maulid Nabi Muhammad SAW 1449 H'),              -- est.
    ('2027-12-25', 'Hari Raya Natal'),
    ('2027-12-26', 'Cuti Bersama Natal')                            -- est.
  ON CONFLICT (holiday_date) DO NOTHING;
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add supabase/seed.sql
  git commit -m "feat: add local seed data (users, locations, stakeholders, holidays)"
  ```

---

## Task 7: Apply Migrations + Verify DB

**Files:** tidak ada file baru

**Interfaces:**
- Produces: 13 tabel di DB lokal, 3 user bisa login, RLS aktif

- [ ] **Step 1: Terapkan semua migrasi + seed**

  ```bash
  supabase db reset
  ```

  Expected output:
  ```
  Resetting local database...
  Applying migration 001_initial_schema.sql...
  Applying migration 002_rls_policies.sql...
  Seeding data supabase/seed.sql...
  Finished supabase db reset on branch: main
  ```

- [ ] **Step 2: Verifikasi tabel di Studio**

  Buka `http://127.0.0.1:54323` → Table Editor. Verifikasi 13 tabel ada:
  - `profiles`, `locations`, `phases`, `activities`, `activity_dependencies`
  - `baselines`, `baseline_activities`, `stakeholders`, `raci_entries`, `risk_items`
  - `work_calendar`, `kk_consent`, `reporting_items`, `audit_logs`

- [ ] **Step 3: Verifikasi data seed**

  Di Studio → Table Editor → `locations`: harus ada 4 baris (TA, KK, KL, KMY).
  
  Di Studio → Table Editor → `profiles`: harus ada 3 baris (SA, admin, viewer) yang otomatis dibuat oleh trigger.

  Di Studio → Table Editor → `work_calendar`: harus ada 32+ baris libur.

- [ ] **Step 4: Verifikasi RLS**

  Di Studio → Authentication → Policies: setiap tabel harus punya policies.

---

## Task 8: Supabase Client Utilities

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`

**Interfaces:**
- Produces:
  - `createClient()` dari `@/lib/supabase/client` → browser Supabase client
  - `createClient()` dari `@/lib/supabase/server` → server-side Supabase client (RSC/Route Handlers)
  - `updateSession(request)` dari `@/lib/supabase/middleware` → refresh session + return `{ response, user }`

- [ ] **Step 1: Browser client**

  Buat `lib/supabase/client.ts`:
  ```typescript
  import { createBrowserClient } from '@supabase/ssr'

  export function createClient() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  ```

- [ ] **Step 2: Server client (RSC + Route Handlers)**

  Buat `lib/supabase/server.ts`:
  ```typescript
  import { createServerClient } from '@supabase/ssr'
  import { cookies } from 'next/headers'

  export function createClient() {
    const cookieStore = cookies()

    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Called from Server Component — cookies are read-only, handled by middleware
            }
          },
        },
      }
    )
  }
  ```

- [ ] **Step 3: Middleware session helper**

  Buat `lib/supabase/middleware.ts`:
  ```typescript
  import { createServerClient } from '@supabase/ssr'
  import { NextResponse, type NextRequest } from 'next/server'

  export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    return { response: supabaseResponse, user }
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add lib/supabase/
  git commit -m "feat: add Supabase client utilities (browser, server, middleware)"
  ```

---

## Task 9: Global Auth Middleware

**Files:**
- Create: `middleware.ts` (di root project)

**Interfaces:**
- Consumes: `updateSession` dari `@/lib/supabase/middleware`
- Produces: unauthenticated → redirect `/login`; authenticated di `/login` → redirect `/`

- [ ] **Step 1: Buat `middleware.ts`**

  ```typescript
  import { type NextRequest, NextResponse } from 'next/server'
  import { updateSession } from '@/lib/supabase/middleware'

  export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const { response, user } = await updateSession(request)

    const isLoginPage = pathname === '/login'

    if (!user && !isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    if (user && isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    return response
  }

  export const config = {
    matcher: [
      /*
       * Match all request paths EXCEPT:
       * - _next/static (static files)
       * - _next/image (image optimization)
       * - favicon.ico
       * - image files
       */
      '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add middleware.ts
  git commit -m "feat: add global auth middleware (protect all routes except /login)"
  ```

---

## Task 10: Auth Validations + API Routes

**Files:**
- Create: `lib/validations.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/me/route.ts`

**Interfaces:**
- Produces:
  - `POST /api/auth/login` → `{ data: { id, email, full_name, role }, error }`
  - `POST /api/auth/logout` → `{ data: null, error: null }`
  - `GET /api/auth/me` → `{ data: { id, email, full_name, role, is_active }, error }`

- [ ] **Step 1: Zod schema**

  Buat `lib/validations.ts`:
  ```typescript
  import { z } from 'zod'

  export const loginSchema = z.object({
    email: z.string().email('Email tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
  })

  export type LoginInput = z.infer<typeof loginSchema>
  ```

- [ ] **Step 2: Login route**

  Buat `app/api/auth/login/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'
  import { loginSchema } from '@/lib/validations'

  export async function POST(request: NextRequest) {
    try {
      const body = await request.json()
      const parsed = loginSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json(
          { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
          { status: 400 }
        )
      }

      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      })

      if (error || !data.user) {
        return NextResponse.json(
          { data: null, error: { code: 'AUTH_ERROR', message: 'Email atau password salah' } },
          { status: 401 }
        )
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active, role, full_name')
        .eq('id', data.user.id)
        .single()

      if (!profile?.is_active) {
        await supabase.auth.signOut()
        return NextResponse.json(
          { data: null, error: { code: 'ACCOUNT_DISABLED', message: 'Akun Anda telah dinonaktifkan' } },
          { status: 403 }
        )
      }

      return NextResponse.json({
        data: {
          id: data.user.id,
          email: data.user.email,
          full_name: profile.full_name,
          role: profile.role,
        },
        error: null,
      })
    } catch {
      return NextResponse.json(
        { data: null, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan server' } },
        { status: 500 }
      )
    }
  }
  ```

- [ ] **Step 3: Logout route**

  Buat `app/api/auth/logout/route.ts`:
  ```typescript
  import { NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'

  export async function POST() {
    const supabase = createClient()
    await supabase.auth.signOut()
    return NextResponse.json({ data: null, error: null })
  }
  ```

- [ ] **Step 4: Me route**

  Buat `app/api/auth/me/route.ts`:
  ```typescript
  import { NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'

  export async function GET() {
    const supabase = createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { data: null, error: { code: 'UNAUTHORIZED', message: 'Tidak terautentikasi' } },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role, is_active, created_at')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name ?? '',
        role: profile?.role ?? 'viewer',
        is_active: profile?.is_active ?? false,
      },
      error: null,
    })
  }
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add lib/validations.ts app/api/auth/
  git commit -m "feat: add auth API routes (login, logout, me) with Zod validation"
  ```

---

## Task 11: Login Page

**Files:**
- Create: `app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/login`, shadcn Button/Input/Label/Card
- Produces: halaman di `/login`, redirect ke `/` setelah berhasil login

- [ ] **Step 1: Buat login page**

  Buat `app/(auth)/login/page.tsx`:
  ```tsx
  'use client'

  import { useState } from 'react'
  import { useRouter } from 'next/navigation'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card'

  export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      setError(null)
      setLoading(true)

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const json = await res.json()

        if (!res.ok || json.error) {
          setError(json.error?.message ?? 'Login gagal')
          return
        }

        router.push('/')
        router.refresh()
      } catch {
        setError('Terjadi kesalahan jaringan')
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">
                P
              </div>
              <span className="text-sm font-semibold text-gray-600">Perum Perumnas</span>
            </div>
            <CardTitle className="text-xl">Masuk ke Sistem</CardTitle>
            <CardDescription>Dashboard Manajemen Revitalisasi Rusun</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@perumnas.co.id"
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Memproses...' : 'Masuk'}
              </Button>
            </form>
            <p className="text-xs text-gray-400 text-center mt-4">
              Tidak ada akses? Hubungi Admin Perumnas.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add app/\(auth\)/
  git commit -m "feat: add login page with email/password form"
  ```

---

## Task 12: Root Layout Cleanup

**Files:**
- Modify: `app/layout.tsx` (root — minimal, hanya html/body)
- Delete: `app/page.tsx` (default dari create-next-app — konflik dengan `(app)/page.tsx`)

**Interfaces:**
- Produces: root layout tanpa sidebar (sidebar ada di `(app)/layout.tsx`)

- [ ] **Step 1: Update root `app/layout.tsx`**

  Ganti seluruh isi `app/layout.tsx` dengan:
  ```tsx
  import type { Metadata } from 'next'
  import { Inter } from 'next/font/google'
  import './globals.css'

  const inter = Inter({ subsets: ['latin'] })

  export const metadata: Metadata = {
    title: 'Dashboard Revitalisasi Perumnas',
    description: 'Sistem Pemantauan Multi-Lokasi Revitalisasi Rusun',
  }

  export default function RootLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
      <html lang="id">
        <body className={inter.className}>{children}</body>
      </html>
    )
  }
  ```

- [ ] **Step 2: Hapus `app/page.tsx` bawaan create-next-app**

  ```bash
  # PowerShell:
  Remove-Item "app\page.tsx"
  # Bash:
  rm app/page.tsx
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add app/layout.tsx
  git rm app/page.tsx
  git commit -m "refactor: simplify root layout, remove default page"
  ```

---

## Task 13: Components Layout — Sidebar + UserMenu

**Files:**
- Create: `components/layout/Sidebar.tsx`
- Create: `components/layout/UserMenu.tsx`

**Interfaces:**
- Consumes:
  - `Sidebar({ profile: { id, email, full_name, role }, locations: [{ id, name, code }] })`
  - `UserMenu({ profile: { id, email, full_name, role } })`
- Produces: sidebar navigasi lengkap per PRD §10.2, logout button yang call `/api/auth/logout`

- [ ] **Step 1: Buat `components/layout/UserMenu.tsx`**

  ```tsx
  'use client'

  import { useState } from 'react'
  import { useRouter } from 'next/navigation'

  interface Profile {
    id: string
    email: string
    full_name: string
    role: 'super_admin' | 'admin' | 'viewer'
  }

  const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    viewer: 'Viewer',
  }

  export function UserMenu({ profile }: { profile: Profile }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function handleLogout() {
      setLoading(true)
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    }

    const initials = profile.full_name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase()

    return (
      <div className="flex items-center gap-2 px-1 py-1">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
          <p className="text-xs text-gray-500">{ROLE_LABELS[profile.role]}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 flex-shrink-0 transition-colors"
          title="Keluar"
        >
          {loading ? '...' : 'Keluar'}
        </button>
      </div>
    )
  }
  ```

- [ ] **Step 2: Buat `components/layout/Sidebar.tsx`**

  ```tsx
  'use client'

  import Link from 'next/link'
  import { usePathname } from 'next/navigation'
  import { cn } from '@/lib/utils'
  import { UserMenu } from './UserMenu'

  interface Profile {
    id: string
    email: string
    full_name: string
    role: 'super_admin' | 'admin' | 'viewer'
  }

  interface Location {
    id: string
    name: string
    code: string
  }

  interface SidebarProps {
    profile: Profile
    locations: Location[]
  }

  function NavLink({
    href,
    icon,
    label,
    pathname,
    exact = false,
  }: {
    href: string
    icon: string
    label: string
    pathname: string
    exact?: boolean
  }) {
    const isActive = exact
      ? pathname === href
      : pathname === href || (href !== '/' && pathname.startsWith(href))

    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        <span className="text-base leading-none">{icon}</span>
        <span className="leading-snug">{label}</span>
      </Link>
    )
  }

  function SectionLabel({ label }: { label: string }) {
    return (
      <p className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </p>
    )
  }

  export function Sidebar({ profile, locations }: SidebarProps) {
    const pathname = usePathname()
    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'

    // Extract locationCode dari pathname, e.g. /dashboard/TA/fase-1 → "TA"
    const locationCodeMatch = pathname.match(/^\/dashboard\/([A-Z]+)/)
    const currentCode = locationCodeMatch?.[1]

    return (
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col z-40">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">
              P
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Perumnas</div>
              <div className="text-xs text-gray-400">Revitalisasi Rusun</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <NavLink href="/" icon="🌐" label="Dashboard Lintas-Lokasi" pathname={pathname} exact />

          {/* Pilih Lokasi */}
          <SectionLabel label="Pilih Lokasi" />
          <div className="px-1 pb-1">
            <select
              className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={currentCode ?? ''}
              onChange={(e) => {
                if (e.target.value) {
                  window.location.href = `/dashboard/${e.target.value}`
                }
              }}
            >
              <option value="">— Pilih Lokasi —</option>
              {locations.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          {/* Per-Lokasi Nav */}
          {currentCode && (
            <>
              <NavLink href={`/dashboard/${currentCode}`} icon="📊" label="Ringkasan" pathname={pathname} exact />
              <NavLink href={`/dashboard/${currentCode}/timeline`} icon="📅" label="Timeline / Gantt" pathname={pathname} />
              <NavLink href={`/dashboard/${currentCode}/fase-1`} icon="📋" label="Fase 1 – Sosialisasi" pathname={pathname} />
              <NavLink href={`/dashboard/${currentCode}/fase-2`} icon="📋" label="Fase 2 – Investor" pathname={pathname} />
              <NavLink href={`/dashboard/${currentCode}/fase-3`} icon="📋" label="Fase 3 – Pemasaran" pathname={pathname} />
              <NavLink href={`/dashboard/${currentCode}/fase-4`} icon="📋" label="Fase 4 – Legal" pathname={pathname} />
              <NavLink href={`/dashboard/${currentCode}/risks`} icon="⚠️" label="Risk Register" pathname={pathname} />
              <NavLink href={`/dashboard/${currentCode}/kk-consent`} icon="🏘️" label="Persetujuan Warga" pathname={pathname} />
            </>
          )}

          {/* Global */}
          <SectionLabel label="Global" />
          <NavLink href="/raci" icon="👥" label="RACI" pathname={pathname} />
          <NavLink href="/pelaporan" icon="📋" label="Pelaporan" pathname={pathname} />
          <NavLink href="/workload" icon="👔" label="Workload View" pathname={pathname} />

          {isAdmin && (
            <>
              <NavLink href="/work-calendar" icon="📅" label="Kalender Kerja" pathname={pathname} />
              <NavLink href="/audit-log" icon="📜" label="Audit Log" pathname={pathname} />
              <NavLink href="/users" icon="⚙️" label="Users & Lokasi" pathname={pathname} />
            </>
          )}
        </nav>

        {/* Footer — User */}
        <div className="border-t border-gray-200 p-2 flex-shrink-0">
          <UserMenu profile={profile} />
        </div>
      </aside>
    )
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add components/layout/
  git commit -m "feat: add Sidebar and UserMenu components"
  ```

---

## Task 14: App Layout + Placeholder Home Page

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/page.tsx`

**Interfaces:**
- Consumes: `Sidebar`, `createClient()` dari server
- Produces: layout dengan sidebar (RSC), `/` menampilkan grid 4 kartu lokasi

- [ ] **Step 1: Buat `app/(app)/layout.tsx`**

  ```tsx
  import { redirect } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import { Sidebar } from '@/components/layout/Sidebar'

  export default async function AppLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut()
      redirect('/login')
    }

    const { data: locations } = await supabase
      .from('locations')
      .select('id, name, code')
      .eq('is_active', true)
      .order('display_order')

    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar profile={profile} locations={locations ?? []} />
        <main className="flex-1 ml-64 min-h-screen">
          <div className="p-6 max-w-7xl">{children}</div>
        </main>
      </div>
    )
  }
  ```

- [ ] **Step 2: Buat `app/(app)/page.tsx`**

  ```tsx
  import { createClient } from '@/lib/supabase/server'
  import Link from 'next/link'

  export default async function HomePage() {
    const supabase = createClient()
    const { data: locations } = await supabase
      .from('locations')
      .select('id, name, code, description')
      .eq('is_active', true)
      .order('display_order')

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Program Revitalisasi Rusun
        </h1>
        <p className="text-gray-500 mt-1 mb-6">Ringkasan Semua Lokasi — Perum Perumnas</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(locations ?? []).map((loc) => (
            <Link
              key={loc.code}
              href={`/dashboard/${loc.code}`}
              className="block p-5 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group"
            >
              <div className="text-xs font-bold text-blue-600 mb-1 uppercase tracking-wide">
                {loc.code}
              </div>
              <div className="font-semibold text-gray-900 group-hover:text-blue-700">
                {loc.name}
              </div>
              {loc.description && (
                <div className="text-xs text-gray-400 mt-1">{loc.description}</div>
              )}
              <div className="text-xs text-blue-500 mt-3 group-hover:underline">
                Buka Dashboard →
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700 font-medium">Minggu 1 — Fondasi selesai</p>
          <p className="text-xs text-amber-600 mt-1">
            Fase berikutnya: API routes data layer (Minggu 2), lalu Fase CRUD (Minggu 3).
            CPM Engine mulai Minggu 4.
          </p>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add app/\(app\)/
  git commit -m "feat: add app layout with sidebar and placeholder home page"
  ```

---

## Task 15: Manual E2E Verification

**Files:** tidak ada file baru

**Checklist verifikasi sebelum Minggu 2:**

- [ ] **Auth flow — Super Admin**
  1. Buka `http://localhost:3000` → harus redirect ke `/login`
  2. Login dengan `superadmin@perumnas.co.id` / `SuperAdmin123!`
  3. Harus redirect ke `/` → tampil 4 kartu lokasi
  4. Sidebar harus tampil menu "Kalender Kerja", "Audit Log", "Users & Lokasi"
  5. Klik "Keluar" → redirect ke `/login`

- [ ] **Auth flow — Viewer**
  1. Login dengan `viewer@perumnas.co.id` / `Viewer123!`
  2. Harus masuk berhasil
  3. Sidebar **tidak** tampil menu admin (Kalender Kerja, Audit Log, Users & Lokasi)

- [ ] **Protected route**
  1. Logout, lalu coba akses `http://localhost:3000/` manual → harus redirect ke `/login`
  2. Login, lalu akses `http://localhost:3000/login` → harus redirect ke `/`

- [ ] **Sidebar navigasi**
  1. Pilih lokasi "Tanah Abang" dari dropdown → URL berubah ke `/dashboard/TA`
  2. Menu per-lokasi (Ringkasan, Timeline, Fase 1–4, Risk, KK Consent) muncul di sidebar

- [ ] **API me**
  Dengan browser yang sudah login, buka `http://localhost:3000/api/auth/me` → harus tampil JSON user aktif.

- [ ] **RLS check**
  Di Supabase Studio (http://127.0.0.1:54323) → Authentication → Policies:
  - Semua 13 tabel harus punya policies (tidak boleh ada yang kosong/tanpa RLS)

- [ ] **Final commit setelah semua test lulus**

  ```bash
  git add -A
  git commit -m "chore: Week 1 complete — DB foundation + auth flow verified"
  ```

---

## Self-Review — Spec Coverage

| Bagian PRD | Task |
|---|---|
| §6.1–6.13 — 13 tabel | Task 4 |
| §7 — RLS + get_my_role() | Task 5 |
| §10.1 — Auth flow, session cookie | Task 8–11 |
| §10.2 — Sidebar nav | Task 13 |
| §12 — Struktur folder | Semua task |
| §13 — .env.local | Task 1, 3 |
| §14 — Panduan local testing | Task 3, 7 |
| §18 — Seed data | Task 6 |
| Milestone 1 §16 | Semua task |

**Tidak diimplementasikan (by design — Minggu selanjutnya):**
- CPM Engine (`lib/cpm.ts`, `lib/calendar.ts`) → Minggu 4
- Gantt Chart → Minggu 6
- Semua API routes data (§9.2–9.16) → Minggu 2
- CRUD halaman → Minggu 3+
