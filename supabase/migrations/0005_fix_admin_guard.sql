-- Wayform — fix admin-status guard so the first admin can be bootstrapped.
-- The original trigger blocked every non-admin from setting is_admin, which
-- also blocked the SQL editor (where auth.uid() is null and no admin exists
-- yet). Only enforce the guard for authenticated API users.

create or replace function wayform.protect_is_admin()
returns trigger
language plpgsql
set search_path = wayform
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not wayform.is_admin() then
    raise exception 'Only admins can change admin status.';
  end if;
  return new;
end;
$$;

-- Now you can grant the first admin, e.g.:
--   update wayform.profiles set is_admin = true where email = 'you@example.com';
