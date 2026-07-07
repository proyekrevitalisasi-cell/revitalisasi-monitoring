# Minggu 15 — Staging — Design

**PRD milestone:** Minggu 15 = "Staging — Deploy Vercel staging, UAT dengan stakeholder internal Perumnas."

**Approach:** Infra/coordination week, not a code week. Most steps happen in GitHub/Vercel
dashboards (user-executed, since the agent has no credentials or browser access to those
services). The agent's job: prepare the repo for push, give exact step-by-step Vercel setup
instructions, verify the resulting live deployment once it exists, and write the UAT scenario
guide stakeholders will actually use. No new features, no schema changes, no new Supabase project.

---

## 1. Repo → GitHub

- User creates an empty repo under the `proyekrevitalisasi-cell` GitHub account — no
  README/license/gitignore from GitHub's template, to avoid history conflicts with this repo's
  existing 14 weeks of commits.
- Agent verifies no secrets are tracked (`.env.local` is gitignored via `.env*.local`; only
  `.env.local.example`, a template with no real values, is tracked — already confirmed clean).
- Agent adds the given URL as `origin`, pushes `master`.

## 2. Vercel setup (guided, manual)

New Vercel account for the user. Agent provides exact steps, pausing for confirmation at each:

1. Sign up at vercel.com using GitHub login (same `proyekrevitalisasi-cell` account).
2. **Add New → Project → Import Git Repository** → select the pushed repo.
3. Framework preset: Next.js (auto-detected, zero config needed — this is a standard Next.js App
   Router project with no custom build steps).
4. Environment variables (values read from the current `.env.local`, same Supabase Cloud project
   used throughout dev — per the user's own call to reuse it for staging):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` — set to the Vercel-assigned `*.vercel.app` URL (known only after first
     deploy attempt; Vercel shows a preview of the assigned domain before deploying, or it can be
     set after the first deploy and redeployed once)
5. Deploy.

## 3. Post-deploy verification

Once the user shares the live URL, agent runs a smoke pass scoped to *what can only break because
it's now on Vercel* (not re-verifying schema/RLS/CPM correctness — unchanged, already verified
across 14 weeks against the same database):

- Build succeeded in Vercel's environment (check the deployment's build log for errors).
- Login works for all 3 seeded roles (`super_admin`/`admin`/`viewer`) against the live URL.
- Middleware/role-gated routes redirect correctly (e.g. Viewer hitting `/users` gets 404, matching
  local behavior).
- One CPM-triggering action works end-to-end on the live URL (e.g. a date edit that shifts a
  dependent activity) — confirms the service-role key and Supabase connectivity work correctly
  from Vercel's serverless environment, not just localhost.
- No `SUPABASE_SERVICE_ROLE_KEY` string appears in any client-side bundle (`view-source` /
  browser devtools Network tab check on a loaded page, or grep the built `.next/static` output if
  accessible) — this is the one thing the PRD's own risk table explicitly calls out as a CI-worthy
  check ("Service role key bocor ke client").
- No new browser console errors on the landing page and one per-location dashboard page.

## 4. UAT guide for stakeholders

Agent writes a short Bahasa Indonesia UAT scenario document, adapted from the PRD's own manual
E2E scenario checklist (PRD section 14: Auth, Dependensi & CPM, Gantt Chart, Risk Register,
Weekly Summary, Workload View) — reworded for a non-technical stakeholder audience: which role to
log in as, what to click, what "correct" looks like. This document is the actual "UAT" deliverable
for this week. The UAT sessions themselves are conducted by Perumnas stakeholders using this
guide, not simulated or automated by the agent.

---

## Out of scope

- No password rotation for seed accounts (per user's call — deferred to Week 16/Production, matching
  the PRD's own checklist item).
- No new/separate Supabase project — staging reuses the existing dev Cloud project as-is,
  including its current `TA`/`KK`/`KL`/`KMY` location data and the shared `E2ESH` test fixture.
- No custom domain — default `*.vercel.app` staging URL is sufficient for internal UAT.
- No CI/CD pipeline changes, no GitHub Actions — Vercel's own GitHub integration (auto-deploy on
  push) is the only automation this week.
- Actual UAT feedback collection/triage is not this week's scope — that starts once stakeholders
  begin using the guide; feedback intake would be a natural Week 16 input, not built now.

## Testing

No new automated tests this week (no code changed). Verification is the Section 3 live-smoke pass,
manual and one-time, not a committed test suite addition.
