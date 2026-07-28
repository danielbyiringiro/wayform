-- Wayform — church integration (FR1.5).
-- Optional: users may name a local church or mark themselves "exploring".
-- Safe to run on an existing wayform.profiles table.

alter table wayform.profiles
  add column if not exists church_status text
    check (church_status in ('attending', 'exploring'));

alter table wayform.profiles
  add column if not exists church_name text;
