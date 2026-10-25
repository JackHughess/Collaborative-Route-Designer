# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Collaborative Route Designer** is a web app for drawing American football routes and plays.
Users sign in, save their work to a database, and invite others to edit the same play together in real time.

### Core features
- **Accounts:** sign up, sign in and sign out. Each user owns their plays.
- **Route editor:** a football field where you place players and draw routes for them (straight segments, curves, breaks, option routes).
- **Persistence:** every play is saved to the database under the owner's account and autosaves while you edit.
- **Real-time collaboration:** several users edit one play at the same time and see each other's cursors and changes live.
- **Sharing:** the owner invites collaborators by email or link with a role of `editor` or `viewer`.

## Core architecture principle: sync the model, render locally

The **play model** is the only thing that is shared. It holds the players, their positions, routes, timing and metadata.
- Clients send **edits to elements** (move player, add route point, change route type). They never send pixels, frames or animation state.
- Every client builds its own view of the play **independently** from the model: the field drawing, the "run the play" animation, zoom and pan, the selected element and the playback position. All of that is local and never synced.
- Rendering and simulation must therefore be **deterministic**: `render(model)` and `simulate(model, t)` are pure functions, so every client shows the same play from the same model.
- The only ephemeral data that is shared is **presence** (who is here, their cursor, what they have selected). It is never persisted.

```
 Client A                  Sync layer                 Client B
 edit element ──ops──▶  shared play model  ◀──ops── edit element
 render(model) ◀──updates──     │      ──updates──▶ render(model)
 simulate(model,t)              ▼                   simulate(model,t)
 (local playback)        Postgres snapshot          (local playback)
```

## Design decisions

> Status: **PROPOSED.** Each section lists the options and a recommendation. Once a decision is made, replace the section with the final choice and delete the alternatives.

### 1. Frontend framework
| Option | Notes |
|---|---|
| **Next.js (App Router) + TypeScript** ⭐ | One codebase for UI and server routes, deploys easily to Vercel, large ecosystem |
| Vite + React SPA | Simpler, but you need a separate backend |
| SvelteKit | Lightweight, but has fewer collaboration and canvas libraries |

**Recommendation:** Next.js + TypeScript + Tailwind CSS.

### 2. Backend, database and auth
| Option | Notes |
|---|---|
| **Supabase** ⭐ | Hosted Postgres with auth, row-level security (RLS) and storage. Very little backend code |
| Next.js API routes + Postgres (Prisma or Drizzle) + Auth.js | Full control, but more code to own |
| Firebase | Easy realtime, but NoSQL makes sharing and permission queries awkward |

**Recommendation:** Supabase. Permissions are enforced with RLS policies so the database itself is the security boundary.

### 3. Real-time collaboration
| Option | Notes |
|---|---|
| **Yjs (CRDT)** ⭐ | Conflict-free merging of simultaneous edits, offline support and presence via awareness. Needs a sync server (y-websocket or Hocuspocus) or a hosted provider |
| Liveblocks | Managed service with presence built in. Fastest to ship, but paid and creates vendor lock-in |
| Supabase Realtime broadcast | Simple, but last-write-wins, so two people dragging the same point overwrite each other |
| Turn-based locking | Simplest, but editing is not truly simultaneous |
| Server-authoritative op log (custom) | Clients send typed ops (`movePlayer`, `addRoutePoint`…), the server validates them, assigns a version and broadcasts. Clean "edit elements only" API, but you write the conflict handling yourself |

**Recommendation:** Yjs. It fits the "sync the model, render locally" principle directly: the Yjs document *is* the play model, edits are element-level ops, and each client renders from its local copy. Put a typed command layer (`lib/play/commands.ts`) on top so UI code calls `movePlayer(id, x, y)` instead of mutating Yjs directly. The Yjs document is the live source of truth during a session and is snapshotted to Postgres periodically and when the last user leaves.
**Open question:** should playback be shared, with a "coach presses play and everyone watches" mode? The default is no and playback stays local, but an optional synced `{playing, startedAt}` presence field could add it later.

