import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
  WebSocketStatus,
} from "@hocuspocus/provider";
import * as Y from "yjs";
import { throttle } from "@/lib/throttle";
import {
  isPresenceState,
  type Peer,
  type PresenceState,
  type PresenceUser,
} from "./presence";
import { fromByteaHex } from "./schema";
import type { Point } from "./types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface CollabState {
  status: ConnectionStatus;
  /** True once the server's copy has been merged in at least once. */
  synced: boolean;
  /** Local edits the server hasn't acknowledged yet. */
  unsyncedChanges: number;
  /** "readonly" for viewers, as decided by the server. */
  scope: "read-write" | "readonly" | null;
  authFailed: string | null;
  online: boolean;
  peers: readonly Peer[];
}

interface Options {
  url: string;
  playId: string;
  user: PresenceUser;
  /** Saved snapshot to show immediately, before the server answers. */
  snapshot: string | null;
  /** Returns a fresh Supabase access token for each (re)connect. */
  getToken: () => Promise<string>;
}

/**
 * Owns the Y.Doc, websocket and provider for one play. React subscribes to it
 * through useSyncExternalStore; connect/release are reference counted and the
 * teardown is deferred, so StrictMode's mount → unmount → mount doesn't drop
 * the connection.
 */
export class CollabSession {
  readonly doc = new Y.Doc();
  readonly provider: HocuspocusProvider;
  private readonly socket: HocuspocusProviderWebsocket;
  private state: CollabState;
  private listeners = new Set<() => void>();
  private refs = 0;
  private destroyTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private presence: PresenceState;

  constructor(private readonly options: Options) {
    // Seeding from the saved snapshot is safe: it's part of the same history,
    // so merging it with the server's state changes nothing.
    if (options.snapshot) Y.applyUpdate(this.doc, fromByteaHex(options.snapshot));

    this.presence = { user: options.user, cursor: null, selectedIds: [] };
    this.state = {
      status: "connecting",
      synced: false,
      unsyncedChanges: 0,
      scope: null,
      authFailed: null,
      // Node defines `navigator` without `onLine`; treat unknown as online so
      // the server render matches the client's first render.
      online: globalThis.navigator?.onLine ?? true,
      peers: [],
    };

    this.socket = new HocuspocusProviderWebsocket({
      url: options.url,
      autoConnect: false,
    });
    this.provider = new HocuspocusProvider({
      websocketProvider: this.socket,
      name: options.playId,
      document: this.doc,
      token: options.getToken,
      onStatus: ({ status }) => this.set({ status: toStatus(status) }),
      onSynced: ({ state }) => state && this.set({ synced: true }),
      onAuthenticated: ({ scope }) => this.set({ scope, authFailed: null }),
      onAuthenticationFailed: ({ reason }) => {
        this.set({ authFailed: reason || "Access denied" });
        // Don't keep retrying with credentials the server rejected.
        this.socket.disconnect();
      },
      onUnsyncedChanges: ({ number }) => this.set({ unsyncedChanges: number }),
      onAwarenessChange: () => this.set({ peers: this.readPeers() }),
    });
    this.provider.awareness?.setLocalState(this.presence);
  }

  // ── External store ────────────────────────────────────────────────

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private set(patch: Partial<CollabState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  /** Start (or keep) the connection. Returns a release function. */
  connect(): () => void {
    if (this.destroyed) throw new Error("session destroyed");
    this.refs++;
    if (this.destroyTimer) {
      clearTimeout(this.destroyTimer);
      this.destroyTimer = null;
    }
    if (this.refs === 1) {
      this.provider.attach();
      if (!this.state.authFailed) void this.socket.connect();
      window.addEventListener("online", this.onOnline);
      window.addEventListener("offline", this.onOffline);
    }
    return () => this.release();
  }

  private release() {
    this.refs--;
    if (this.refs > 0) return;
    this.destroyTimer = setTimeout(() => {
      if (this.refs > 0) return;
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("offline", this.onOffline);
      this.cursorWriter.cancel();
      this.provider.destroy();
      this.socket.destroy();
      this.doc.destroy();
      this.destroyed = true;
    }, 0);
  }

  private onOnline = () => {
    this.set({ online: true });
    if (!this.state.authFailed) void this.socket.connect();
  };

  private onOffline = () => this.set({ online: false });

  /** Send a refreshed access token on the open connection. */
  refreshToken() {
    if (this.state.status === "connected") void this.provider.sendToken();
  }

  /** Try again now instead of waiting for the backoff timer. */
  reconnect() {
    this.set({ authFailed: null });
    void this.socket.connect();
  }

  // ── Presence ──────────────────────────────────────────────────────

  private cursorWriter = throttle((cursor: Point | null) => {
    this.updatePresence({ cursor });
  }, 50);

  setCursor(cursor: Point | null) {
    this.cursorWriter.call(
      cursor && { x: Math.round(cursor.x * 10) / 10, y: Math.round(cursor.y * 10) / 10 },
    );
  }

  setSelection(selectedIds: string[]) {
    this.updatePresence({ selectedIds });
  }

  private updatePresence(patch: Partial<PresenceState>) {
    this.presence = { ...this.presence, ...patch };
    this.provider.awareness?.setLocalState(this.presence);
  }

  private readPeers(): Peer[] {
    const awareness = this.provider.awareness;
    if (!awareness) return [];
    const peers: Peer[] = [];
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === this.doc.clientID || !isPresenceState(state)) return;
      peers.push({ ...state, clientId });
    });
    return peers.sort((a, b) => a.clientId - b.clientId);
  }
}

function toStatus(status: WebSocketStatus): ConnectionStatus {
  switch (status) {
    case WebSocketStatus.Connected:
      return "connected";
    case WebSocketStatus.Connecting:
      return "connecting";
    default:
      return "disconnected";
  }
}
