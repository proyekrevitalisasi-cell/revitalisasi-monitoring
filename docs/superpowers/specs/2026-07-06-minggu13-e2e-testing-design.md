# Minggu 13 — E2E Testing (Playwright, semua skenario)

## Tujuan

Sesuai PRD §16 (Estimasi Milestone), Minggu 13 = "Playwright semua skenario, bug fix." Sampai saat ini `playwright` sudah ter-install (`package.json`) tapi belum ada `playwright.config.ts`, belum ada `tests/` dir, belum ada script `test:e2e`. Testing selama Minggu 1-12 dilakukan ad-hoc (curl / manual Playwright headless per task) tapi tidak meninggalkan suite yang bisa dijalankan ulang. Minggu ini membangun suite persisten yang cover seluruh fitur yang sudah dibangun.

## Lingkungan Test

Proyek pakai Supabase Cloud (bukan Docker lokal) — tidak ada project Supabase terpisah untuk test. Suite jalan terhadap project cloud yang sama dengan dev, pakai `.env.local` yang sudah ada dan 3 akun seed (`superadmin@perumnas.co.id`, `admin@perumnas.co.id`, `viewer@perumnas.co.id`).

**Implikasi:** setiap spec WAJIB idempotent — fixture yang dibuat sendiri harus dibersihkan sendiri (afterAll), dan nama/kode entity yang dibuat test harus punya suffix unik (mis. `E2E-<timestamp>`) supaya:
- tidak bentrok kalau suite dijalankan berulang atau paralel
- gampang dibedakan dari data kerja asli
- gampang di-cleanup manual kalau afterAll gagal di tengah jalan

## Konfigurasi Playwright

`playwright.config.ts` di root:
- `baseURL` dari `NEXT_PUBLIC_APP_URL` (default `http://localhost:3000`)
- `webServer`: auto-start `npm run dev`, reuse existing server kalau sudah jalan (`reuseExistingServer: true`) biar bisa dev sambil lihat browser
- browser: chromium saja (konsisten dengan testing manual Minggu 5-12)
- retries: 0 lokal
- project `setup` menjalankan `tests/e2e/auth.setup.ts` sebelum project utama

Script baru di `package.json`: `"test:e2e": "playwright test"`.

## Strategi Auth

`tests/e2e/auth.setup.ts` (Playwright project "setup", `testMatch` khusus file ini) login via form UI sungguhan (bukan API langsung) untuk ketiga role, simpan `storageState` ke `tests/e2e/.auth/{role}.json`. File `.auth/` di-`.gitignore`.

Kenapa bukan Playwright "project per role" biasa (yang menjalankan seluruh test file sekali per role): banyak spec butuh bandingkan behavior 2 role dalam 1 test (mis. "viewer tidak lihat tombol edit, admin lihat") — kalau pakai project-per-role, itu jadi 2x run terpisah yang tidak bisa saling assert dalam 1 test. Sebagai gantinya: 1 project utama, tiap `test.describe` block pasang `test.use({ storageState: authFile('admin') })` di top-level, atau untuk perbandingan dalam 1 test, buka context baru manual: `browser.newContext({ storageState: authFile('viewer') })`.

## Cleanup Data

`tests/e2e/helpers/db-cleanup.ts` — Supabase admin client (service-role key, aman dipakai di sini karena jalan di Node/test-runner, bukan browser bundle) buat hapus row yang dibuat test di `afterAll`, keyed by ID yang dikembalikan saat create. Prioritas: bikin fixture lewat UI/API asli (lebih realistis, ikut nge-test jalur yang sedang diuji), fallback ke direct-DB cuma untuk cleanup, bukan untuk setup.

## Spec Breakdown

Satu file per domain fitur, mapping ke 12 minggu yang sudah dibangun:

| File | Cover |
|------|-------|
| `auth.spec.ts` | Login 3 role, kredensial salah, `is_active=false` diblok, sidebar/menu sesuai role |
| `locations-fase.spec.ts` | CRUD lokasi (admin/SA), tabel fase/aktivitas CRUD+reorder+lock, viewer read-only |
| `dependencies-cpm.spec.ts` | DependencyPanel FS/SS/FF/SF+lag, deteksi siklus, auto-shift CPM, `date_locked` tidak ikut geser |
| `timeline-gantt.spec.ts` | Render Gantt 3-lapis, toggle baseline/panah dependensi, deviation days |
| `baseline-kritis.spec.ts` | Simpan/aktivasi baseline, highlight jalur kritis |
| `dashboard.spec.ts` | Kartu overview per lokasi, `KkConsentSummaryBar` |
| `risks.spec.ts` | CRUD risk, interaksi filter matrix-klik vs filter tabel, score band warna |
| `workload-calendar-summary.spec.ts` | Workload view, Kalender Kerja (whole-page gate admin/SA), Weekly Summary + `weekOffset` |
| `raci-pelaporan.spec.ts` | RACI matrix edit + reorder ▲▼, Pelaporan CRUD |
| `audit-users.spec.ts` | Audit log filter (entity/user/action/tanggal) + modal diff, Users&Lokasi 2-tab, deactivate/reactivate (area RLS-sensitif Minggu 12) + self-protection guard PATCH |
| `kk-consent.spec.ts` | GET semua role bisa lihat, PATCH admin-only, viewer/SA-tanpa-akses ditolak, entry audit log ter-buat |

## Penanganan Bug

Bug ketemu saat E2E → fix dengan pola sama seperti Minggu 1-12 (subagent-driven-development, review per-task). **Pengecualian:** fix apa pun yang menyentuh `createAdminClient()` (bypass RLS) di call site baru atau mengubah authorization guard route — berhenti dulu, minta approval eksplisit user sebelum dispatch subagent commit. Ini aturan berdiri sejak Minggu 12 (lihat catatan Minggu 12 di [[project_revitalisasi]]), classifier auto-mode akan block commit itu regardless, jadi harus direncanakan di depan bukan dicoba dulu.

## Eksekusi

subagent-driven-development: 1 task setup (config+auth.setup.ts+cleanup helper) + 1 task per spec file (11 file) + 1 task final full-suite run + 1 whole-branch review. Total ~13-14 task, sama skala dengan minggu-minggu sebelumnya.

## Di Luar Scope

- Perf/load testing, edge-case UI polish menyeluruh → Minggu 14 (QA & Polish)
- CI pipeline (GitHub Actions dll) buat auto-run suite tiap push → tidak diminta PRD, tidak dikerjakan minggu ini
- Migrasi 005 (`WITH CHECK` proper untuk `profiles_update`, di-queue sejak Minggu 12) → di luar scope minggu ini kecuali E2E nemuin itu jadi blocker baru
