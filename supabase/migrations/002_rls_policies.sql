-- 002_rls_policies.sql

-- Helper: ambil role user yang sedang login
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;

-- =============================================
-- profiles — aturan khusus
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (is_active = TRUE);

CREATE POLICY "profiles_insert_sa" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_admin');

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
-- audit_logs — INSERT hanya dari service_role
-- =============================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','super_admin'));

CREATE POLICY "audit_insert_service" ON public.audit_logs
  FOR INSERT TO service_role WITH CHECK (TRUE);
