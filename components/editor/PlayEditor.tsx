"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { button } from "@/components/ui";
import { CollabSession } from "@/lib/play/collab";
import { colorForUser } from "@/lib/play/presence";
import { usePlayModel } from "@/lib/play/usePlayModel";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/supabase/types";
import { ConnectionStatus } from "./ConnectionStatus";
import { Editor, type PresenceUpdate } from "./Editor";
import { PresenceAvatars } from "./PresenceAvatars";
import { ShareDialog } from "./ShareDialog";

interface Props {
  playId: string;
  snapshot: string | null;
  role: Role;
  user: { id: string; email: string; name: string };
}

const COLLAB_URL = process.env.NEXT_PUBLIC_COLLAB_URL ?? "ws://localhost:1234";

/** The editor connected to the collaboration server for one play. */
export function PlayEditor({ playId, snapshot, role, user }: Props) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [me] = useState(() => ({
    id: user.id,
    name: user.name || user.email,
    color: colorForUser(user.id),
  }));
  const [session] = useState(
    () =>
      new CollabSession({
        url: COLLAB_URL,
        playId,
        user: me,
        snapshot,
        getToken: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? "";
        },
      }),
  );
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const model = usePlayModel(session.doc);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => session.connect(), [session]);

  // Keep the live connection's token fresh, and leave if signed out elsewhere.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") session.refreshToken();
      if (event === "SIGNED_OUT") router.replace(`/login?next=/play/${playId}`);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase, session, router, playId]);

  const onPresence = useCallback(
    (update: Partial<PresenceUpdate>) => {
      if (update.cursor !== undefined) session.setCursor(update.cursor);
      if (update.selectedIds) session.setSelection(update.selectedIds);
    },
    [session],
  );

  // The server has the final say: a viewer's connection is read-only there too.
  const readOnly = role === "viewer" || state.scope === "readonly";

  let banner: React.ReactNode = null;
  if (state.authFailed) {
    banner = (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
      >
        You no longer have access to this play, or your session expired.
        <button type="button" className={button} onClick={() => router.refresh()}>
          Check again
        </button>
      </div>
    );
  } else if (!state.online || (state.synced && state.status === "disconnected")) {
    banner = (
      <div
        role="status"
        className="flex flex-wrap items-center gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      >
        {state.online
          ? "Lost connection to the server. Trying to reconnect…"
          : "You're offline."}{" "}
        {!readOnly && "Your edits are kept here and will sync when you're back."}
        {state.online && (
          <button type="button" className={button} onClick={() => session.reconnect()}>
            Retry now
          </button>
        )}
      </div>
    );
  } else if (readOnly) {
    banner = (
      <div
        role="status"
        className="bg-sky-50 px-4 py-2 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-200"
      >
        You&apos;re viewing this play. You can run it, but only editors can change it.
      </div>
    );
  }

  return (
    <>
      <Editor
        doc={session.doc}
        readOnly={readOnly}
        canRename={role === "owner"}
        peers={state.peers}
        onPresence={onPresence}
        banner={banner}
        header={
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <Link
              href="/dashboard"
              className="rounded text-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              <span aria-hidden="true">←</span> My plays
            </Link>
            <h1 className="min-w-0 flex-1 truncate font-semibold">{model.meta.name}</h1>
            <ConnectionStatus state={state} />
            <PresenceAvatars me={me} peers={state.peers} />
            {role === "owner" && (
              <button type="button" className={button} onClick={() => setShareOpen(true)}>
                Share
              </button>
            )}
          </header>
        }
      />
      {role === "owner" && (
        <ShareDialog
          playId={playId}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
