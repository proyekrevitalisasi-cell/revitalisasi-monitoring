-- 003_locations_project_start_date.sql
-- locations.project_start_date was always accepted as an input to
-- POST /api/locations (used to seed template activity dates) but never
-- persisted on the row itself. Week 4's CPM engine needs it as the
-- per-location day-0 epoch, so this adds and backfills it.

ALTER TABLE public.locations
  ADD COLUMN project_start_date DATE;

-- Backfill existing locations from their earliest activity's planned start
-- date (best available proxy for the original project_start_date input,
-- which wasn't stored). Locations with no activities are left NULL —
-- lib/cpm-runner.ts treats a NULL project_start_date as "nothing to
-- compute" and no-ops, same as a location with no phases/activities.
UPDATE public.locations
SET project_start_date = (
  SELECT MIN(a.tanggal_mulai_rencana)
  FROM public.activities a
  JOIN public.phases p ON a.phase_id = p.id
  WHERE p.location_id = locations.id
)
WHERE project_start_date IS NULL;
