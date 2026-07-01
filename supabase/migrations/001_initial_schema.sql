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
