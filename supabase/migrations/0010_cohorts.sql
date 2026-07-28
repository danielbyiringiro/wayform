-- Wayform — cohort management & admin roles (FR1.4).
-- Isolated in the `wayform` schema so it does not collide with the chatbot
-- app's `public.profiles` (different structure, @ashesi.edu.gh-gated) that
-- lives in this same Supabase project.
--
-- After running, grant yourself admin with:
--   update wayform.profiles set is_admin = true where email = 'you@example.com';

-- ---------------------------------------------------------------------------
-- Profiles: Wayform's own mirror of auth.users, plus an admin flag.
-- This is intentionally separate from public.profiles (owned by the chatbot
-- app) — do not merge them, their schemas and constraints differ.
-- ---------------------------------------------------------------------------
create table if not exists wayform.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Create a Wayform profile automatically for every new auth user.
-- Named distinctly (wayform_handle_new_user / wayform_on_auth_user_created)
-- so it runs alongside — not instead of — the chatbot app's own trigger on
-- auth.users. Postgres runs all triggers registered for the same event.
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

drop trigger if exists wayform_on_auth_user_created on auth.users;
create trigger wayform_on_auth_user_created
  after insert on auth.users
  for each row execute function wayform.handle_new_user();

-- Backfill Wayform profiles for users who already exist.
insert into wayform.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Prevent non-admins from elevating their own admin status.
create or replace function wayform.protect_is_admin()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin and not wayform.is_admin() then
    raise exception 'Only admins can change admin status.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER avoids recursive RLS evaluation).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Cohorts and membership.
-- ---------------------------------------------------------------------------
create table if not exists wayform.cohorts (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  meeting_url      text,
  meeting_schedule text,
  created_by       uuid references auth.users (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One cohort per user. user_id references wayform.profiles so PostgREST can
-- embed the member's profile (email) when listing members.
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

-- Reuses wayform.set_updated_at(), defined in 0001_user_progress.sql.
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
