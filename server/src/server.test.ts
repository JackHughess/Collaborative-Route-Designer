import { HocuspocusProvider } from "@hocuspocus/provider";
import type { Server } from "@hocuspocus/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { VerifyToken } from "./auth.ts";
import { createCollabServer, type CollabContext } from "./server.ts";
import type { PlayStore, Role } from "./store.ts";

const PLAY = "11111111-1111-4111-8111-111111111111";

// Tokens in these tests are "user:<id>"; anything else fails verification.
const verifyToken: VerifyToken = async (token) => {
  if (!token.startsWith("user:")) throw new Error("bad token");
  return { id: token.slice(5) };
};

function fakeStore(roles: Record<string, Role>, snapshot?: Uint8Array) {
  const saved: { state: Uint8Array; name: string | null }[] = [];
  const store: PlayStore = {
    getRole: async (playId, userId) => (playId === PLAY ? (roles[userId] ?? null) : null),
    load: async () => snapshot ?? null,
    save: async (_id, state, name) => {
      saved.push({ state, name });
    },
  };
  return { store, saved };
}

let server: Server<CollabContext>;
const providers: HocuspocusProvider[] = [];

async function start(store: PlayStore) {
  server = createCollabServer({ verifyToken, store, port: 0, debounce: 50, quiet: true, log: () => {} });
  await server.listen();
}

function connect(token: string, name = PLAY) {
  const doc = new Y.Doc();
  const events = { failed: null as string | null, scope: null as string | null };
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${server.address.port}`,
    name,
    document: doc,
    token,
    onAuthenticationFailed: ({ reason }) => (events.failed = reason),
    onAuthenticated: ({ scope }) => (events.scope = scope),
  });
  providers.push(provider);
  return { doc, provider, events };
}

const until = (check: () => boolean, ms = 3000) =>
  vi.waitFor(() => expect(check()).toBe(true), { timeout: ms, interval: 20 });

beforeEach(() => {
  providers.length = 0;
});

afterEach(async () => {
  for (const p of providers) p.destroy();
  await server?.destroy();
});

describe("collaboration server", () => {
  it("relays edits between two editors", async () => {
    await start(fakeStore({ a: "owner", b: "editor" }).store);
    const a = connect("user:a");
    const b = connect("user:b");
    await until(() => a.provider.isSynced && b.provider.isSynced);

    a.doc.getMap("players").set("p1", new Y.Map([["x", 5]]));
    await until(() => b.doc.getMap("players").has("p1"));
    b.doc.getMap("meta").set("name", "From B");
    await until(() => a.doc.getMap("meta").get("name") === "From B");
  });

  it("loads the saved snapshot when the first person joins", async () => {
    const seed = new Y.Doc();
    seed.getMap("meta").set("name", "Saved play");
    await start(fakeStore({ a: "owner" }, Y.encodeStateAsUpdate(seed)).store);
    const a = connect("user:a");
    await until(() => a.provider.isSynced);
    expect(a.doc.getMap("meta").get("name")).toBe("Saved play");
  });

  it("saves after edits, mirroring the play name", async () => {
    const { store, saved } = fakeStore({ a: "owner" });
    await start(store);
    const a = connect("user:a");
    await until(() => a.provider.isSynced);
    a.doc.getMap("meta").set("name", "  Mesh  ");
    await until(() => saved.length > 0);
    const last = saved[saved.length - 1];
    expect(last.name).toBe("Mesh");
    const copy = new Y.Doc();
    Y.applyUpdate(copy, last.state);
    expect(copy.getMap("meta").get("name")).toBe("  Mesh  ");
  });

  it("gives viewers a read-only connection: they see edits but can't make them", async () => {
    await start(fakeStore({ a: "owner", v: "viewer" }).store);
    const a = connect("user:a");
    const v = connect("user:v");
    await until(() => a.provider.isSynced && v.provider.isSynced);
    expect(v.events.scope).toBe("readonly");
    expect(a.events.scope).toBe("read-write");

    a.doc.getMap("meta").set("name", "Owner edit");
    await until(() => v.doc.getMap("meta").get("name") === "Owner edit");

    v.doc.getMap("meta").set("notes", "viewer edit");
    // Give the server time to (not) relay it.
    await new Promise((r) => setTimeout(r, 300));
    expect(a.doc.getMap("meta").get("notes")).toBeUndefined();
  });

  it("rejects people who aren't members", async () => {
    await start(fakeStore({ a: "owner" }).store);
    const x = connect("user:stranger");
    await until(() => x.events.failed !== null);
    expect(x.provider.isSynced).toBe(false);
  });

  it("rejects invalid tokens and unknown rooms", async () => {
    await start(fakeStore({ a: "owner" }).store);
    const bad = connect("not-a-token");
    const wrongRoom = connect("user:a", "not-a-uuid");
    await until(() => bad.events.failed !== null && wrongRoom.events.failed !== null);
  });

  it("answers health checks", async () => {
    await start(fakeStore({}).store);
    const res = await fetch(`http://127.0.0.1:${server.address.port}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
