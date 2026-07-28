-- Wayform — dedicated schema, kept separate from the chatbot app's public schema.
create schema if not exists wayform;

create table if not exists wayform.user_progress (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  track_id                text not null default 'identity-14',
  current_day             integer not null default 1 check (current_day between 1 and 14),
  current_day_started_at  timestamptz not null default now(),
  started_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create or replace function wayform.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_progress_set_updated_at on wayform.user_progress;
create trigger user_progress_set_updated_at
  before update on wayform.user_progress
  for each row execute function wayform.set_updated_at();

alter table wayform.user_progress enable row level security;

drop policy if exists "select own progress" on wayform.user_progress;
create policy "select own progress" on wayform.user_progress
  for select using (auth.uid() = user_id);

drop policy if exists "insert own progress" on wayform.user_progress;
create policy "insert own progress" on wayform.user_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own progress" on wayform.user_progress;
create policy "update own progress" on wayform.user_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
