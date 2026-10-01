-- Wayform — keep the display name the OAuth provider gives us.
--
-- Profiles only stored an email, so partners and cohort mates could only be
-- shown as "daniel.byiringiro@ashesi.edu.gh". Google and GitHub both hand us
-- a name in raw_user_meta_data; store it so people can be shown by name.

alter table wayform.profiles add column if not exists full_name text;

-- Carry the name through at signup, alongside the email.
create or replace function wayform.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = wayform
as $$
begin
  insert into wayform.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'user_name'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill everyone who signed up before the column existed.
update wayform.profiles p
set full_name = coalesce(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      u.raw_user_meta_data ->> 'user_name'
    )
from auth.users u
where u.id = p.id
  and p.full_name is null;
