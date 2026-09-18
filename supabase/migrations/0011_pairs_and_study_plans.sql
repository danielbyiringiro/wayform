-- Wayform — pivot to pair-based Bible study.
--
-- Replaces the solo 14-day track (wayform.user_progress, wayform.reflections)
-- with a pair-based model: two users form a Pair, choose a Study Plan
-- (ABSG / Chapter a Day / Custom Passage Range), and move through a shared
-- daily loop together. Cohorts (wayform.cohorts) survive as a weekly,
-- end-of-week container that pairs — not individuals — are assigned into.
--
-- WARNING: this drops wayform.user_progress, wayform.reflections and
-- wayform.cohort_members, which deletes any existing rows in those tables.
-- Back up first if this project has real user data you need to keep.

-- ---------------------------------------------------------------------------
-- Drop what the pair model replaces.
-- ---------------------------------------------------------------------------
drop table if exists wayform.reflections cascade;
drop table if exists wayform.user_progress cascade;
drop table if exists wayform.cohort_members cascade;
drop function if exists wayform.enforce_cohort_size() cascade;

-- ---------------------------------------------------------------------------
-- Pairs: the daily study unit. Exactly two people, invite/accept.
-- ---------------------------------------------------------------------------
create table wayform.pairs (
  id                        uuid primary key default gen_random_uuid(),
  user_a                    uuid not null references auth.users (id) on delete cascade,
  user_b                    uuid references auth.users (id) on delete cascade,
  status                    text not null default 'pending'
                              check (status in ('pending', 'active', 'dissolved')),
  invite_code               text not null unique
                              default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  plan_type                 text check (plan_type in ('absg', 'chapter_a_day', 'custom_range')),
  -- chapter_a_day: {"book": "John"}
  -- custom_range: {"book": "Matthew", "startChapter": 5, "endChapter": 7}
  -- absg: unused, content is date-driven
  plan_config               jsonb not null default '{}'::jsonb,
  plan_started_at           timestamptz,
  current_index             integer not null default 1,
  current_index_started_at  timestamptz not null default now(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint pairs_distinct_partners check (user_b is null or user_b <> user_a)
);

drop trigger if exists pairs_set_updated_at on wayform.pairs;
create trigger pairs_set_updated_at
  before update on wayform.pairs
  for each row execute function wayform.set_updated_at();

-- A user may only ever belong to one non-dissolved pair.
create or replace function wayform.enforce_single_pair()
returns trigger
language plpgsql
set search_path = wayform
as $$
begin
  if auth.uid() is not null and exists (
    select 1 from wayform.pairs
    where status <> 'dissolved'
      and (user_a = auth.uid() or user_b = auth.uid())
  ) then
    raise exception 'You are already in a pair.';
  end if;
  return new;
end;
$$;

drop trigger if exists pairs_enforce_single on wayform.pairs;
create trigger pairs_enforce_single
  before insert on wayform.pairs
  for each row execute function wayform.enforce_single_pair();

-- Guard the state machine: who can accept an invite, dissolve a pair,
-- pick a plan, or advance the shared daily index — beyond what RLS alone
-- can express. Skipped for service-role/SQL-editor contexts (auth.uid() null).
create or replace function wayform.enforce_pair_transition()
returns trigger
language plpgsql
set search_path = wayform
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.status = 'dissolved' and new.status <> 'dissolved' then
    raise exception 'A dissolved pair cannot be reactivated.';
  end if;

  if new.user_a is distinct from old.user_a and not wayform.is_admin() then
    raise exception 'Cannot change the pair owner.';
  end if;

  if old.user_b is null and new.user_b is not null then
    -- Accepting an invite.
    if new.user_b <> auth.uid() then
      raise exception 'Only the invited user can accept this invite.';
    end if;
    if exists (
      select 1 from wayform.pairs
      where status <> 'dissolved' and id <> old.id
        and (user_a = auth.uid() or user_b = auth.uid())
    ) then
      raise exception 'You are already in a pair.';
    end if;
    new.status := 'active';
  elsif new.user_b is distinct from old.user_b and not wayform.is_admin() then
    raise exception 'Cannot reassign the other partner.';
  end if;

  if new.plan_type is distinct from old.plan_type
     and old.status <> 'active' and not wayform.is_admin() then
    raise exception 'The pair must be active before choosing a study plan.';
  end if;

  if new.current_index is distinct from old.current_index
     and (old.status <> 'active' or old.plan_type is null)
     and not wayform.is_admin() then
    raise exception 'The pair must have an active plan before advancing.';
  end if;

  return new;
end;
$$;

drop trigger if exists pairs_enforce_transition on wayform.pairs;
create trigger pairs_enforce_transition
  before update on wayform.pairs
  for each row execute function wayform.enforce_pair_transition();

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER avoids recursive RLS evaluation).
-- ---------------------------------------------------------------------------
create or replace function wayform.my_pair_id()
returns uuid
language sql
security definer
stable
set search_path = wayform
as $$
  select id from wayform.pairs
  where status <> 'dissolved' and (user_a = auth.uid() or user_b = auth.uid())
  limit 1;
$$;

create or replace function wayform.partner_id()
returns uuid
language sql
security definer
stable
set search_path = wayform
as $$
  select case when user_a = auth.uid() then user_b else user_a end
  from wayform.pairs
  where status <> 'dissolved' and (user_a = auth.uid() or user_b = auth.uid())
  limit 1;
$$;

create or replace function wayform.is_pair_member(p_pair_id uuid)
returns boolean
language sql
security definer
stable
set search_path = wayform
as $$
  select exists (
    select 1 from wayform.pairs
    where id = p_pair_id and (user_a = auth.uid() or user_b = auth.uid())
  );
