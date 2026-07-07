# Minggu 15 — Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended for this plan — see note below) or superpowers:subagent-driven-development to execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on execution mode:** unlike prior weeks' plans, most of this plan's steps require a live human (GitHub repo creation, Vercel dashboard clicks) that only the controlling session has direct access to. Dispatching a fresh subagent per task would just re-block on the same human input the controller already has — Inline Execution (same session, no subagent handoff) is the sensible choice here, but either works.

**Goal:** Get the app deployed to a live Vercel staging URL, reusing the existing dev Supabase Cloud project, verified working, with a UAT guide ready for Perumnas stakeholders.

**Architecture:** No code changes. This is a repo-hosting + deployment-platform setup sequence: push to GitHub, connect Vercel (guided, since the user has no existing Vercel account), verify the live deployment with a scoped smoke pass, write one new documentation file (the UAT guide).

**Tech Stack:** Git, GitHub, Vercel (zero-config Next.js deploy — confirmed `next.config.js` has no custom settings, no `vercel.json` needed).

## Global Constraints

- No new npm packages, no schema/migration changes, no code changes to `app/`, `components/`, or `lib/`.
- Staging reuses the existing dev Supabase Cloud project as-is (no new Supabase project, no re-seeding).
- No password rotation for seed accounts this week (deferred to Week 16/Production).
- Never paste real secret values (`SUPABASE_SERVICE_ROLE_KEY`, anon key) into any file that gets committed to git — every step below that needs a secret value says "read from your local `.env.local`", not "here is the value."
- Default `*.vercel.app` domain — no custom domain this week.

---

### Task 1: Push to GitHub

**Files:** None created/modified (this task only adds a git remote and pushes existing history).

**Interfaces:** None.

- [ ] **Step 1: Confirm no secrets are tracked**

```bash
git ls-files | grep -i "\.env"
```

Expected: only `.env.local.example` (the template, no real values) — already confirmed. If anything else appears, STOP and investigate before pushing; do not proceed.

- [ ] **Step 2: Get the empty repo URL from the user**

The user creates an empty repository under the `proyekrevitalisasi-cell` GitHub account — no README, no `.gitignore`, no license template (to avoid a conflicting initial commit). Ask them for the repo URL (e.g. `https://github.com/proyekrevitalisasi-cell/revitalisasi-monitoring.git` or the SSH form `git@github.com:proyekrevitalisasi-cell/revitalisasi-monitoring.git`) before proceeding — do not guess a URL.

- [ ] **Step 3: Add the remote and push**

```bash
git remote add origin <URL-FROM-USER>
git push -u origin master
```

Expected: push succeeds, all ~200+ commits transferred. If it fails with a permission/auth error, the local SSH key (`~/.ssh/id_rsa.pub`) or an HTTPS credential needs to be added to the `proyekrevitalisasi-cell` account first — ask the user to add the displayed public key under that account's Settings → SSH and GPG keys, or to switch to an HTTPS remote with a personal access token, then retry.

- [ ] **Step 4: Verify**

```bash
git log --oneline -3
git remote -v
```

Confirm `origin` points at the new URL and the push included the latest local commit.

No code commit for this task — it only establishes the remote.

---

### Task 2: Guided Vercel project setup

**Files:** None created/modified (all steps happen in the Vercel dashboard).

**Interfaces:** None.

Present these steps to the user one at a time, waiting for confirmation before moving to the next — do not assume any step succeeded without the user confirming it:

- [ ] **Step 1: Vercel signup**

Tell the user: go to vercel.com, sign up using "Continue with GitHub", authorize with the `proyekrevitalisasi-cell` account. Wait for confirmation this is done.

- [ ] **Step 2: Import the repository**

Tell the user: in the Vercel dashboard, click **Add New → Project**, find the just-pushed repo under **Import Git Repository**, click **Import**. Vercel auto-detects Next.js — no framework settings need changing (confirmed: `next.config.js` has no custom build/output settings, root `package.json` has standard `build`/`start` scripts). Wait for confirmation.

- [ ] **Step 3: Set environment variables**

Before clicking Deploy, tell the user to expand **Environment Variables** and add these 4, reading each value from their own local `.env.local` file (never share these values in chat or paste them into any committed file):

