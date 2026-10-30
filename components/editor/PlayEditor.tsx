"use client";

import Link from "next/link";
import { useState } from "react";
import * as Y from "yjs";
import { fromByteaHex } from "@/lib/play/schema";
import type { Role } from "@/lib/supabase/types";
import type { CurrentUser } from "@/lib/supabase/server";
import { Editor } from "./Editor";

interface Props {
  playId: string;
  initialName: string;
  snapshot: string | null;
  role: Role;
  user: CurrentUser;
}

/** Single-user editor on a local Y.Doc loaded from the saved snapshot (no sync yet). */
export function PlayEditor({ initialName, snapshot, role }: Props) {
  const [doc] = useState(() => {
    const d = new Y.Doc();
    if (snapshot) Y.applyUpdate(d, fromByteaHex(snapshot));
    return d;
  });

  return (
    <Editor
      doc={doc}
      readOnly={role === "viewer"}
      canRename={role === "owner"}
      header={
        <header className="flex items-center gap-3 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <Link
            href="/dashboard"
            className="text-sm underline-offset-2 hover:underline"
          >
            ← My plays
          </Link>
          <h1 className="truncate font-semibold">{initialName}</h1>
        </header>
      }
    />
  );
}
