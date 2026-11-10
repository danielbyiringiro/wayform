-- Wayform — scheduled live sessions for a pair.
--
-- Pairs study at a fixed time on a few chosen days ("6pm, Tuesday, Thursday,
-- Friday"). Partners are often in different places, so both the time and the
-- weekday belong to one canonical zone: 6pm Friday in Accra is 5am Saturday
-- in Auckland. The slot is stored as a local time plus the IANA zone it was
-- set in — never a UTC offset, which would break at every DST change.

alter table wayform.pairs
  add column if not exists session_time time,
  add column if not exists session_timezone text,
  add column if not exists session_days smallint[];

alter table wayform.pairs drop constraint if exists pairs_session_slot_complete;
alter table wayform.pairs add constraint pairs_session_slot_complete check (
  (session_time is null and session_timezone is null and session_days is null)
  or (
    session_time is not null
    and session_timezone is not null
    and session_days is not null
    and array_length(session_days, 1) > 0
    -- 0 = Sunday … 6 = Saturday, in session_timezone
    and session_days <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);

-- A bad zone name would otherwise only surface when working out the next
-- session, so reject it at write time instead.
create or replace function wayform.validate_session_timezone()
returns trigger
language plpgsql
set search_path = wayform
as $$
begin
  if new.session_timezone is not null
     and not exists (
       select 1 from pg_timezone_names where name = new.session_timezone
     ) then
    raise exception 'Unknown time zone: %', new.session_timezone;
  end if;
  return new;
end;
$$;

drop trigger if exists pairs_validate_timezone on wayform.pairs;
create trigger pairs_validate_timezone
  before insert or update on wayform.pairs
  for each row execute function wayform.validate_session_timezone();

-- ---------------------------------------------------------------------------
-- When the next session falls. Lives here rather than in the client so the
-- reminder job and the UI can never disagree about it.
-- ---------------------------------------------------------------------------
create or replace function wayform.next_session_at(
  p_time time,
  p_timezone text,
  p_days smallint[],
  p_from timestamptz default now()
)
returns timestamptz
language sql
stable
as $$
  select min(occurrence)
  from (
    select ((day::date + p_time) at time zone p_timezone) as occurrence
    from generate_series(
      (p_from at time zone p_timezone)::date - 1,
      (p_from at time zone p_timezone)::date + 8,
      interval '1 day'
    ) as day
    where extract(dow from day)::smallint = any (p_days)
  ) candidates
  where occurrence > p_from;
$$;

create or replace function wayform.pair_next_session(p_pair_id uuid)
returns timestamptz
language sql
security definer
stable
set search_path = wayform
as $$
  select wayform.next_session_at(p.session_time, p.session_timezone, p.session_days)
  from wayform.pairs p
  where p.id = p_pair_id
    and p.status <> 'dissolved'
    and (p.user_a = auth.uid() or p.user_b = auth.uid())
    and p.session_time is not null;
$$;

grant execute on function wayform.pair_next_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- One row per study session. The note is written by whoever is scribing, so
-- the pair ends up with a single shared record of what they talked about.
-- ---------------------------------------------------------------------------
create table if not exists wayform.pair_sessions (
  id            uuid primary key default gen_random_uuid(),
  pair_id       uuid not null references wayform.pairs (id) on delete cascade,
  day_index     integer not null check (day_index >= 1),
  scheduled_for timestamptz,
  started_by    uuid references auth.users (id),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  note          text,
  note_author   uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (pair_id, day_index)
);

drop trigger if exists pair_sessions_set_updated_at on wayform.pair_sessions;
create trigger pair_sessions_set_updated_at
  before update on wayform.pair_sessions
  for each row execute function wayform.set_updated_at();

alter table wayform.pair_sessions enable row level security;

drop policy if exists "sessions readable to the pair" on wayform.pair_sessions;
create policy "sessions readable to the pair" on wayform.pair_sessions
  for select using (wayform.is_pair_member(pair_id) or wayform.is_admin());

drop policy if exists "sessions writable by the pair" on wayform.pair_sessions;
create policy "sessions writable by the pair" on wayform.pair_sessions
  for insert with check (wayform.is_live_pair_member(pair_id));

drop policy if exists "sessions updatable by the pair" on wayform.pair_sessions;
create policy "sessions updatable by the pair" on wayform.pair_sessions
  for update using (wayform.is_live_pair_member(pair_id))
  with check (wayform.is_live_pair_member(pair_id));

-- ---------------------------------------------------------------------------
-- How to reach your partner when it's time to call. A free-text link rather
-- than a phone number, so people can point at whatever they actually use.
-- ---------------------------------------------------------------------------
alter table wayform.profiles add column if not exists contact_link text;
