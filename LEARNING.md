# Learning the codebase

Five small pieces of the app are blanked out for you to write. Each one sits at the heart of a different layer, so finishing them walks you through how the whole app works. Every blank is marked `TODO(exercise N)` in the code with a hint or two. Tests tell you when you're done.

Until you finish them, parts of the app don't work: players won't move, playback freezes, and live collaboration refuses every connection. That's expected. Linting also reports unused variables in the blanked-out functions until they're filled in.

**Stuck?** Run `git diff 99c931f -- <file>` to see the original code (spoilers!). Exercise 5 has no answer in git, so ask Claude instead.

Do them in order: each one makes more of the app work.

---

## 1. The command layer: `lib/play/commands.ts`

**1a `movePlayer`** and **1b `deletePlayer`**

The shared play lives in a Yjs document, and the UI never edits it directly. It calls commands like these, which make one atomic change (`transact`) that syncs to everyone and is one step for undo. Read `addPlayer` and `updatePlayer` first.

Check: `npx vitest run lib/play`. Then in the app (`npm run dev`), drag a player and press Ctrl+Z.

## 2. Playback math: `lib/field/geometry.ts`

**2a `pointAtDistance`**: given a route sampled into points with running distances, where are you after `d` yards?
**2b `simulate`**: where is every player `t` seconds after the snap?

Every browser runs playback on its own, so these must be pure: the same input always gives the same output, with no `Date.now()` or randomness. That's why two people watching the same play see the same thing without syncing any animation.

Check: `npx vitest run lib/field`

## 3. Permissions for live sessions: `server/src/server.ts`

**3a `authorize`** and **3b the read-only switch for viewers**

The collaboration server can't rely on the database's row-level security, because it connects with the secret key that bypasses it. So it checks every connection itself: is this a real user, and are they a member of this play? Look at `PlayStore` in `server/src/store.ts` and `VerifyToken` in `server/src/auth.ts`.

Check: `cd server && npm test`. Then run the whole thing: `npm run dev` and `npm run dev:collab`, open a play in two browsers, and log in as different users.

## 4. The clock: `components/editor/usePlayback.ts`

**4 `tick`**: the `requestAnimationFrame` loop that moves time forward.

The play's time is local to each browser and never synced. This loop is the only place it changes while playing. It's the only exercise without a unit test.

Check: in the app, draw a route (R), press Space, and try the 0.5× and 2× speeds.

## 5. Permissions in the database: `supabase/tests/rls.test.sql`

**Exercise 5**: write two pgTAP tests: an editor can't remove another member, and a viewer can leave a play.

Row-level security policies are the real permission check for everything the browser reads or writes. Read the policies on `play_members` in `supabase/migrations/20261030000000_init.sql`, then copy the style of the tests above the TODO.

Check: `npm run test:db`, which should report `all 21 passed`.

---

## Small chores

These are the tedious parts. Most are done; these few are yours.

**A. Dashboard loading state.** Create `app/dashboard/loading.tsx`. Next.js shows it while the dashboard's data loads. `app/play/[id]/loading.tsx` is an example; a few grey placeholder rows is plenty.

**B. Sign-out end-to-end test.** Fill in the `test.fixme` in `e2e/auth.spec.ts`. Run it with `npm run test:e2e`; it needs exercises 1 and 3 done, because the other e2e test edits a play live.

**C. Deploy.** Follow the Deploying section of `CLAUDE.md`: Fly for `server/` (config in `server/fly.toml`), Vercel for the web app, and the URL settings in Supabase.

---

## When you're done

```bash
npm run lint && npm run typecheck && npm test
npm --prefix server test
npm run test:db
npm run test:e2e
```

All green means the app is whole again, and you've written its command layer, its playback engine, its clock, and both of its permission checks.
