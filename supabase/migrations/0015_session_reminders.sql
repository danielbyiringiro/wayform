-- Wayform — remember who has already been reminded, and where they are.
--
-- A 6pm slot is useless if nobody is told about it. The reminder job records
-- the exact occurrence it sent for, so it is safe to run at any frequency:
-- each session gets at most one email however often cron fires.

alter table wayform.pairs
  add column if not exists reminder_sent_for timestamptz;

-- Partners are often in different places, so the email shows each person
-- their own local time rather than the pair's zone. Captured from the
-- browser when someone saves a schedule or edits their profile.
alter table wayform.profiles
  add column if not exists timezone text;

-- ---------------------------------------------------------------------------
-- The pairs due a reminder, with both partners' addresses.
--
-- SECURITY DEFINER so the scheduled job can see across pairs, but it is
-- deliberately not granted to anon or authenticated — only the service role,
-- which bypasses RLS anyway, has any business calling it.
-- ---------------------------------------------------------------------------
create or replace function wayform.sessions_due_reminder(p_within interval default interval '26 hours')
returns table (
  pair_id       uuid,
  occurrence    timestamptz,
  session_zone  text,
  plan_type     text,
  recipients    jsonb
)
language sql
security definer
stable
set search_path = wayform
as $$
  select
    p.id,
    wayform.next_session_at(p.session_time, p.session_timezone, p.session_days),
    p.session_timezone,
    p.plan_type,
    jsonb_agg(
      jsonb_build_object('email', pr.email, 'name', pr.full_name, 'timezone', pr.timezone)
    ) filter (where pr.email is not null)
  from wayform.pairs p
  join wayform.profiles pr
    on pr.id = p.user_a or pr.id = p.user_b
  where p.status <> 'dissolved'
    and p.session_time is not null
    and p.plan_type is not null
  group by p.id
  having wayform.next_session_at(p.session_time, p.session_timezone, p.session_days)
           <= now() + p_within
     and (
       p.reminder_sent_for is null
       or p.reminder_sent_for is distinct from
          wayform.next_session_at(p.session_time, p.session_timezone, p.session_days)
     );
$$;

revoke all on function wayform.sessions_due_reminder(interval) from public, anon, authenticated;