#### Hosting collaborative sessions
A session is one **room per play**, keyed by play id. When the first user joins, the server loads the snapshot from Postgres. It relays updates while users edit, saves on a debounce and when the last user leaves, and then unloads the room.

| Option | Notes |
|---|---|
| **Hocuspocus on Fly.io/Railway/Render** ⭐ | Open-source Yjs server with hooks for `onAuthenticate` (verify the Supabase JWT and play role), `onLoadDocument` and `onStoreDocument` (Postgres). About $5/month for one always-on instance. Running several instances needs the Redis extension |
| Cloudflare Durable Objects (PartyServer / y-partyserver) | Each play gets its own object, so rooms are isolated. Scales automatically, hibernates when idle and is cheap. Code runs in the Workers runtime |
| Hosted Yjs: Liveblocks, Y-Sweet (Jamsocket), Tiptap Cloud | No server to run. Paid per connection or room and creates vendor lock-in |
| Supabase Realtime as a relay | Uses infrastructure you already have. There is no server-side document, so persistence and validation fall on the clients. Fragile |
| Peer-to-peer (y-webrtc) | Needs only a signaling server, but nobody holds the document when all peers leave, and NAT issues arise. Not suitable |

**Recommendation:** Hocuspocus on Fly.io for v1, because it is the simplest path with full control over auth and persistence. Durable Objects is the upgrade path if you need scale-to-zero or many concurrent rooms.
**Open question:** should viewers connect read-only? Hocuspocus supports this through `connection.readOnly` in `onAuthenticate`.

### 4. Field rendering
| Option | Notes |
|---|---|
| **SVG + React** ⭐ | Easy hit-testing and styling, clean export to PNG or PDF, and fast enough for about 22 players |
| Konva (react-konva) | Canvas-based, better for heavy animation |
| tldraw SDK | A full whiteboard engine with multiplayer. Opinionated, and check its license |

**Recommendation:** SVG. Store all geometry in **field coordinates measured in yards** (x is 0–53.3 across the field, y is yards from the line of scrimmage), never in pixels. Convert to screen coordinates only at render time.
**Playback:** each client animates the play locally with `simulate(model, t)`, which returns every player's position at time `t` based on route geometry, player speed and any timing delays stored in the model. Drive it with `requestAnimationFrame`. Nothing about playback is written back to the model.

### 5. Data model (draft)
```
users          (managed by the auth provider)
playbooks      id, owner_id, name, created_at
plays          id, playbook_id, owner_id, name, formation, ydoc_snapshot (bytea), updated_at
play_members   play_id, user_id, role ('owner' | 'editor' | 'viewer')
invites        id, play_id, email, role, token, expires_at
```
**Decided:** each route is its own play, saved as its own row in `plays` with its own collaborative session. Every client runs the route locally with `simulate(model, t)`.
Inside the Yjs document for each play (one route):
```
player:  Map<{ label, position, x, y, color }>
route:   Map<{ points: Array<{x, y, type: 'line'|'curve'}>, style: 'solid'|'dashed', endCap: 'arrow'|'block', speed?: number, delay?: number }>
meta:    Map<{ name, snapCount? }>
```
Not in the document, because it is local per client: viewport, selection, playback time and hover state. Presence goes over Yjs awareness:
```
awareness: { user: {id, name, color}, cursor: {x, y} | null, selectedIds: string[] }
```
**Open question:** will several routes later be combined into one multi-player play, either by referencing route plays or by copying them in?

### 6. MVP scope
| Option | Notes |
|---|---|
| Single routes only | Smallest build, but a single route is rarely useful alone |
| **Plays (formation + routes)** ⭐ | Matches how coaches think |
| Playbooks + plays + animated playback | Larger first release |

