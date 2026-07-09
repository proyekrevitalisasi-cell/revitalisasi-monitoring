# Minggu 16 — Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended for this plan — see note below) or superpowers:subagent-driven-development to execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on execution mode:** Task 1 is a normal code task, well-suited to a fresh subagent. Tasks 2-3 involve live writes/reads against the shared production Supabase project and manual Vercel dashboard clicks — steps only the controlling session can directly execute or that need per-round user confirmation (per this project's standing rule on mutating writes to the shared DB and on credential rotation). Inline Execution (this session, no subagent handoff) is the sensible default for the whole plan; if Subagent-Driven is chosen anyway, Tasks 2-3 still need the controller to run their commands and relay results.

**Goal:** Fix the one known real bug in the CPM date engine (zero-duration finish-date underflow), repair the data it already corrupted, deploy the app to Vercel's Production environment against the existing Supabase Cloud project, and leave two handover documents for Perumnas and for whoever maintains this next.

**Architecture:** One small, self-contained code fix with a regression test (Task 1). One live data-repair action that depends on Task 1's fix already being deployed to whichever environment runs it (Task 2). One deployment-and-checklist task, no new code (Task 3). Two new documentation files (Task 4).

**Tech Stack:** Vitest (existing), Vercel (existing project, promote to Production), Supabase Cloud (existing project, no migration).

## Global Constraints

