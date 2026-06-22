-- Wayform — add day-timing for time-spaced progression.
-- Safe to run on an existing user_progress table (additive). If you have not
-- yet run 0001, that file already includes this column and you can skip this.

alter table public.user_progress
  add column if not exists current_day_started_at timestamptz not null default now();