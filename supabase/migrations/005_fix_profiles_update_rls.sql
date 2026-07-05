-- 005_fix_profiles_update_rls.sql
--
-- Fixes a real bug found live during Week 12 Task 14's E2E pass: "profiles_update" (defined in
-- 002_rls_policies.sql) only specified a USING clause, with no explicit WITH CHECK. Every other
-- writable table's policy in 002_rls_policies.sql explicitly duplicates USING into WITH CHECK;
-- profiles_update was the one exception. In practice (verified live against this project's
-- Supabase Postgres instance), that omission caused every UPDATE on profiles performed via the
-- anon-key/session-scoped client to be rejected with `42501 new row violates row-level security
-- policy for table "profiles"`, even for a fully-authorized actor+target pair (get_my_role()
-- independently confirmed to return the correct role for the same session). This silently broke
-- both the Users page's "Nonaktifkan"/"Aktifkan" toggle (DELETE and PATCH /api/users/[id]) --
-- worked around in application code for now by routing those two writes through the service-role
-- admin client instead (see app/api/users/[id]/route.ts), since authorization is already fully
-- enforced in application code before either write executes.
--
-- This migration is the proper long-term fix at the RLS layer, restoring profiles_update to the
-- same explicit-USING-and-WITH-CHECK convention used by every other policy in this file. Applying
-- it is not required for the Users page to function (the code-level fix above already covers it)
-- but is recommended so the anon-key client's own INSERT/UPDATE checks are internally consistent,
-- and so any future direct-client profiles write doesn't hit the same silent-looking failure.
--
-- Apply via the Supabase Dashboard SQL Editor (this project's established convention -- see
-- migrations 003/004 and Week 1 Task 7's ledger note; `supabase link` is not available against
-- this project's cloud instance in this environment).

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'super_admin' OR
    (get_my_role() = 'admin' AND role = 'viewer')
  )
  WITH CHECK (
    get_my_role() = 'super_admin' OR
    (get_my_role() = 'admin' AND role = 'viewer')
  );