- No new npm packages, no schema/migration changes.
- Reuse the existing Supabase Cloud project — no new project, no data migration (user's explicit call).
- Default `*.vercel.app` domain — no custom domain (user's explicit call).
- Never paste real secret values (service-role key, anon key, new passwords) into any file that gets committed to git.
- Any mutating write against the shared production DB (Task 2's repair) is read back and verified before being considered done, matching this project's established convention for every prior week's live data operation.
- Password rotation (Task 3) uses passwords supplied by the user at execution time — never invented by the agent, never committed to the repo.

---

### Task 1: Fix `cpmFinishToDate` zero-duration bug

**Files:**
- Modify: `lib/cpm.ts:187-189`
- Modify: `lib/cpm-runner.ts:67`
- Modify: `lib/cpm.test.ts` (2 existing call sites at lines 149 and 160, plus 1 new test)

**Interfaces:**
- Produces: `cpmFinishToDate(earliestStart: number, earliestFinish: number, projectStart: Date, holidays: Date[]): Date` — signature gains a leading `earliestStart` parameter. The only production caller is `lib/cpm-runner.ts`'s `computeActivityCpmUpdate`, which already has `node.earliestStart` in scope (it already calls `cpmStartToDate(node.earliestStart, ...)` on the line directly above).

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('date conversion', ...)` block in `lib/cpm.test.ts` (after the existing `'round-trips with computeDurasiHK...'` test, before the closing `})` of that describe block):

```ts
  it('cpmFinishToDate for a zero-duration (milestone) activity equals its start date', () => {
    const projectStart = new Date('2026-07-01') // Wednesday
    // Milestone activity: earliestStart = earliestFinish = 3 (duration 0, no working days consumed).
    const start = cpmStartToDate(3, projectStart, [])
    const finish = cpmFinishToDate(3, 3, projectStart, [])
    expect(finish).toEqual(start)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run cpm.test.ts`

Expected: FAIL. The current `cpmFinishToDate` only takes `(earliestFinish, projectStart, holidays)` — 3 parameters. The new test calls it with 4 positional arguments `(3, 3, projectStart, [])`, which under the old signature binds as `earliestFinish=3, projectStart=3 (a number, not a Date), holidays=<the real projectStart Date> (not an array)`. This mis-binding makes `addWorkingDays` receive the wrong types and either throw or return a nonsensical date — demonstrating the current function cannot yet do what the fixed 4-argument call needs.

- [ ] **Step 3: Implement the fix**

In `lib/cpm.ts`, replace lines 187-189:

```ts
export function cpmFinishToDate(earliestFinish: number, projectStart: Date, holidays: Date[]): Date {
  return addWorkingDays(projectStart, earliestFinish - 1, holidays)
}
```

with:

```ts
export function cpmFinishToDate(earliestStart: number, earliestFinish: number, projectStart: Date, holidays: Date[]): Date {
  // The "-1" converts a working-day count to a 0-indexed offset, valid only
  // when at least 1 day was consumed (duration >= 1, so earliestFinish >
  // earliestStart). For a zero-duration milestone, earliestFinish equals
  // earliestStart, and the plain "-1" would land one working day BEFORE the
  // start date. Clamping to earliestStart makes a milestone's finish date
  // equal its start date instead.
  return addWorkingDays(projectStart, Math.max(earliestFinish - 1, earliestStart), holidays)
}
```

In `lib/cpm-runner.ts`, replace line 67:

```ts
    selesai = format(cpmFinishToDate(node.earliestFinish, projectStart, holidays), 'yyyy-MM-dd')
```

with:

```ts
    selesai = format(cpmFinishToDate(node.earliestStart, node.earliestFinish, projectStart, holidays), 'yyyy-MM-dd')
```

In `lib/cpm.test.ts`, update the 2 pre-existing call sites to the new 4-argument signature:

Line 149 (inside `'cpmFinishToDate for a 5-day activity starting at day 0 lands 4 working days later'`), change:
```ts
    const result = cpmFinishToDate(5, projectStart, [])
```
to:
```ts
    const result = cpmFinishToDate(0, 5, projectStart, [])
```

Line 160 (inside `'round-trips with computeDurasiHK...'`), change:
```ts
    const reconstructedSelesai = cpmFinishToDate(duration, projectStart, [])
```
to:
```ts
    const reconstructedSelesai = cpmFinishToDate(0, duration, projectStart, [])
```

(Both pre-existing tests use `mulai = projectStart` itself, i.e. `earliestStart = 0` — unchanged behavior, just made explicit per the new signature.)

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npm test -- --run`

Expected: `Test Files  8 passed (8)`, `Tests  100 passed (100)` (99 existing + 1 new).

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`

Expected: both clean (no new errors).

- [ ] **Step 6: Commit**

```bash
git add lib/cpm.ts lib/cpm-runner.ts lib/cpm.test.ts
git commit -m "fix: cpmFinishToDate returns a date before start for zero-duration activities"
```

---

### Task 2: Repair E2ESH's corrupted activities

**Files:** None (live data operation against the Supabase Cloud project via the running app's own API, same pattern as every prior week's controller-executed data task — e.g. Minggu 15's `createLocationWithTemplate`-mirroring script, Minggu 14's `T14BENCH` cleanup).

**Interfaces:** Consumes Task 1's deployed fix — must run against a server that has Task 1's code (local dev server after Task 1's commit, or Vercel once Task 3 deploys it; either environment reads/writes the same Supabase Cloud project, so it does not matter which one issues the request as long as Task 1's fix is live wherever it runs).

**Before running:** confirm with the user which environment to run this against (local dev server vs. already-promoted Vercel production) and that using the authenticated admin session (not the service-role key) is fine — matching this project's standing rule that mutating writes to the shared DB need an explicit per-round confirmation of the exact mechanism, not just the goal.

- [ ] **Step 1: Start local dev server with Task 1's fix (if running locally)**

```bash
npm run dev
```

- [ ] **Step 2: Log in as admin and find E2ESH's location id**

```bash
curl -s -c /tmp/w16-cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@perumnas.co.id","password":"<current-password>"}'

curl -s -b /tmp/w16-cookies-admin.txt http://localhost:3000/api/locations | grep -o '"code":"E2ESH"[^}]*"id":"[^"]*"\|"id":"[^"]*"[^}]*"code":"E2ESH"'
```

Read the `id` field for the location whose `code` is `E2ESH` from the full JSON response if the grep above doesn't cleanly extract it — the response is `{ data: Location[], error: null }`.

- [ ] **Step 3: Trigger recalculate**

```bash
curl -s -b /tmp/w16-cookies-admin.txt -X POST http://localhost:3000/api/locations/<E2ESH-id>/recalculate
```

Expected: `{"data":{...},"error":null}` with a non-zero `shiftedCount` (the 17 corrupted activities' dates are expected to change).

- [ ] **Step 4: Verify no activity has mulai > selesai**

```bash
curl -s -b /tmp/w16-cookies-admin.txt http://localhost:3000/api/locations/<E2ESH-id>/phases
```

For each phase, `GET /api/phases/<phase-id>/activities` (or whatever the activities-under-phase endpoint returns in the phases response's embed — check the actual response shape) and confirm every activity's `tanggal_mulai_rencana <= tanggal_selesai_rencana`. Zero violations expected.

- [ ] **Step 5: Record result**

Add a note to `.superpowers/sdd/progress.md` under a new `## Week 16` heading: which environment this ran against, the `shiftedCount` returned, and confirmation that the mulai/selesai check found zero violations. No code commit (no code changed).

---

### Task 3: Deploy production

**Files:** None (Vercel dashboard + verification commands, same pattern as Minggu 15 Task 2-3).

**Interfaces:** Consumes Task 1's commit (must be pushed and deployed before the Go-Live checklist's CPM-related items are meaningful) and Task 2's repaired E2ESH data (not itself a production-blocking dependency, but should be done first so the checklist doesn't have to account for known-bad data).

Work through the PRD's own Go-Live checklist (`PRD_Dashboard_Revitalisasi_Perumnas_v2.md`, §16 "Checklist Go-Live"). Present each step to the user one at a time where it requires their action (dashboard clicks, new passwords), waiting for confirmation before moving on:

- [ ] **Step 1: Push Task 1's commit**

```bash
git push origin master
```

Vercel's existing GitHub integration auto-deploys this to the current (staging) deployment.

- [ ] **Step 2: Run the full local verification suite**

```bash
npm test -- --run
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all clean (100/100 tests, no type/lint errors, build succeeds — same bar as every prior week's final task).

- [ ] **Step 3: Full local Playwright E2E run**

Per the established convention (documented in `tests/e2e/README.md` since Minggu 13): one spec file per command, `--project=setup` fresh before each file — not a single combined `npm run test:e2e` (unreliable across multiple files/sessions per Minggu 13's finding). Run each file under `tests/e2e/*.spec.ts` this way and confirm all pass.

- [ ] **Step 4: Confirm migration state is clean**

```bash
npx supabase migration list
```

Expected: no pending/unapplied migrations against the linked project (005 already applied per Minggu 14's ledger).

- [ ] **Step 5: Verify RLS is active on every table**

Tell the user: open Supabase Dashboard → Authentication → Policies for this project, confirm every one of the 13 tables listed in the PRD's schema section has RLS enabled with policies present (spot-check against the migration files under `supabase/migrations/` for the expected policy names). Wait for confirmation.

- [ ] **Step 6: Rotate default seed passwords**

Tell the user: this changes the real login credentials for `superadmin@perumnas.co.id`, `admin@perumnas.co.id`, and `viewer@perumnas.co.id` — currently the PRD's published defaults. Ask the user for the 3 new passwords (or confirm they'll set them directly via Supabase Dashboard → Authentication → Users → select user → "Send password recovery" or "Update password"). Do not invent passwords. Do not write real password values into any committed file — the handover doc (Task 4) references where to find them (e.g. a password manager entry the user maintains), not the values themselves.

- [ ] **Step 7: Promote to Production**

Tell the user: in the Vercel dashboard, go to the project → **Deployments**, find the latest (post Task 1 push) deployment, use **⋯ → Promote to Production** (or, if the project's Production environment was never explicitly separated from the auto-deployed branch, confirm the `master` branch is already mapped to Production in **Settings → Git** — either way the end state is: the latest deployment serves as this project's Production environment on the existing `*.vercel.app` domain). Wait for confirmation.

- [ ] **Step 8: Login smoke test with the NEW passwords**

```bash
curl -s -c /tmp/w16-cookies-prod-admin.txt -X POST https://<production-url>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@perumnas.co.id","password":"<new-password-from-step-6>"}'
```

Expected: `{"data":{...,"role":"admin"},"error":null}`. Repeat for super_admin and viewer.

- [ ] **Step 9: CPM recalculate smoke test in production**

Same shape as Minggu 15 Task 3 Step 4 — PATCH a harmless field (`catatan`) on one real activity via the production URL, confirm the response's `cpm` field is present (not erroring), then revert the value back.

- [ ] **Step 10: Confirm service-role key not exposed client-side**

```bash
curl -s https://<production-url>/login | grep -c "SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `0`.

- [ ] **Step 11: Confirm production URL reachable**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<production-url>/login
```

Expected: `200`. Share this URL with Perumnas stakeholders as the one they use going forward (same URL as staging, now promoted).

- [ ] **Step 12: Record the completed checklist**

Add to the `## Week 16` section of `.superpowers/sdd/progress.md`: production URL, confirmation of all 12 steps above, and explicitly note the 3 seed passwords were rotated (not what they are).

No code commit for this task (Step 1 pushes Task 1's already-committed fix; nothing else here changes tracked files).

---

### Task 4: Handover documentation

**Files:**
- Create: `docs/panduan-pengguna-perumnas.md`
- Create: `docs/runbook-teknis.md`

**Interfaces:** None — standalone reference documents.

- [ ] **Step 1: Write the Perumnas user guide**

Create `docs/panduan-pengguna-perumnas.md` in Bahasa Indonesia, non-technical, structured as an ongoing reference (not a one-time test script like `docs/uat-guide-minggu15.md`):

```markdown
# Panduan Pengguna — Dashboard Revitalisasi Rusun Perumnas

**URL Aplikasi:** <isi dari Task 3 Step 11>

## Peran Pengguna

| Peran | Bisa Apa |
|-------|----------|
| Viewer | Lihat semua data (kegiatan, Gantt, risiko, RACI, pelaporan) di semua lokasi. Tidak bisa mengubah apa pun. |
| Admin | Semua hak Viewer, ditambah: tambah/ubah/hapus kegiatan & dependensi, kelola risiko, isi RACI & pelaporan, kelola Kalender Kerja. |
| Super Admin | Semua hak Admin, ditambah: kelola akun pengguna & lokasi, lihat Audit Log. |

## Login

Buka URL aplikasi, masukkan email dan password yang diberikan admin sistem. Lupa password: hubungi Super Admin untuk direset lewat Supabase Dashboard (belum ada fitur lupa-password mandiri di versi ini).

## Kegiatan & Jadwal (per Lokasi)

- Pilih lokasi dari halaman utama, lalu pilih tab Fase (F1-F4).
- Tombol **+ Tambah Kegiatan** menambah baris baru. Setiap kolom (nama, tanggal, PIC, progress) tersimpan otomatis saat diubah (autosave).
- Ikon gembok mengunci tanggal kegiatan — kegiatan terkunci tidak ikut bergeser walau kegiatan lain sebelumnya berubah jadwal.
- Ikon "Dep" membuka panel dependensi — atur kegiatan mana yang harus selesai/mulai dulu sebelum kegiatan ini.

## Timeline (Gantt)

- 3 lapis bar: abu-abu (baseline/rencana awal), biru (rencana terkini), hijau/kuning (realisasi).
- Kegiatan pada jalur kritis (tidak punya waktu longgar) ditandai merah.
- Klik "Kelola Baseline" untuk menyimpan snapshot rencana saat ini sebagai pembanding.

## Risiko

- Halaman Risiko per lokasi: tambah risiko dengan Probabilitas (1-5) dan Dampak (1-5) — Skor terhitung otomatis, muncul di Risk Matrix (hijau/kuning/merah).

## RACI & Pelaporan

- Halaman RACI (global, semua lokasi): matriks tanggung jawab per fase x pemangku kepentingan.
- Halaman Pelaporan (global): daftar rencana pelaporan proyek, dapat diubah Admin.

## Ringkasan Mingguan

- Per lokasi, tombol "Salin ke Clipboard" menyalin ringkasan siap-tempel untuk WhatsApp/email.

## Users & Lokasi, Audit Log (Super Admin saja)

- "Users & Lokasi": tambah/nonaktifkan pengguna, kelola daftar lokasi.
- "Audit Log": riwayat semua perubahan data, siapa mengubah apa dan kapan, dengan detail sebelum/sesudah.

## Masalah Umum

- Halaman kosong/error setelah login → coba refresh; jika berulang, hubungi maintainer teknis (lihat `runbook-teknis.md`).
- Tanggal kegiatan tidak berubah walau dependensi diubah → cek apakah kegiatan tersebut dikunci (ikon gembok).
```

- [ ] **Step 2: Write the technical runbook**

Create `docs/runbook-teknis.md`:

```markdown
# Runbook Teknis — Dashboard Revitalisasi Rusun Perumnas

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (PostgreSQL + Auth) · Vercel · Vitest (unit) · Playwright (E2E).

## Struktur Proyek

- `app/` — routes (App Router: pages + `api/` route handlers)
- `lib/` — logika murni & DB-aware helpers (`cpm.ts`/`cpm-runner.ts` = penjadwalan CPM, `calendar.ts` = hari kerja, `templates.ts` = template lokasi baru, `rbac.ts`/`auth.ts` = otorisasi)
- `components/` — komponen UI
- `supabase/migrations/` — skema DB, sumber kebenaran tunggal untuk struktur tabel & RLS
- `tests/e2e/` — Playwright, lihat `tests/e2e/README.md` untuk cara jalanin (1 file per command, bukan gabungan)
- `docs/superpowers/specs/` dan `docs/superpowers/plans/` — riwayat desain & rencana implementasi tiap minggu (16 minggu), referensi historis lengkap kalau perlu tahu kenapa sesuatu dibangun dengan cara tertentu.

## Deploy

- **Vercel:** auto-deploy dari branch `master` (GitHub integration). Env vars (Project Settings → Environment Variables): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only — JANGAN pernah prefix `NEXT_PUBLIC_`), `NEXT_PUBLIC_APP_URL`.
- **Supabase:** satu project Cloud dipakai sejak Minggu 1 sampai production (staging dan production adalah project yang sama — keputusan sadar, bukan default). Migrasi baru: `supabase migration new <nama>`, tulis SQL, `supabase db push` (butuh project linked — `supabase link`).
- **Lokal:** `npm install && npm run dev`, `.env.local` sudah arahkan ke Supabase Cloud yang sama (bukan Docker lokal) — lihat `.env.local.example` untuk daftar variabel.

## Database

13 tabel utama: `locations`, `phases`, `activities`, `activity_dependencies`, `work_calendar`, `baselines`, `baseline_activities`, `risk_items`, `raci_entries`, `stakeholders`, `reporting_items`, `audit_logs`, `profiles`, `kk_consent`. Semua tabel punya RLS aktif. Sebagian besar penulisan lewat session-client (RLS-respecting); `profiles` dan operasi admin-user lewat service-role client (`createAdminClient`) karena `profiles_update`'s RLS policy historically tidak bisa diandalkan untuk write lintas-user meski actor authorized — lihat catatan Minggu 12.

## CPM (Penjadwalan)

`lib/cpm.ts` = algoritma murni (forward/backward pass, deteksi siklus). `lib/cpm-runner.ts` = wrapper yang baca dari & tulis ke Supabase. Dipicu dari 8+ endpoint (lihat `cpm-runner.ts`'s `runCpmForLocation`/`runCpmForAllActiveLocations`). Setiap kegiatan yang tidak dikunci (`date_locked=false`) tanggalnya dihitung ulang otomatis dari `earliestStart`/`earliestFinish` (offset hari kerja dari `project_start_date` lokasi) via `cpmStartToDate`/`cpmFinishToDate`.

## Item yang Sudah Diketahui, Sengaja Belum Diperbaiki

- **PATCH `/api/activities/[id]` bypass oleh CPM writer:** rute PATCH memvalidasi urutan tanggal (`mulai <= selesai`) saat pengguna mengedit manual, tapi `cpm-runner.ts`'s langsung `.update()` ke tabel `activities` TIDAK lewat validasi yang sama. Selama CPM sendiri tidak pernah menghasilkan tanggal terbalik (dijamin sejak perbaikan Minggu 16 untuk kasus durasi-nol), ini tidak ter-trigger — tapi kalau ada bug lain di CPM di masa depan yang menghasilkan tanggal terbalik, itu akan tertulis ke DB tanpa penolakan, dan begitu tertulis, PATCH manual berikutnya ke kegiatan itu juga akan ditolak (validasi PATCH selalu re-cek tanggal tersimpan sebagai bagian dari perbandingan). Perbaikan yang masuk akal: tambahkan validasi yang sama di `cpm-runner.ts` sebelum `.update()`.
- **`tests/e2e/kk-consent.spec.ts` tidak punya kasus uji jalur revert-on-failed-save** — inilah sebabnya bug `KkConsentForm`'s `defaultValue` (Minggu 14) sempat lolos sampai verifikasi manual. Rekomendasi: tambah test dengan `context.setOffline(true)`.
- **Gantt arrow hit-target tidak punya focus-ring visual** untuk pengguna keyboard yang bisa melihat (Minggu 14) — di luar scope task yang mengerjakannya waktu itu (hanya diminta menggerakkan tooltip lewat fokus, bukan gaya fokusnya).

## Riwayat

Setiap minggu pengembangan (1-16) punya spec (`docs/superpowers/specs/`) dan plan (`docs/superpowers/plans/`) sendiri, plus catatan ringkas di memory project. `.superpowers/sdd/progress.md` punya ledger detail per-task untuk minggu-minggu yang dieksekusi lewat subagent-driven-development.
```

- [ ] **Step 3: Commit**

```bash
git add docs/panduan-pengguna-perumnas.md docs/runbook-teknis.md
git commit -m "docs: add Week 16 handover documentation (user guide + technical runbook)"
```

---

## Self-Review Notes

- **Spec coverage:** Spec Section 1 (fix `cpmFinishToDate`) → Task 1. Section 2 (repair E2ESH) → Task 2. Section 3 (deploy production, PRD Go-Live checklist incl. password rotation) → Task 3. Section 4 (handover docs) → Task 4. All 4 spec sections covered.
- **Placeholder scan:** remaining bracketed values (`<E2ESH-id>`, `<production-url>`, `<current-password>`, `<new-password-from-step-6>`) are runtime-only values unknowable until a prior step resolves them (a DB-assigned id, a Vercel-assigned/promoted URL, credentials that live in the user's password manager, not in any file) — same pattern as Minggu 15's plan, not vague requirements.
- **Type consistency:** `cpmFinishToDate`'s new signature `(earliestStart, earliestFinish, projectStart, holidays)` is used identically in Task 1's implementation, its `cpm-runner.ts` caller, and both updated test call sites — no mismatch.