**Recommendation:** plays first, playbooks as a simple folder next, and animation later.

### 7. Hosting
**Recommendation:** Vercel for the Next.js app, Supabase for the database and auth, and Fly.io or Railway for the WebSocket sync server (Vercel serverless can't hold long-lived WebSockets).

### 8. Testing
**Recommendation:** Vitest for unit tests (geometry helpers and the Yjs document schema) and Playwright for end-to-end tests, including one test that opens two browser contexts on the same play to verify live sync.

## Auth and permissions

**Identity:** Supabase Auth (email and password, magic link, Google). The browser holds a short-lived access token (JWT) and a refresh token. The Supabase client library refreshes the access token automatically. In Next.js, use `@supabase/ssr` so the session is also stored in cookies and server components and middleware can see who is logged in.

**Rules:**
- Always take the user's identity from a **verified token** (`auth.uid()` in SQL, or the verified JWT in server code). Never trust a user ID or role sent by the client.
- **Enable RLS on every table.** A table without RLS can be read by anyone who has the public key.
- RLS policies are the real permission check. Hiding buttons in the UI is only for UX.
- The **secret / service-role key bypasses RLS**. Use it only in server-side code (Next.js server actions and route handlers, and the Hocuspocus server). It must never appear in client code or in a `NEXT_PUBLIC_` variable.

**Roles** (stored in `play_members.role`):
| Role | Read | Edit | Invite, rename and delete |
|---|---|---|---|
| owner | ✅ | ✅ | ✅ |
| editor | ✅ | ✅ | ❌ |
| viewer | ✅ | ❌ | ❌ |

Put role checks in a SQL helper, such as `play_role(play_id) returns text`, so every policy uses the same logic.

**Collaboration server (Hocuspocus `onAuthenticate`):**
1. The client connects with `token` set to its current Supabase access token.
2. The server verifies the JWT. Newer Supabase projects use asymmetric signing keys verified against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, so no secret is needed. Projects on the legacy key use `SUPABASE_JWT_SECRET`.
3. The server looks up `play_members` for `(play_id = documentName, user_id)`. With no row, reject the connection. A `viewer` connects with `connection.readOnly = true`. An `editor` or `owner` gets full access.
4. Loading and saving the document use the secret key on the server.
5. When the client reconnects, it sends a freshly refreshed token.

**Invites:**
1. The owner creates an `invites` row with a random token (`crypto.randomUUID()` or 32 random bytes), a role and `expires_at`, then emails `${SITE_URL}/invite/<token>`.
2. The recipient signs in. A server action validates the token and its expiry, inserts the `play_members` row and deletes the invite. This runs server-side because the recipient isn't a member yet, so RLS would block them.

## Environment variables

Documented in `.env.example`. Real values go in `.env.local`, which git ignores. In production they go into the Vercel and Fly.io dashboards or secrets, never into git.
- **Public (safe in the browser):** the Supabase URL, the publishable/anon key, the collaboration WebSocket URL and the site URL. These are prefixed with `NEXT_PUBLIC_`.
- **Secret (server only):** the Supabase secret/service-role key, the email provider API key, and `SUPABASE_JWT_SECRET` (legacy projects only).

## Conventions (once code exists)
- TypeScript `strict` mode, with no `any` in shared types.
- Keep geometry and route math in pure functions under `lib/field/` and unit test them.
- All writes to a shared play go through the command layer (`lib/play/commands.ts`) into the Yjs document, never straight to the database.
- `render` and `simulate` must stay pure and deterministic, with no `Math.random()`, `Date.now()` or per-client state inside them.
- Never put view state (zoom, selection, playback time) into the shared model.
- Every permission check must also exist as an RLS policy. Client-side checks are only for UX.
- Keep secrets in `.env.local` (git-ignored) and document required variables in `.env.example`.

## Commands
_TBD once the project is scaffolded (`dev`, `build`, `test`, `lint`)._
