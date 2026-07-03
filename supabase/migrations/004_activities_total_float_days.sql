-- 004_activities_total_float_days.sql
-- CPM (lib/cpm.ts's CpmNode.totalFloat) computes float in memory on every
-- run but lib/cpm-runner.ts only ever persisted is_on_critical_path,
-- discarding the float value. The Week 6 Gantt tooltip needs the actual
-- number, not just the boolean.

ALTER TABLE public.activities
  ADD COLUMN total_float_days INTEGER NOT NULL DEFAULT 0;
