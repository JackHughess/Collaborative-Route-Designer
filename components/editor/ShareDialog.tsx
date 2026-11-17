"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  changeMemberRole,
  createInvite,
  loadSharing,
  removeMember,
  revokeInvite,
  type Member,
  type PendingInvite,
} from "@/app/play/[id]/sharing";
import { button, buttonDanger, buttonPrimary, input, label } from "@/components/ui";

interface Props {
  playId: string;
  open: boolean;
  onClose: () => void;
}

const expiry = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={button}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

/**
 * Owner-only sharing: create invite links (sent by the owner however they like;
 * the app sends no email), list members, change roles and remove people.
 */
export function ShareDialog({ playId, open, onClose }: Props) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const result = await loadSharing(playId);
    if (result.ok) {
      setMembers(result.members);
      setInvites(result.invites);
    } else {
      setError(result.error);
    }
    setLoaded(true);
  }, [playId]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      startTransition(refresh);
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, refresh]);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      await refresh();
    });

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby={`${id}-title`}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          Share this play
        </h2>
        <button type="button" className={button} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5 text-sm">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const target = e.currentTarget;
            startTransition(async () => {
              setError(null);
              const result = await createInvite(
                playId,
                form.get("role"),
                String(form.get("email") ?? ""),
              );
              if (result.ok) {
                setNewLink(result.url);
                target.reset();
              } else {
                setError(result.error);
              }
              await refresh();
            });
          }}
        >
          <p className="text-zinc-600 dark:text-zinc-400">
            Create a link and send it to your collaborator yourself. Anyone with the
            link can join after signing in, so share it privately. Links expire after 7
            days and work once.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="space-y-1">
              <label htmlFor={`${id}-email`} className={label}>
                Who is it for? (optional, just a note)
              </label>
              <input
                id={`${id}-email`}
                name="email"
                placeholder="coach@example.com"
                className={input}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-role`} className={label}>
                Role
              </label>
              <select id={`${id}-role`} name="role" defaultValue="editor" className={input}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" className={buttonPrimary} disabled={pending}>
              Create link
            </button>
          </div>
          {newLink && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-md bg-emerald-50 p-3 dark:bg-emerald-950"
            >
              <label htmlFor={`${id}-link`} className="sr-only">
                Invite link
              </label>
              <input
                id={`${id}-link`}
                readOnly
                value={newLink}
                className={`${input} flex-1 font-mono text-xs`}
                onFocus={(e) => e.currentTarget.select()}
              />
              <CopyButton text={newLink} />
            </div>
          )}
        </form>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section aria-labelledby={`${id}-members`} className="space-y-2">
          <h3 id={`${id}-members`} className="font-semibold">
            People with access
          </h3>
          {!loaded ? (
            <p className="text-zinc-500">Loading…</p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {members.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.name}
                      {m.isYou && " (you)"}
                    </p>
                    {m.name !== m.email && (
                      <p className="truncate text-xs text-zinc-500">{m.email}</p>
                    )}
                  </div>
                  {m.role === "owner" ? (
                    <span className="text-zinc-500">Owner</span>
                  ) : (
                    <>
                      <label className="sr-only" htmlFor={`${id}-role-${m.userId}`}>
                        Role for {m.name}
                      </label>
                      <select
                        id={`${id}-role-${m.userId}`}
                        className={`${input} w-auto`}
                        value={m.role}
                        disabled={pending}
                        onChange={(e) =>
                          run(() => changeMemberRole(playId, m.userId, e.target.value))
                        }
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        type="button"
                        className={buttonDanger}
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`Remove ${m.name} from this play?`)) {
                            run(() => removeMember(playId, m.userId));
                          }
                        }}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {invites.length > 0 && (
          <section aria-labelledby={`${id}-invites`} className="space-y-2">
            <h3 id={`${id}-invites`} className="font-semibold">
              Pending invite links
            </h3>
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {invites.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {invite.email || "Anyone with the link"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      <span className="capitalize">{invite.role}</span> · expires{" "}
                      {expiry.format(new Date(invite.expiresAt))}
                    </p>
                  </div>
                  <CopyButton text={invite.url} />
                  <button
                    type="button"
                    className={buttonDanger}
                    disabled={pending}
                    onClick={() => run(() => revokeInvite(invite.id))}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </dialog>
  );
}
