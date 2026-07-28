-- Wayform — daily reflection capture (FR1.3).
-- Table lives in the `wayform` schema; voice notes live in Storage.
-- Run 0000 and 0001 first.

create table if not exists wayform.reflections (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  track_id              text not null default 'identity-14',
  day                   integer not null check (day between 1 and 14),
  attempted             text not null check (attempted in ('yes', 'not_yet')),
  resistance_text       text,
  resistance_audio_path text,
  noticed_text          text,
  noticed_audio_path    text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, track_id, day)
);

drop trigger if exists reflections_set_updated_at on wayform.reflections;
create trigger reflections_set_updated_at
  before update on wayform.reflections
  for each row execute function wayform.set_updated_at();

alter table wayform.reflections enable row level security;

drop policy if exists "select own reflections" on wayform.reflections;
create policy "select own reflections" on wayform.reflections
  for select using (auth.uid() = user_id);

drop policy if exists "insert own reflections" on wayform.reflections;
create policy "insert own reflections" on wayform.reflections
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own reflections" on wayform.reflections;
create policy "update own reflections" on wayform.reflections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own reflections" on wayform.reflections;
create policy "delete own reflections" on wayform.reflections
  for delete using (auth.uid() = user_id);

-- Private bucket for voice notes (Storage lives in the `storage` schema and is
-- unaffected by the app's db.schema setting). Files are keyed by user id:
-- <user_id>/<track_id>/day-<n>/<prompt>-<timestamp>.webm
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

drop policy if exists "voice notes - select own" on storage.objects;
create policy "voice notes - select own" on storage.objects
  for select using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "voice notes - insert own" on storage.objects;
create policy "voice notes - insert own" on storage.objects
  for insert with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "voice notes - update own" on storage.objects;
create policy "voice notes - update own" on storage.objects
  for update using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "voice notes - delete own" on storage.objects;
create policy "voice notes - delete own" on storage.objects
  for delete using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