| Key | Where to get the value |
|-----|------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same value as in local `.env.local` — same Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same value as in local `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Same value as in local `.env.local` — **server-side only, this is why the 4-variable checklist exists: confirm in Task 3 that this key never appears in a client bundle** |
| `NEXT_PUBLIC_APP_URL` | Leave blank for now — Vercel assigns the URL on first deploy; the user fills this in and redeploys once after Step 4. Note: grepped the codebase and confirmed `NEXT_PUBLIC_APP_URL` is not actually read by any file under `app/`, `lib/`, or `middleware.ts` — it's only consumed by `playwright.config.ts` for local E2E test config, which doesn't run in the deployed app. Setting it is for consistency with the PRD's documented env var table, not because production code depends on it. |

Wait for confirmation all 4 are entered.

- [ ] **Step 4: Deploy**

Tell the user to click **Deploy**. Wait for the build to finish (a few minutes) and for them to share the resulting live URL and the build log status (success/fail).

- [ ] **Step 5: Set `NEXT_PUBLIC_APP_URL` and redeploy**

Once the live URL is known, tell the user to go to the project's **Settings → Environment Variables**, edit `NEXT_PUBLIC_APP_URL` to the actual assigned URL (e.g. `https://revitalisasi-monitoring.vercel.app`), then trigger a redeploy (**Deployments** tab → the latest deployment's **⋯** menu → **Redeploy**). Wait for confirmation this redeploy also succeeds.

No code commit for this task.

---

### Task 3: Post-deploy smoke verification

**Files:** None modified — read-only verification against the live URL.

**Interfaces:** Consumes the live URL from Task 2 Step 4/5.

- [ ] **Step 1: Confirm the build succeeded and the app loads**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<live-url>/login
```

Expected: `200`.

- [ ] **Step 2: Login smoke test for all 3 seeded roles**

For each of `superadmin@perumnas.co.id`/`SuperAdmin123!`, `admin@perumnas.co.id`/`Admin123!`, `viewer@perumnas.co.id`/`Viewer123!`:

```bash
curl -s -c /tmp/w15-cookies-<role>.txt -X POST https://<live-url>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<email>","password":"<password>"}'
```

Expected per call: `{"data":{"id":"...","email":"...","role":"..."},"error":null}` with the correct role in the response.

- [ ] **Step 3: Confirm role-gated route behavior matches local**

As the Viewer session:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -b /tmp/w15-cookies-viewer.txt https://<live-url>/users
```

Expected: `404` (whole-page admin/SA-only gate, same as verified locally since Week 12).

- [ ] **Step 4: Confirm a CPM-triggering write works end-to-end on the live URL**

This is the one check that specifically validates the service-role client and Supabase connectivity work correctly from Vercel's serverless environment (not just localhost). As the admin session, pick any existing activity on a real location (e.g. query `GET /api/locations`, find one via `TA`/`KK`/`KL`/`KMY`, then `GET /api/locations/{id}/phases` to find an activity id) and PATCH its `catatan` field (a harmless no-schedule-impact field, so this doesn't disturb real data):

```bash
curl -s -b /tmp/w15-cookies-admin.txt -X PATCH https://<live-url>/api/activities/<activity-id> \
  -H "Content-Type: application/json" \
  -d '{"catatan":"staging smoke test - verified 2026-07-07"}'
```

Expected: `{"data":{"activity":{...},"cpm":null},"error":null}` (no CPM shift expected from a `catatan`-only change, matching the app's own existing behavior — confirmed by Week 2's ledger note "GET returns created_at, POST/PATCH don't" convention and the standard `{activity, cpm}` response shape from Week 5). Revert the `catatan` value back to its original afterward (re-PATCH with the original value, which you read before this step) so no real data is left altered.

- [ ] **Step 5: Confirm the service-role key is not exposed client-side**

```bash
curl -s https://<live-url>/login | grep -c "SUPABASE_SERVICE_ROLE_KEY\|<the actual service role key value>"
```

Expected: `0`. Next.js only inlines `NEXT_PUBLIC_`-prefixed env vars into client bundles, and `SUPABASE_SERVICE_ROLE_KEY` is not so prefixed — this check confirms that convention held on the actual deployed build, not just in local source review.

- [ ] **Step 6: Browser console check**

