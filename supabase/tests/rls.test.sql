-- RLS tests. Run with `supabase test db` (local) or `supabase test db --linked`.
-- Everything runs in a transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

-- Users: owner, editor, viewer, outsider.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'editor@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'viewer@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'outsider@test.local', 'authenticated', 'authenticated');

-- Act as the owner and create a play.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

insert into plays (id, name) values ('11111111-1111-1111-1111-111111111111', 'Test play');

select is(
  play_role('11111111-1111-1111-1111-111111111111'), 'owner',
  'creating a play makes you its owner'
);

-- Invite the editor and viewer through accept_invite().
insert into invites (play_id, role, token) values
  ('11111111-1111-1111-1111-111111111111', 'editor', 'editor-token'),
  ('11111111-1111-1111-1111-111111111111', 'viewer', 'viewer-token');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is(
  accept_invite('editor-token'), '11111111-1111-1111-1111-111111111111'::uuid,
  'accepting an invite returns the play id'
);
select is(play_role('11111111-1111-1111-1111-111111111111'), 'editor', 'invitee gets the invited role');
select throws_ok($$ select accept_invite('editor-token') $$, 'P0002', null, 'an invite can only be used once');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select lives_ok($$ select accept_invite('viewer-token') $$, 'viewer accepts their invite');

-- Outsider (non-member) can't see anything.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';
select is_empty($$ select * from plays $$, 'a non-member cannot read the play');
select is_empty($$ select * from play_members $$, 'a non-member cannot read members');
select is_empty(
  $$ select * from get_play_members('11111111-1111-1111-1111-111111111111') $$,
  'a non-member cannot list members'
);
select is_empty(
  $$ update plays set name = 'Hacked' where id = '11111111-1111-1111-1111-111111111111' returning id $$,
  'a non-member cannot update the play'
);

-- Viewer can read but not change anything.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select isnt_empty($$ select * from plays $$, 'a viewer can read the play');
select is_empty(
  $$ update plays set name = 'Viewer rename' where id = '11111111-1111-1111-1111-111111111111' returning id $$,
  'a viewer cannot update the play'
);
select is_empty(
  $$ delete from plays where id = '11111111-1111-1111-1111-111111111111' returning id $$,
  'a viewer cannot delete the play'
);
select throws_ok(
  $$ insert into invites (play_id, role) values ('11111111-1111-1111-1111-111111111111', 'editor') $$,
  '42501', null, 'a viewer cannot create invites'
);

-- Editor can read but can't rename (owner only) or touch the snapshot column.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is_empty(
  $$ update plays set name = 'Editor rename' where id = '11111111-1111-1111-1111-111111111111' returning id $$,
  'an editor cannot rename the play'
);
select throws_ok(
  $$ update plays set ydoc_snapshot = '\x00' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'clients cannot write the snapshot directly'
);

-- Owner can rename.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select isnt_empty(
  $$ update plays set name = 'Renamed' where id = '11111111-1111-1111-1111-111111111111' returning id $$,
  'the owner can rename the play'
);

select * from finish();
rollback;
