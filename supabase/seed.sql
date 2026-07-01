-- supabase/seed.sql
-- Cloud-compatible seed data for Supabase Cloud
-- NOTE: Auth users must be created manually via Supabase Dashboard
-- See supabase/seed_users_MANUAL.md for instructions
--
-- Run this via Supabase Dashboard → SQL Editor after applying migrations
-- Tanggal libur bertanda (est.) wajib diverifikasi di:
-- https://www.setneg.go.id/baca/index/penetapan_hari_libur_nasional_dan_cuti_bersama

-- =============================================
-- LOCATIONS (4)
-- =============================================
INSERT INTO public.locations (name, code, description, display_order) VALUES
  ('Tanah Abang',      'TA',  'Rusun Tanah Abang, Jakarta Pusat',       1),
  ('Kebon Kacang',     'KK',  'Rusun Kebon Kacang, Jakarta Pusat',      2),
  ('Klender',          'KL',  'Rusun Klender, Jakarta Timur',           3),
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
  ('TR',      'Tim Revitalisasi (Perumnas)',                          'Perumnas',    1),
  ('DB',      'Div. Pengembangan Bisnis',                             'Perumnas',    2),
  ('DPm',     'Div. Pemasaran',                                       'Perumnas',    3),
  ('DPT',     'Div. Perencanaan Teknis',                              'Perumnas',    4),
  ('DH',      'Div. Hukum',                                           'Perumnas',    5),
  ('DPr',     'Div. Pertanahan',                                      'Perumnas',    6),
  ('DIR',     'Direksi Perumnas',                                     'Perumnas',    7),
  ('B-PM',    'Bappenas – Penasihat Menteri',                         'Bappenas',    8),
  ('B-SA',    'Bappenas – Staf Ahli Menteri',                         'Bappenas',    9),
  ('P-PKP',   'Pemprov DKI – Dinas Perumahan Rakyat & KP',           'Pemprov DKI', 10),
  ('P-CKTRP', 'Pemprov DKI – Dinas Cipta Karya, Tata Ruang & Ptnh', 'Pemprov DKI', 11),
  ('P-PTSP',  'Pemprov DKI – Dinas Penanaman Modal & PTSP',          'Pemprov DKI', 12),
  ('P-DLH',   'Pemprov DKI – Dinas Lingkungan Hidup',                'Pemprov DKI', 13),
  ('P-DSHB',  'Pemprov DKI – Dinas Perhubungan',                     'Pemprov DKI', 14),
  ('P-BPD',   'Pemprov DKI – Bappeda',                               'Pemprov DKI', 15)
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- WORK CALENDAR — Libur Nasional 2026-2027
-- Tanggal (est.) = estimasi, wajib diverifikasi sebelum produksi
-- =============================================
INSERT INTO public.work_calendar (holiday_date, name) VALUES
  -- 2026
  ('2026-01-01', 'Tahun Baru Masehi 2026'),
  ('2026-01-29', 'Tahun Baru Imlek 2577 Kong Zi'),
  ('2026-02-18', 'Isra Mikraj Nabi Muhammad SAW 1447 H'),
  ('2026-03-22', 'Hari Suci Nyepi – Tahun Baru Saka 1948'),
  ('2026-04-03', 'Wafat Isa Al Masih'),
  ('2026-04-20', 'Cuti Bersama Idul Fitri 1447 H'),
  ('2026-04-21', 'Hari Raya Idul Fitri 1447 H'),
  ('2026-04-22', 'Hari Raya Idul Fitri 1447 H Hari ke-2'),
  ('2026-04-23', 'Cuti Bersama Idul Fitri 1447 H'),
  ('2026-04-24', 'Cuti Bersama Idul Fitri 1447 H'),
  ('2026-05-14', 'Kenaikan Yesus Kristus'),
  ('2026-05-23', 'Hari Raya Waisak 2570 BE'),
  ('2026-06-06', 'Hari Raya Idul Adha 1447 H'),
  ('2026-06-26', 'Tahun Baru Islam 1448 H'),
  ('2026-08-17', 'Hari Kemerdekaan Republik Indonesia'),
  ('2026-09-04', 'Maulid Nabi Muhammad SAW 1448 H'),
  ('2026-12-25', 'Hari Raya Natal'),
  ('2026-12-26', 'Cuti Bersama Natal'),
  -- 2027
  ('2027-01-01', 'Tahun Baru Masehi 2027'),
  ('2027-01-17', 'Tahun Baru Imlek 2578 Kong Zi'),
  ('2027-02-07', 'Isra Mikraj Nabi Muhammad SAW 1448 H'),
  ('2027-03-11', 'Hari Suci Nyepi – Tahun Baru Saka 1949'),
  ('2027-03-26', 'Wafat Isa Al Masih'),
  ('2027-04-10', 'Hari Raya Idul Fitri 1448 H'),
  ('2027-04-11', 'Hari Raya Idul Fitri 1448 H Hari ke-2'),
  ('2027-05-03', 'Kenaikan Yesus Kristus'),
  ('2027-05-12', 'Hari Raya Waisak 2571 BE'),
  ('2027-05-27', 'Hari Raya Idul Adha 1448 H'),
  ('2027-06-15', 'Tahun Baru Islam 1449 H'),
  ('2027-08-17', 'Hari Kemerdekaan Republik Indonesia'),
  ('2027-08-24', 'Maulid Nabi Muhammad SAW 1449 H'),
  ('2027-12-25', 'Hari Raya Natal'),
  ('2027-12-26', 'Cuti Bersama Natal')
ON CONFLICT (holiday_date) DO NOTHING;
