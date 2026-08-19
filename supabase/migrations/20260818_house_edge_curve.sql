-- Starblast house-edge curve metadata defaults.
-- The live browser curve in this build is 90% < 2.00x, 8% 2.00-2.50x, 2% > 2.50x.
-- These values keep the admin-facing config aligned with the shipped game defaults.
alter table if exists public.game_config
  add column if not exists crash_curve_version text not null default 'house-edge-v1';

update public.game_config
set crash_threshold = 2.50,
    extended_run_percent = 2,
    standard_min_crash = 1.01,
    standard_max_crash = 2.50,
    extended_min_crash = 2.51,
    extended_max_crash = 8.00,
    crash_curve_version = 'house-edge-v1'
where id = 1;
