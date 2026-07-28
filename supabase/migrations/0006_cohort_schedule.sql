-- Wayform — structured weekly schedule for cohorts.
-- Replaces the free-text meeting_schedule with a day-of-week + time. Safe to
-- run on an existing wayform.cohorts table.

alter table wayform.cohorts
  add column if not exists meeting_day smallint check (meeting_day between 0 and 6);

alter table wayform.cohorts
  add column if not exists meeting_time time;

alter table wayform.cohorts
  drop column if exists meeting_schedule;