Open the live URL in a real browser (or headless Chromium via Playwright, same pattern as every prior week's manual verification), log in as admin, visit the landing page and one per-location dashboard page. Confirm zero unexpected console errors.

- [ ] **Step 7: Record results**

Add a `## Week 15` entry to `.superpowers/sdd/progress.md` summarizing: GitHub repo URL, Vercel project URL, all 6 smoke-check results, and any issues found/fixed.

No code commit unless Step 2-6 reveals a real bug (in which case: fix it, re-verify, commit normally, and note the deviation in the ledger — matching this project's established convention from every prior week's final verification task).

---

### Task 4: UAT guide for stakeholders

**Files:**
- Create: `docs/uat-guide-minggu15.md`

**Interfaces:** None — this is a standalone reference document.

- [ ] **Step 1: Write the UAT guide**

Create `docs/uat-guide-minggu15.md` in Bahasa Indonesia, adapted from the PRD's own manual E2E scenario checklist (`PRD_Dashboard_Revitalisasi_Perumnas_v2.md`, section 14, "Skenario E2E Manual") but reworded for a non-technical stakeholder audience — plain task instructions, not developer checklist language. Structure:

```markdown
# Panduan UAT — Dashboard Revitalisasi Rusun Perumnas (Staging)

**URL Staging:** <isi setelah deploy — dari Task 2>

**Akun untuk testing:**
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@perumnas.co.id | SuperAdmin123! |
| Admin | admin@perumnas.co.id | Admin123! |
| Viewer | viewer@perumnas.co.id | Viewer123! |

---

## 1. Login & Akses

- [ ] Login sebagai Viewer → pastikan tidak ada tombol edit di mana pun, tidak ada menu Users/Audit Log di sidebar
- [ ] Login sebagai Admin → pastikan semua fitur edit (tambah/ubah/hapus kegiatan, dsb) terbuka
- [ ] Login sebagai Super Admin → pastikan menu "Users & Lokasi" dan "Audit Log" muncul di sidebar

## 2. Kegiatan & Dependensi

- [ ] Buka salah satu lokasi, buka tab Fase 1 → tambah kegiatan baru
- [ ] Klik ikon dependensi (Dep) pada sebuah kegiatan → tambahkan predecessor dari kegiatan lain di Fase yang sama → simpan → cek tanggal kegiatan ini otomatis ikut menyesuaikan
- [ ] Coba buat dependensi yang membentuk siklus (A tergantung B, B tergantung A) → pastikan muncul pesan error dan tidak tersimpan
- [ ] Kunci (klik ikon gembok) tanggal sebuah kegiatan → ubah tanggal kegiatan predecessor-nya → pastikan kegiatan yang dikunci TIDAK ikut bergeser

## 3. Gantt Chart

- [ ] Buka halaman Timeline sebuah lokasi → pastikan muncul 3 lapis bar (baseline abu-abu, rencana biru, realisasi jika ada)
- [ ] Arahkan kursor ke sebuah bar → pastikan muncul tooltip info tanggal
- [ ] Cek kegiatan pada jalur kritis tampil dengan warna merah

## 4. Risk Register

- [ ] Buka halaman Risiko sebuah lokasi → tambah risiko baru dengan Probabilitas dan Dampak tertentu → pastikan Skor otomatis terhitung dan muncul di sel yang benar pada Risk Matrix
- [ ] Klik salah satu sel Risk Matrix → pastikan tabel ter-filter ke risiko-risiko di sel itu saja

## 5. Ringkasan Mingguan

- [ ] Buka halaman Ringkasan Mingguan sebuah lokasi → klik "Salin ke Clipboard" → coba tempel (paste) di WhatsApp atau aplikasi chat lain → pastikan formatnya rapi dan akurat

## 6. Workload View

- [ ] Buka halaman Workload → pastikan heatmap menampilkan semua PIC dan minggu kerja
- [ ] Cek sel yang berwarna merah — pastikan itu memang PIC dengan 4 atau lebih kegiatan aktif di minggu tersebut

---

**Catatan/Masalah yang ditemukan:**

(tulis di sini apa pun yang terasa aneh, salah, atau membingungkan saat testing)
```

- [ ] **Step 2: Fill in the actual staging URL**

Replace `<isi setelah deploy — dari Task 2>` with the real URL confirmed in Task 2/3.

- [ ] **Step 3: Commit**

```bash
git add docs/uat-guide-minggu15.md
git commit -m "docs: add Week 15 UAT guide for Perumnas stakeholders"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (repo → GitHub) → Task 1. Section 2 (guided Vercel setup) → Task 2. Section 3 (post-deploy verification) → Task 3. Section 4 (UAT guide) → Task 4. All 4 spec sections covered.
- **Placeholder scan:** the only bracketed placeholders left (`<URL-FROM-USER>`, `<live-url>`, `<activity-id>`) are genuinely unknowable until the corresponding prior step completes (a GitHub URL the user creates, a Vercel URL Vercel assigns, an activity id read from a live query) — not vague requirements, but values substituted at execution time, consistent with how prior weeks' plans handled runtime-only values (e.g. Week 14's benchmark task's `$LOCATION_ID`).
- **Type consistency:** N/A — no code/functions introduced this week.
