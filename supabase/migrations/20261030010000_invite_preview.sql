-- What an invite link is for, so the invite page can say "Join <play> as an editor"
-- before the recipient is a member (RLS hides the play until then). Knowing the
-- token is what grants access, so the token holder may see this much.
create function public.invite_preview(p_token text)
returns table (play_name text, role text, expires_at timestamptz, already_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name,
         i.role,
         i.expires_at,
         public.play_role(i.play_id) is not null
  from public.invites i
  join public.plays p on p.id = i.play_id
  where i.token = p_token
    and i.expires_at > now()
$$;

revoke execute on function public.invite_preview(text) from public, anon;
grant execute on function public.invite_preview(text) to authenticated;
