"use client";

import { useMemo, useSyncExternalStore } from "react";
import type * as Y from "yjs";
import { PlayStore } from "./snapshot";
import type { PlayModel } from "./types";

/** Immutable snapshot of the play, updated after every transaction on the doc. */
export function usePlayModel(doc: Y.Doc): PlayModel {
  const store = useMemo(() => new PlayStore(doc), [doc]);
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}
