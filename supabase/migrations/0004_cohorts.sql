-- Wayform — cohort management & admin roles (FR1.4).
-- Objects live in the `wayform` schema. Run 0000 first.
--
-- After running, grant yourself admin with:
--   update wayform.profiles set is_admin = true where email = 'you@example.com';

-- ---------------------------------------------------------------------------
-- Profiles: mirror of auth.users so admins can list people, plus an admin flag.
-- ---------------------------------------------------------------------------
create table if not exists wayform.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Create a profile automatically for every new auth user.
create or replace function wayform.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = wayform
as $$
begin
  insert into wayform.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function wayform.handle_new_user();

-- Backfill profiles for users who already exist.
insert into wayform.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Admin check (SECURITY DEFINER avoids recursive RLS evaluation).
create or replace function wayform.is_admin()
returns boolean
language sql
security definer
stable
set search_path = wayform
as $$
  select exists (
    select 1 from wayform.profiles where id = auth.uid() and is_admin
  );
$$;

-- Prevent non-admins from elevating their own admin status.
create or replace function wayform.protect_is_admin()
returns trigger
language plpgsql
set search_path = wayform
as $$
begin
  -- Allow changes from trusted server contexts (no end-user JWT — e.g. the SQL
  -- editor or the service role, used to bootstrap the first admin). Only block
  -- authenticated, non-admin API users from elevating themselves.
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not wayform.is_admin() then
    raise exception 'Only admins can change admin status.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cohorts and membership.
-- ---------------------------------------------------------------------------
create table if not exists wayform.cohorts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  meeting_url   text,
  -- Weekly session: day of week (0 = Sunday … 6 = Saturday) + start time.
  meeting_day   smallint check (meeting_day between 0 and 6),
  meeting_time  time,
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists wayform.cohort_members (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references wayform.cohorts (id) on delete cascade,
  user_id    uuid not null unique references wayform.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function wayform.my_cohort_id()
returns uuid
language sql
security definer
stable
set search_path = wayform
as $$
  select cohort_id from wayform.cohort_members where user_id = auth.uid() limit 1;
$$;

-- Micro-cohorts hold at most 6 people (the 4-6 guideline's hard ceiling).
create or replace function wayform.enforce_cohort_size()
returns trigger
language plpgsql
set search_path = wayform
as $$
begin
  if (select count(*) from wayform.cohort_members where cohort_id = new.cohort_id) >= 6 then
    raise exception 'A cohort can have at most 6 members.';
  end if;
  return new;
end;
$$;

drop trigger if exists cohort_members_size on wayform.cohort_members;
create trigger cohort_members_size
  before insert on wayform.cohort_members
  for each row execute function wayform.enforce_cohort_size();

drop trigger if exists cohorts_set_updated_at on wayform.cohorts;
create trigger cohorts_set_updated_at
  before update on wayform.cohorts
  for each row execute function wayform.set_updated_at();

drop trigger if exists profiles_protect_is_admin on wayform.profiles;
create trigger profiles_protect_is_admin
  before update on wayform.profiles
  for each row execute function wayform.protect_is_admin();

-- ---------------------------------------------------------------------------
-- Row Level Security.
-- ---------------------------------------------------------------------------
alter table wayform.profiles enable row level security;

drop policy if exists "profiles readable to self, peers, admins" on wayform.profiles;
create policy "profiles readable to self, peers, admins" on wayform.profiles
  for select using (
    id = auth.uid()
    or wayform.is_admin()
    or id in (
      select user_id from wayform.cohort_members
      where cohort_id = wayform.my_cohort_id()
    )
  );

drop policy if exists "profiles update self or admin" on wayform.profiles;
create policy "profiles update self or admin" on wayform.profiles
  for update using (id = auth.uid() or wayform.is_admin())
  with check (id = auth.uid() or wayform.is_admin());

drop policy if exists "profiles insert self" on wayform.profiles;
create policy "profiles insert self" on wayform.profiles
  for insert with check (id = auth.uid());

alter table wayform.cohorts enable row level security;

drop policy if exists "cohorts readable to members and admins" on wayform.cohorts;
create policy "cohorts readable to members and admins" on wayform.cohorts
  for select using (wayform.is_admin() or id = wayform.my_cohort_id());

drop policy if exists "cohorts admin write" on wayform.cohorts;
create policy "cohorts admin write" on wayform.cohorts
  for all using (wayform.is_admin()) with check (wayform.is_admin());

alter table wayform.cohort_members enable row level security;

drop policy if exists "members readable to cohort and admins" on wayform.cohort_members;
create policy "members readable to cohort and admins" on wayform.cohort_members
  for select using (
    wayform.is_admin()
    or user_id = auth.uid()
    or cohort_id = wayform.my_cohort_id()
  );

drop policy if exists "members admin write" on wayform.cohort_members;
create policy "members admin write" on wayform.cohort_members
  for all using (wayform.is_admin()) with check (wayform.is_admin());
