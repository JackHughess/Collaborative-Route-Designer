-- Explicit table privileges.
--
-- Some Supabase projects don't grant API roles access to new tables by
-- default, so grant exactly what the RLS policies allow instead of relying on
-- default privileges. RLS still decides which rows each user can touch.
-- anon gets nothing: every route that reads plays requires a signed-in user.

-- plays: column-level UPDATE (name, thumbnail_url) is granted in the init
-- migration; the snapshot is only written by the collaboration server.
grant select, insert, delete on public.plays to authenticated;

-- play_members: rows are created by triggers and accept_invite() (SECURITY
-- DEFINER), and column-level UPDATE (role) is granted in the init migration.
grant select, delete on public.play_members to authenticated;

grant select, insert, delete on public.invites to authenticated;

-- Server code (Next.js server actions with the secret key, and Hocuspocus).
-- service_role bypasses RLS but still needs table privileges.
grant select, insert, update, delete on public.plays, public.play_members, public.invites
  to service_role;
