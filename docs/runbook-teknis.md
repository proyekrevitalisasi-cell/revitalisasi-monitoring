# Runbook Teknis — Dashboard Revitalisasi Rusun Perumnas

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (PostgreSQL + Auth) · Vercel · Vitest (unit) · Playwright (E2E).

## Struktur Proyek

- `app/` — routes (App Router: pages + `api/` route handlers)
- `lib/` — logika murni & DB-aware helpers (`cpm.ts`/`cpm-runner.ts` = penjadwalan CPM, `calendar.ts` = hari kerja, `templates.ts` = template lokasi baru, `rbac.ts`/`auth.ts` = otorisasi)
- `components/` — komponen UI
- `supabase/migrations/` — skema DB, sumber kebenaran tunggal untuk struktur tabel & RLS
- `tests/e2e/` — Playwright, lihat `tests/e2e/README.md` untuk cara jalanin (1 file per command, bukan gabungan — jalankan `--project=setup` segar sebelum tiap file)
- `docs/superpowers/specs/` dan `docs/superpowers/plans/` — riwayat desain & rencana implementasi tiap minggu (16 minggu), referensi historis lengkap kalau perlu tahu kenapa sesuatu dibangun dengan cara tertentu.

## Deploy

- **Vercel:** auto-deploy dari branch `master` (GitHub integration). Env vars (Project Settings → Environment Variables): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only — JANGAN pernah prefix `NEXT_PUBLIC_`), `NEXT_PUBLIC_APP_URL`.
- **Supabase:** satu project Cloud dipakai sejak Minggu 1 sampai production (staging dan production adalah project yang sama — keputusan sadar, bukan default). Migrasi baru: `supabase migration new <nama>`, tulis SQL, `supabase db push` (butuh project linked — `supabase link`; proyek ini belum pernah di-link lewat CLI, migrasi 001-005 semua diterapkan manual lewat Supabase Dashboard SQL Editor).
- **Lokal:** `npm install && npm run dev`, `.env.local` sudah arahkan ke Supabase Cloud yang sama (bukan Docker lokal) — lihat `.env.local.example` untuk daftar variabel. **Jangan jalankan `npm run build` sambil `npm run dev` masih hidup di terminal lain** — keduanya berbagi direktori `.next`, dan `build` akan menimpa output `dev` sehingga server dev yang sedang berjalan mendadak 404 di semua asset statisnya (ditemukan saat verifikasi Minggu 16 — bukan bug aplikasi, murni konflik proses lokal). Kalau ini terjadi: matikan semua proses yang masih mendengarkan di port 3000 (`netstat -ano` lalu `taskkill`), hapus `.next`, jalankan `npm run dev` lagi dari awal.

## Database

13 tabel utama: `locations`, `phases`, `activities`, `activity_dependencies`, `work_calendar`, `baselines`, `baseline_activities`, `risk_items`, `raci_entries`, `stakeholders`, `reporting_items`, `audit_logs`, `profiles`, `kk_consent`. Semua tabel punya RLS aktif. Sebagian besar penulisan lewat session-client (RLS-respecting); `profiles` dan operasi admin-user lewat service-role client (`createAdminClient`) karena `profiles_update`'s RLS policy historically tidak bisa diandalkan untuk write lintas-user meski actor authorized — lihat catatan Minggu 12.

## CPM (Penjadwalan)

`lib/cpm.ts` = algoritma murni (forward/backward pass, deteksi siklus). `lib/cpm-runner.ts` = wrapper yang baca dari & tulis ke Supabase. Dipicu dari 8+ endpoint (lihat `cpm-runner.ts`'s `runCpmForLocation`/`runCpmForAllActiveLocations`). Setiap kegiatan yang tidak dikunci (`date_locked=false`) tanggalnya dihitung ulang otomatis dari `earliestStart`/`earliestFinish` (offset hari kerja dari `project_start_date` lokasi) via `cpmStartToDate`/`cpmFinishToDate`.

## Item yang Sudah Diketahui, Sengaja Belum Diperbaiki

- **Password default 3 akun seed belum dirotasi di production** (`superadmin@perumnas.co.id`, `admin@perumnas.co.id`, `viewer@perumnas.co.id` masih pakai password default yang tertulis di PRD). Ini item Go-Live checklist PRD §16 yang sengaja ditunda oleh keputusan user saat Minggu 16 — **harus diselesaikan sebelum stakeholder Perumnas mulai pakai aplikasi secara nyata.** Ganti lewat Supabase Dashboard → Authentication → Users.
- **PATCH `/api/activities/[id]` bypass oleh CPM writer:** rute PATCH memvalidasi urutan tanggal (`mulai <= selesai`) saat pengguna mengedit manual, tapi `cpm-runner.ts`'s langsung `.update()` ke tabel `activities` TIDAK lewat validasi yang sama. Selama CPM sendiri tidak pernah menghasilkan tanggal terbalik (dijamin sejak perbaikan Minggu 16 untuk kasus durasi-nol), ini tidak ter-trigger — tapi kalau ada bug lain di CPM di masa depan yang menghasilkan tanggal terbalik, itu akan tertulis ke DB tanpa penolakan, dan begitu tertulis, PATCH manual berikutnya ke kegiatan itu juga akan ditolak (validasi PATCH selalu re-cek tanggal tersimpan sebagai bagian dari perbandingan). Perbaikan yang masuk akal: tambahkan validasi yang sama di `cpm-runner.ts` sebelum `.update()`.
- **`tests/e2e/kk-consent.spec.ts` tidak punya kasus uji jalur revert-on-failed-save** — inilah sebabnya bug `KkConsentForm`'s `defaultValue` (Minggu 14) sempat lolos sampai verifikasi manual. Rekomendasi: tambah test dengan `context.setOffline(true)`.
- **Gantt arrow hit-target tidak punya focus-ring visual** untuk pengguna keyboard yang bisa melihat (Minggu 14) — di luar scope task yang mengerjakannya waktu itu (hanya diminta menggerakkan tooltip lewat fokus, bukan gaya fokusnya).

## Riwayat

Setiap minggu pengembangan (1-16) punya spec (`docs/superpowers/specs/`) dan plan (`docs/superpowers/plans/`) sendiri, plus catatan ringkas di memory project. `.superpowers/sdd/progress.md` punya ledger detail per-task untuk minggu-minggu yang dieksekusi lewat subagent-driven-development.
