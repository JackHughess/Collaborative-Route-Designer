import { Database } from "@hocuspocus/extension-database";
import { Server, type onAuthenticatePayload } from "@hocuspocus/server";
import * as Y from "yjs";
import type { VerifyToken } from "./auth.ts";
import type { PlayStore, Role } from "./store.ts";

export interface CollabContext {
  userId: string;
  role: Role;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CollabServerOptions {
  verifyToken: VerifyToken;
  store: PlayStore;
  port?: number;
  /** ms to wait after the last change before saving (CLAUDE.md: about 2 s). */
  debounce?: number;
  quiet?: boolean;
  log?: (message: string, error?: unknown) => void;
}

function playName(document: Y.Doc): string | null {
  const name = document.getMap("meta").get("name");
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : null;
}

/**
 * One room per play, keyed by play id. Every connection is checked against
 * play_members; viewers get a read-only connection, so the server drops any
 * document updates they send while still relaying presence.
 */
export function createCollabServer(options: CollabServerOptions) {
  const { verifyToken, store } = options;
  const log = options.log ?? ((m, e) => console.error(m, e ?? ""));

  async function authorize(token: string, playId: string): Promise<CollabContext> {
    if (!UUID.test(playId)) throw new Error("invalid play id");
    const user = await verifyToken(token);
    const role = await store.getRole(playId, user.id);
    if (!role) throw new Error("not a member of this play");
    return { userId: user.id, role };
  }

  return new Server<CollabContext>({
    name: "route-designer",
    port: options.port ?? 1234,
    quiet: options.quiet ?? false,
    debounce: options.debounce ?? 2000,
    maxDebounce: 10000,
    // Save as soon as the last person leaves, then unload the room.
    unloadImmediately: true,

    async onAuthenticate({
      token,
      documentName,
      connectionConfig,
    }: onAuthenticatePayload<CollabContext>) {
      try {
        const context = await authorize(token, documentName);
        connectionConfig.readOnly = context.role === "viewer";
        return context;
      } catch (error) {
        // Hocuspocus rejects the connection when this throws.
        log(`auth rejected for ${documentName}`, error);
        throw error;
      }
    },

    // Clients send a refreshed token on reconnect and before it expires.
    // Re-check membership so removed users and changed roles take effect.
    async onTokenSync({ token, documentName, connectionConfig, context }) {
      const next = await authorize(token, documentName);
      if (next.userId !== context.userId) throw new Error("token is for another user");
      context.role = next.role;
      connectionConfig.readOnly = next.role === "viewer";
    },

    async onRequest({ request, response }) {
      if (request.url === "/health") {
        response.writeHead(200, { "Content-Type": "text/plain" });
        response.end("ok");
        // Hocuspocus treats a rejected promise as "handled, stop here".
        throw null;
      }
    },

    extensions: [
      new Database({
        fetch: async ({ documentName }) => {
          if (!UUID.test(documentName)) return null;
          return store.load(documentName);
        },
        store: async ({ documentName, document, state }) => {
          try {
            await store.save(documentName, new Uint8Array(state), playName(document));
          } catch (error) {
            log(`failed to save ${documentName}`, error);
            throw error;
          }
        },
      }),
    ],
  });
}
