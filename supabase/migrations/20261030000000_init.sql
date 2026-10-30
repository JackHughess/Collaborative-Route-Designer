-- Plays, membership and invites, with RLS.
-- Every policy goes through play_role(), which returns the caller's role on a play.

-- ── Tables ──────────────────────────────────────────────────────────

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Untitled play' check (char_length(name) between 1 and 120),
  ydoc_snapshot bytea,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.play_members (
  play_id uuid not null references public.plays (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (play_id, user_id)
);

create index play_members_user_id_idx on public.play_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays (id) on delete cascade,
  -- Optional label for who the link is for. The app sends no email.
  email text,
  role text not null check (role in ('editor', 'viewer')),
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

create index invites_play_id_idx on public.invites (play_id);

-- ── Helpers ─────────────────────────────────────────────────────────

-- The caller's role on a play, or null. SECURITY DEFINER so policies on
-- play_members can call it without recursing into their own RLS.
create function public.play_role(p_play_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.play_members m
  where m.play_id = p_play_id
    and m.user_id = auth.uid()
$$;

revoke execute on function public.play_role(uuid) from public, anon;
grant execute on function public.play_role(uuid) to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger plays_set_updated_at
  before update on public.plays
  for each row execute function public.set_updated_at();

-- The creator of a play becomes its owner member.
create function public.add_play_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.play_members (play_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger plays_add_owner
  after insert on public.plays
  for each row execute function public.add_play_owner();

-- Members of a play with their email and display name, for the share dialog.
-- auth.users is not exposed to clients, so this reads it on their behalf,
-- and only for plays the caller belongs to.
create function public.get_play_members(p_play_id uuid)
returns table (user_id uuid, role text, email text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id,
         m.role,
         u.email::text,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email)::text
  from public.play_members m
  join auth.users u on u.id = m.user_id
  where m.play_id = p_play_id
    and public.play_role(p_play_id) is not null
  order by m.created_at
$$;

revoke execute on function public.get_play_members(uuid) from public, anon;
grant execute on function public.get_play_members(uuid) to authenticated;

-- Accept an invite: add the caller as a member and delete the invite.
-- The caller isn't a member yet, so this can't go through normal RLS.
-- Returns the play id. An existing member keeps the higher of the two roles.
create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_invite
  from public.invites
  where token = p_token
  for update;

  if not found or v_invite.expires_at < now() then
    raise exception 'invite not found or expired' using errcode = 'P0002';
  end if;

  insert into public.play_members (play_id, user_id, role)
  values (v_invite.play_id, v_uid, v_invite.role)
  on conflict (play_id, user_id) do update
    set role = excluded.role
    where public.play_members.role = 'viewer' and excluded.role = 'editor';

  delete from public.invites where id = v_invite.id;

  return v_invite.play_id;
end;
$$;

revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- ── Row level security ─────────────────────────────────────────────

alter table public.plays enable row level security;
alter table public.play_members enable row level security;
alter table public.invites enable row level security;

-- plays: members read; anyone signed in creates their own; the owner renames
-- and deletes. Document edits go through Hocuspocus (service role), not here.
create policy "members can read plays" on public.plays
  for select to authenticated
  using (owner_id = auth.uid() or public.play_role(id) is not null);

create policy "users create their own plays" on public.plays
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "owners update plays" on public.plays
  for update to authenticated
  using (public.play_role(id) = 'owner')
  with check (public.play_role(id) = 'owner');

create policy "owners delete plays" on public.plays
  for delete to authenticated
  using (public.play_role(id) = 'owner');

-- Clients may only change these columns; owner_id and the snapshot are off limits.
revoke update on public.plays from anon, authenticated;
grant update (name, thumbnail_url) on public.plays to authenticated;

-- play_members: members see each other; owners change and remove
-- non-owners; anyone can leave a play they don't own. Rows are only
-- created by the owner trigger and accept_invite().
create policy "members can read members" on public.play_members
  for select to authenticated
  using (public.play_role(play_id) is not null);

create policy "owners change member roles" on public.play_members
  for update to authenticated
  using (public.play_role(play_id) = 'owner' and role <> 'owner')
  with check (role in ('editor', 'viewer'));

create policy "owners remove members, members leave" on public.play_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (public.play_role(play_id) = 'owner' or user_id = auth.uid())
  );

revoke update on public.play_members from anon, authenticated;
grant update (role) on public.play_members to authenticated;

-- invites: owners only. Accepting goes through accept_invite().
create policy "owners read invites" on public.invites
  for select to authenticated
  using (public.play_role(play_id) = 'owner');

create policy "owners create invites" on public.invites
  for insert to authenticated
  with check (public.play_role(play_id) = 'owner');

create policy "owners delete invites" on public.invites
  for delete to authenticated
  using (public.play_role(play_id) = 'owner');
