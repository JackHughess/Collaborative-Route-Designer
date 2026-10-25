# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Collaborative Route Designer** is a web app for designing American football plays.
A play is a formation of players, each with a route. Users sign in, save plays to their account, and invite others to **edit the same play together in real time**.

### Core features
- **Accounts:** sign up, sign in and sign out. Each user owns their plays.
- **Play editor:** a football field where you place players in a formation and draw a route for each one (straight segments, curves, breaks and option routes).
- **Playback:** run the play and watch every player run their route at the same time.
- **Persistence:** every play is saved to the database and autosaves while you edit.
- **Real-time collaboration:** several users edit one play at once. Each sees the others' cursors, selections and edits live, so one person can adjust the slot receiver while another redraws the tight end's route.
- **Sharing:** the owner invites collaborators by email link as an `editor` or a `viewer`.

## Core architecture: sync the model, render locally

The **play model** is the only thing that is shared. It holds the players, their positions, their routes, timing and metadata.
- Clients send **edits to elements** (move a player, add a route point, change a route's style). They never send pixels, frames or animation state.
- Every client renders the play **independently** from its local copy of the model. That covers the field drawing, playback, zoom and pan, selection and the playback position. All of this is local and never synced.
- `render(model)` and `simulate(model, t)` are **pure and deterministic**, so every client shows the same play from the same model.
- The only shared ephemeral data is **presence** (who is connected, their cursor, what they have selected). It is never persisted.

```
 Client A                  Sync layer                 Client B
 edit element ──ops──▶  shared play model  ◀──ops── edit element
 render(model) ◀──updates──     │      ──updates──▶ render(model)
 simulate(model,t)              ▼                   simulate(model,t)
 (local playback)        Postgres snapshot          (local playback)
```

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript (strict), Tailwind CSS |
| Field rendering | SVG + React |
| Database, auth and storage | Supabase (Postgres with RLS, Supabase Auth via `@supabase/ssr`) |
| Real-time sync | Yjs (CRDT) |
| Collaboration server | Hocuspocus (Node) |
| Hosting | Vercel for the web app, Fly.io for Hocuspocus, Supabase for the database and auth |
| Testing | Vitest for unit tests, Playwright for end-to-end tests |

## Project structure

```
app/                  Next.js routes (login, dashboard, /play/[id], /invite/[token])
components/field/     SVG field, player, route and cursor components
lib/field/            Pure geometry: coordinates, path sampling, simulate()
lib/play/             Yjs schema, typed command layer (commands.ts) and model snapshot hook
lib/supabase/         Browser and server Supabase clients
server/               Hocuspocus collaboration server (deployed separately to Fly.io)
supabase/migrations/  SQL schema, RLS policies and helper functions
```

## Collaboration sessions

- **One room per play**, keyed by the play's id. Everyone editing that play joins the same room.
- **Room lifecycle (Hocuspocus):**
  1. `onAuthenticate` verifies the user and their role (see Auth).
  2. `onLoadDocument` loads `plays.ydoc_snapshot` from Postgres when the first user joins.
  3. The server relays updates between clients.
  4. `onStoreDocument` saves on a debounce of about 2 seconds and again when the last user leaves, then the room unloads.
- **Element-level merging:** each player and each route is its own nested `Y.Map`, and route points are a `Y.Array`. Two people editing different players never conflict. Two people editing the same element merge field by field.
- **Command layer:** UI code never mutates Yjs directly. It calls typed commands in `lib/play/commands.ts`, such as `addPlayer`, `movePlayer(id, x, y)`, `addRoutePoint`, `setRouteStyle` and `deletePlayer`. Each command runs inside a `doc.transact()`.
- **Dragging:** while a user drags, `movePlayer` and point updates are written at about 30 per second so collaborators see the drag live.

## Rendering and playback

The pipeline runs independently in every client:

```
Y.Doc (local copy) ──observeDeep──▶ PlayModel (immutable snapshot) ──▶ render → SVG
      ▲                                     │
  commands.ts                               └──▶ simulate(model, t) → player positions
      │                                                   ▲
   UI events                              local requestAnimationFrame clock
```

1. **Model snapshot:** a hook (`useSyncExternalStore` plus `observeDeep`) converts the Y.Doc into an immutable `PlayModel`. Components read only this snapshot.
2. **Coordinates:** all geometry is stored in **yards**. x runs from 0 to 53.3 across the field, and y is yards from the line of scrimmage (positive is downfield). The SVG `viewBox` is set in yards, so no manual pixel conversion is needed. Zoom and pan only change the `viewBox`.
3. **Static render:** the field and yard lines, then a circle per player, then a path per route (Béziers for curve segments, `stroke-dasharray` for dashed routes, and an arrow or block end cap).
4. **Playback:** for each route, precompute a polyline sampled at a fixed resolution together with the cumulative distance along it, memoized per route. `simulate(model, t)` returns every player's position at time `t` seconds after the snap. A player is stationary until their `delay`, then has covered `speed × (t − delay)` yards along the path. A local `requestAnimationFrame` loop advances `t`. Play, pause and the scrubber are local only. If the model changes mid-playback, the next frame uses the new model.
5. **Presence layer:** other users' cursors and selection outlines come from Yjs awareness (in yards) and are drawn on top.

## Data model

**Postgres:**
```
plays          id, owner_id, name, ydoc_snapshot (bytea), thumbnail_url, created_at, updated_at
play_members   play_id, user_id, role ('owner' | 'editor' | 'viewer')   -- PK (play_id, user_id)
invites        id, play_id, email, role, token, expires_at
```
`plays.name` is mirrored from the document in `onStoreDocument`, so the dashboard can list plays without decoding snapshots.

**Yjs document (one per play):**
```
meta:     Y.Map  { name, formation, notes? }
players:  Y.Map<playerId, Y.Map { label, position, x, y, color }>
routes:   Y.Map<routeId,  Y.Map { playerId, points: Y.Array<{x, y, type: 'line'|'curve'}>,
                                  style: 'solid'|'dashed', endCap: 'arrow'|'block',
                                  speed: number, delay: number }>
```
A player can have more than one route; option routes are extra branches. Deleting a player deletes their routes in the same transaction.

**Local only (never synced):** viewport, selection, hover, playback time and playing state.

**Awareness (presence, not persisted):**
```
{ user: { id, name, color }, cursor: { x, y } | null, selectedIds: string[] }
```

## Auth and permissions

**Identity:** Supabase Auth (email and password, magic link, Google). The browser holds a short-lived access token (JWT) and a refresh token, and the Supabase client refreshes the access token automatically. `@supabase/ssr` stores the session in cookies so server components and middleware know who is logged in.

**Rules:**
- Always take identity from a **verified token** (`auth.uid()` in SQL, or a verified JWT in server code). Never trust a user ID or role sent by the client.
- **Enable RLS on every table.** RLS policies are the real permission check. UI checks are only for UX.
- The **secret / service-role key bypasses RLS**. Use it only in server code (Next.js server actions and route handlers, and Hocuspocus). It must never appear in client code or in a `NEXT_PUBLIC_` variable.

**Roles** (stored in `play_members.role`, checked through a SQL helper `play_role(play_id) returns text` that every policy uses):
| Role | View and run the play | Edit | Invite, rename and delete |
|---|---|---|---|
| owner | ✅ | ✅ | ✅ |
| editor | ✅ | ✅ | ❌ |
| viewer | ✅ | ❌ | ❌ |

**Collaboration server (`onAuthenticate`):**
1. The client connects with its current Supabase access token.
2. The server verifies the JWT against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` (projects on the legacy secret use `SUPABASE_JWT_SECRET` instead).
3. The server looks up `play_members` for `(documentName, user_id)`. With no row, the connection is rejected. A viewer connects with `connection.readOnly = true` and still sees live edits and presence. An editor or owner gets full access.
4. On reconnect, the client sends a freshly refreshed token.

**Invites:**
1. The owner creates an `invites` row with a random token, a role and `expires_at` (7 days), and the app emails `${NEXT_PUBLIC_SITE_URL}/invite/<token>`.
2. The recipient signs in, and a server action validates the token, inserts the `play_members` row and deletes the invite. This runs server-side because the recipient isn't a member yet.

## Environment variables

Documented in `.env.example`. Real values go in `.env.local`, which git ignores. In production they are set in the Vercel dashboard and with `fly secrets set`, never in git.
- **Public (`NEXT_PUBLIC_`, safe in the browser):** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publishable), `COLLAB_URL` and `SITE_URL`.
- **Secret (server only):** `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `SUPABASE_JWT_SECRET` (legacy projects only).

## Testing

- **Vitest:** geometry and `simulate` (including determinism, so the same model and `t` always give the same output), every command in `commands.ts`, and merging two Y.Docs with concurrent edits.
- **Playwright:** auth flows, the invite flow, and a two-browser-context test where two users edit the same play and each sees the other's change.
- **RLS:** SQL tests showing that a non-member can't read a play and a viewer can't update one.

## Conventions

- TypeScript `strict` mode, with no `any` in shared types.
- Keep geometry and route math in pure functions under `lib/field/`, with unit tests.
- All writes to a play go through `lib/play/commands.ts` into the Y.Doc, never straight to the `plays` table from the client.
- `render` and `simulate` must stay pure, with no `Math.random()`, `Date.now()` or per-client state inside them.
- Never put view state (zoom, selection or playback time) into the shared model.
- Every permission rule must exist as an RLS policy, and also in `onAuthenticate` for live sessions.
- Keep secrets in `.env.local` and document every variable in `.env.example`.

## Commands

_TBD once the project is scaffolded (`dev`, `build`, `test`, `lint`, and `dev:collab` for the Hocuspocus server)._

## Later (not in v1)

- **Shared playback:** a "coach presses play and everyone watches" mode, using an optional synced `{ playing, startedAt }` in awareness.
- **Playbooks:** folders that group plays.
- **Export:** PNG and PDF of a play, and an animated GIF of playback.
- **Scaling:** Hocuspocus Redis extension for multiple instances, or a move to Cloudflare Durable Objects.
