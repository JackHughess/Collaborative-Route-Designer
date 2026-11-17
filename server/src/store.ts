import { createClient } from "@supabase/supabase-js";

export type Role = "owner" | "editor" | "viewer";

/** Everything the server needs from Postgres. */
export interface PlayStore {
  getRole(playId: string, userId: string): Promise<Role | null>;
  load(playId: string): Promise<Uint8Array | null>;
  save(playId: string, state: Uint8Array, name: string | null): Promise<void>;
}

function toHex(bytes: Uint8Array) {
  return "\\x" + Buffer.from(bytes).toString("hex");
}

function fromHex(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value.replace(/^\\x/, ""), "hex"));
}

/** Postgres access with the service-role key. It bypasses RLS, so only use it here. */
export function createSupabaseStore(options: {
  supabaseUrl: string;
  serviceRoleKey: string;
}): PlayStore {
  const db = createClient(options.supabaseUrl, options.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async getRole(playId, userId) {
      const { data, error } = await db
        .from("play_members")
        .select("role")
        .eq("play_id", playId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as Role | undefined) ?? null;
    },

    async load(playId) {
      const { data, error } = await db
        .from("plays")
        .select("ydoc_snapshot")
        .eq("id", playId)
        .maybeSingle();
      if (error) throw error;
      return data?.ydoc_snapshot ? fromHex(data.ydoc_snapshot as string) : null;
    },

    async save(playId, state, name) {
      const update: Record<string, string> = { ydoc_snapshot: toHex(state) };
      // Mirror the name so the dashboard can list plays without decoding snapshots.
      if (name) update.name = name;
      const { error } = await db.from("plays").update(update).eq("id", playId);
      if (error) throw error;
    },
  };
}
