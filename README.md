# Collaborative Route Designer

Design American football plays together in real time. Place players in a formation, draw each player's route (straight segments, curves, option branches), run the play to watch everyone move at once, and share it with collaborators who see each other's cursors and edits live.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres + RLS + Auth) · Yjs · Hocuspocus · Vitest · Playwright

## How it works

Only the **play model** is shared: players, routes and timing, stored as a Yjs document. Every edit goes through a typed command (`lib/play/commands.ts`), syncs through the Hocuspocus server to everyone in the play's room, and is saved to Postgres. Each browser draws the field and runs playback **locally** from its own copy of the model with pure functions (`lib/field/geometry.ts`), so nothing visual is ever sent over the wire.

```
 Browser A ──edits──▶ Hocuspocus room (one per play) ◀──edits── Browser B
 render + simulate             │                          render + simulate
                       Postgres snapshot (plays.ydoc_snapshot)
```

Permissions live in Postgres row-level security (`supabase/migrations/`), and the collaboration server re-checks membership on every connection, opening viewers read-only.

[CLAUDE.md](CLAUDE.md) has the full architecture, data model and conventions. [LEARNING.md](LEARNING.md) walks through the codebase as hands-on exercises.

## Getting started

Requirements: Node 24+, the Supabase CLI (`npx supabase`), and a Supabase project.

```bash
npm install
npm --prefix server install
cp .env.example .env.local      # fill in your Supabase URL and keys
npx supabase link --project-ref <your-project-ref>
npx supabase db push            # apply the migrations
```

Then run the two servers in separate terminals:

```bash
npm run dev          # web app on http://localhost:3000
npm run dev:collab   # collaboration server on ws://localhost:1234
```

## Tests

| Command | What it covers |
|---|---|
| `npm test` | Geometry, playback simulation, every command, concurrent-edit merging |
| `npm --prefix server test` | The collaboration server: auth, relaying, load and save, read-only viewers |
| `npm run test:db` | RLS policies, as pgTAP tests in a rolled-back transaction |
| `npm run test:e2e` | Sign in, invites, and two browsers editing one play (needs the `E2E_*` accounts) |

## Deploying

The web app deploys to Vercel and the collaboration server to Fly.io (`server/Dockerfile`, `server/fly.toml`). See the Deploying section of [CLAUDE.md](CLAUDE.md#deploying).
