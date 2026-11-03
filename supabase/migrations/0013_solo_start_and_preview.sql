-- Wayform — let a pair start before the second person arrives, and let an
-- invitee see the study before creating an account.
--
-- Until now a pair had to be active before it could choose a plan, advance a
-- day or record a reflection, so the first person had nothing to do until
-- their partner joined. A pending pair is now a solo study that the partner
-- joins later, picking up at whatever day it has reached.

-- ---------------------------------------------------------------------------
-- Writes are allowed for a pending (solo) pair, not just an active one.
-- ---------------------------------------------------------------------------
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
     and old.status = 'dissolved' and not wayform.is_admin() then
    raise exception 'A dissolved pair cannot choose a study plan.';
  end if;

  -- Judged on the resulting row, so a plan and a day may be set together.
  if new.current_index is distinct from old.current_index
     and (old.status = 'dissolved' or new.plan_type is null)
     and not wayform.is_admin() then
    raise exception 'The pair must have a plan before advancing.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reflections may be written by a solo pair too.
-- ---------------------------------------------------------------------------
create or replace function wayform.is_live_pair_member(p_pair_id uuid)
returns boolean
language sql
security definer
stable
set search_path = wayform
as $$
  select exists (
    select 1 from wayform.pairs
    where id = p_pair_id and status <> 'dissolved'
      and (user_a = auth.uid() or user_b = auth.uid())
  );
$$;

drop policy if exists "pair reflections insert own" on wayform.pair_reflections;
create policy "pair reflections insert own" on wayform.pair_reflections
  for insert with check (user_id = auth.uid() and wayform.is_live_pair_member(pair_id));

drop function if exists wayform.is_active_pair_member(uuid);

-- ---------------------------------------------------------------------------
-- Previewing an invite without an account.
--
-- The old select policy made every unclaimed pending pair readable by anyone,
-- which was the only way an invitee could look one up. Now a single function
-- answers for exactly the code you hold, and the blanket clause is dropped.
-- ---------------------------------------------------------------------------
create or replace function wayform.pair_by_invite(p_code text)
returns table (
  id uuid,
  plan_type text,
  plan_config jsonb,
  current_index integer,
  inviter_name text
)
language sql
security definer
stable
set search_path = wayform
as $$
  select
    p.id,
    p.plan_type,
    p.plan_config,
    p.current_index,
    split_part(trim(coalesce(pr.full_name, split_part(pr.email, '@', 1), '')), ' ', 1)
  from wayform.pairs p
  left join wayform.profiles pr on pr.id = p.user_a
  where upper(p.invite_code) = upper(btrim(p_code))
    and p.status = 'pending'
    and p.user_b is null
  limit 1;
$$;

grant execute on function wayform.pair_by_invite(text) to anon, authenticated;

drop policy if exists "pairs readable to members, invitees, admins" on wayform.pairs;
create policy "pairs readable to members and admins" on wayform.pairs
  for select using (
    user_a = auth.uid()
    or user_b = auth.uid()
    or wayform.is_admin()
  );

-- Accepting has to be a definer function for the same reason: the invitee
-- can no longer read the pending row, so an UPDATE from the client would
-- match nothing. The row-level trigger still runs and re-checks the
-- transition, so the guarantees are unchanged.
create or replace function wayform.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = wayform
as $$
declare
  v_pair wayform.pairs;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'You must be signed in to accept an invite.';
  end if;

  select * into v_pair from wayform.pairs
  where upper(invite_code) = upper(btrim(p_code))
    and status = 'pending' and user_b is null
  limit 1;

  if v_pair.id is null then
    raise exception 'That invite code was not found, or has already been used.';
  end if;
  if v_pair.user_a = v_uid then
    raise exception 'You cannot accept your own invite.';
  end if;
  if exists (
    select 1 from wayform.pairs
    where status <> 'dissolved' and id <> v_pair.id
      and (user_a = v_uid or user_b = v_uid)
  ) then
    raise exception 'You are already in a pair.';
  end if;

  update wayform.pairs
  set user_b = v_uid, status = 'active'
  where id = v_pair.id;

  return v_pair.id;
end;
$$;

grant execute on function wayform.accept_invite(text) to authenticated;