$$;

create or replace function wayform.is_active_pair_member(p_pair_id uuid)
returns boolean
language sql
security definer
stable
set search_path = wayform
as $$
  select exists (
    select 1 from wayform.pairs
    where id = p_pair_id and status = 'active'
      and (user_a = auth.uid() or user_b = auth.uid())
  );
$$;

-- Cohorts now hold pairs, so "my cohort" is looked up through my pair.
create or replace function wayform.my_cohort_id()
returns uuid
language sql
security definer
stable
set search_path = wayform
as $$
  select cp.cohort_id
  from wayform.cohort_pairs cp
  join wayform.pairs p on p.id = cp.pair_id
  where p.status <> 'dissolved' and (p.user_a = auth.uid() or p.user_b = auth.uid())
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: pairs.
-- ---------------------------------------------------------------------------
alter table wayform.pairs enable row level security;

drop policy if exists "pairs readable to members, invitees, admins" on wayform.pairs;
create policy "pairs readable to members, invitees, admins" on wayform.pairs
  for select using (
    user_a = auth.uid()
    or user_b = auth.uid()
    or wayform.is_admin()
    or (status = 'pending' and user_b is null)
  );

drop policy if exists "pairs insert as owner" on wayform.pairs;
create policy "pairs insert as owner" on wayform.pairs
  for insert with check (user_a = auth.uid());

drop policy if exists "pairs update by members or invitee" on wayform.pairs;
create policy "pairs update by members or invitee" on wayform.pairs
  for update using (
    user_a = auth.uid()
    or user_b = auth.uid()
    or wayform.is_admin()
    or (status = 'pending' and user_b is null)
  )
  with check (user_a = auth.uid() or user_b = auth.uid() or wayform.is_admin());

drop policy if exists "pairs delete admin only" on wayform.pairs;
create policy "pairs delete admin only" on wayform.pairs
  for delete using (wayform.is_admin());

-- ---------------------------------------------------------------------------
-- Pair reflections (FR1.5) — one row per partner per day, private to the pair.
-- ---------------------------------------------------------------------------
create table wayform.pair_reflections (
  id                    uuid primary key default gen_random_uuid(),
  pair_id               uuid not null references wayform.pairs (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,
  day_index             integer not null check (day_index >= 1),
  attempted             text not null check (attempted in ('yes', 'not_yet')),
  resistance_text       text,
  resistance_audio_path text,
  change_text           text,
  change_audio_path     text,
  noticed_text          text,
  noticed_audio_path    text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (pair_id, user_id, day_index)
);

drop trigger if exists pair_reflections_set_updated_at on wayform.pair_reflections;
create trigger pair_reflections_set_updated_at
  before update on wayform.pair_reflections
  for each row execute function wayform.set_updated_at();

alter table wayform.pair_reflections enable row level security;

drop policy if exists "pair reflections readable to the pair" on wayform.pair_reflections;
create policy "pair reflections readable to the pair" on wayform.pair_reflections
  for select using (wayform.is_pair_member(pair_id) or wayform.is_admin());

drop policy if exists "pair reflections insert own" on wayform.pair_reflections;
create policy "pair reflections insert own" on wayform.pair_reflections
  for insert with check (user_id = auth.uid() and wayform.is_active_pair_member(pair_id));

drop policy if exists "pair reflections update own" on wayform.pair_reflections;
create policy "pair reflections update own" on wayform.pair_reflections
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "pair reflections delete own" on wayform.pair_reflections;
create policy "pair reflections delete own" on wayform.pair_reflections
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Cohorts now hold pairs (2-3 pairs = 4-6 people), not individual users.
-- ---------------------------------------------------------------------------
create table wayform.cohort_pairs (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references wayform.cohorts (id) on delete cascade,
  pair_id    uuid not null unique references wayform.pairs (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function wayform.enforce_cohort_pair_size()
returns trigger
language plpgsql
set search_path = wayform
as $$
begin
  if (select count(*) from wayform.cohort_pairs where cohort_id = new.cohort_id) >= 3 then
    raise exception 'A cohort can have at most 3 pairs (6 members).';
  end if;
  return new;
end;
$$;

drop trigger if exists cohort_pairs_size on wayform.cohort_pairs;
create trigger cohort_pairs_size
  before insert on wayform.cohort_pairs
  for each row execute function wayform.enforce_cohort_pair_size();

alter table wayform.cohort_pairs enable row level security;

drop policy if exists "cohort_pairs readable to cohort and admins" on wayform.cohort_pairs;
create policy "cohort_pairs readable to cohort and admins" on wayform.cohort_pairs
  for select using (
    wayform.is_admin()
    or pair_id in (select id from wayform.pairs where user_a = auth.uid() or user_b = auth.uid())
    or cohort_id = wayform.my_cohort_id()
  );

drop policy if exists "cohort_pairs admin write" on wayform.cohort_pairs;
create policy "cohort_pairs admin write" on wayform.cohort_pairs
  for all using (wayform.is_admin()) with check (wayform.is_admin());

-- Profile visibility now extends to your pair partner and your cohort-mates
-- (the other pairs sharing your weekly cohort), in place of the old
-- single-cohort-of-individuals check.
drop policy if exists "profiles readable to self, peers, admins" on wayform.profiles;
create policy "profiles readable to self, peers, admins" on wayform.profiles
  for select using (
    id = auth.uid()
    or wayform.is_admin()
    or id = wayform.partner_id()
    or id in (
      select unnest(array[p.user_a, p.user_b])
      from wayform.cohort_pairs cp
      join wayform.pairs p on p.id = cp.pair_id
      where cp.cohort_id = wayform.my_cohort_id()
    )
  );
