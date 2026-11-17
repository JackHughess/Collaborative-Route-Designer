import type { CollabState } from "@/lib/play/collab";

/** Small status pill: saved, saving, connecting, offline. */
export function ConnectionStatus({ state }: { state: CollabState }) {
  const { status, synced, unsyncedChanges, online, authFailed } = state;

  let label: string;
  let tone: "ok" | "busy" | "bad";
  if (authFailed) {
    label = "No access";
    tone = "bad";
  } else if (!online) {
    label = "Offline";
    tone = "bad";
  } else if (status !== "connected") {
    label = status === "connecting" ? "Connecting…" : "Reconnecting…";
    tone = "busy";
  } else if (!synced || unsyncedChanges > 0) {
    label = "Saving…";
    tone = "busy";
  } else {
    label = "Saved";
    tone = "ok";
  }

  const dot =
    tone === "ok" ? "bg-emerald-500" : tone === "busy" ? "bg-amber-500" : "bg-red-500";

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${dot} ${tone === "busy" ? "animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
}
