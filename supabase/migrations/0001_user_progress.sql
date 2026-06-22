-- Wayform — user progress through the 14-day formation track.
-- Run this in your Supabase project (SQL Editor, or `supabase db push`).

create table if not exists public.user_progress (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  track_id                text not null default 'identity-14',
  current_day             integer not null default 1 check (current_day between 1 and 14),
  -- When the current day became active. Used to time-gate the next day:
  -- the next lesson only unlocks on a later calendar day than this.
  current_day_started_at  timestamptz not null default now(),
  started_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Keep updated_at fresh on every change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_progress_set_updated_at on public.user_progress;
create trigger user_progress_set_updated_at
  before update on public.user_progress
  for each row execute function public.set_updated_at();

-- Row Level Security: a user may only ever read or write their own row.
alter table public.user_progress enable row level security;

drop policy if exists "select own progress" on public.user_progress;
create policy "select own progress" on public.user_progress
  for select using (auth.uid() = user_id);

drop policy if exists "insert own progress" on public.user_progress;
create policy "insert own progress" on public.user_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own progress" on public.user_progress;
create policy "update own progress" on public.user_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
