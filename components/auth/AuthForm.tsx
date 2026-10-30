"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  signInWithGoogle,
  submitAuth,
  type AuthState,
} from "@/app/auth/actions";

interface Props {
  mode: "login" | "signup";
  next: string;
  error?: string;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const primaryButton =
  "w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60";
const secondaryButton =
  "w-full rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function AuthForm({ mode, next, error }: Props) {
  const [useMagicLink, setUseMagicLink] = useState(false);
  const intent =
    mode === "signup" ? "signup" : useMagicLink ? "magic-link" : "login";
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    submitAuth,
    { error },
  );

  const title = mode === "signup" ? "Create an account" : "Sign in";
  const nextQuery =
    next === "/dashboard" ? "" : `?next=${encodeURIComponent(next)}`;

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="intent" value={intent} />
        {mode === "signup" && (
          <label className="block space-y-1">
            <span className="text-sm font-medium">Name</span>
            <input name="name" autoComplete="name" className={inputClass} />
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </label>
        {!useMagicLink && (
          <label className="block space-y-1">
            <span className="text-sm font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              className={inputClass}
            />
          </label>
        )}

        {state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        {state.message && (
          <p
            role="status"
            className="text-sm text-emerald-700 dark:text-emerald-400"
          >
            {state.message}
          </p>
        )}

        <button type="submit" disabled={pending} className={primaryButton}>
          {pending
            ? "Please wait…"
            : mode === "signup"
              ? "Sign up"
              : useMagicLink
                ? "Email me a sign-in link"
                : "Sign in"}
        </button>
      </form>

      {mode === "login" && (
        <button
          type="button"
          onClick={() => setUseMagicLink((v) => !v)}
          className="text-sm underline underline-offset-2"
        >
          {useMagicLink
            ? "Use a password instead"
            : "Email me a sign-in link instead"}
        </button>
      )}

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
        or
        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className={secondaryButton}>
          Continue with Google
        </button>
      </form>

      <p className="text-sm">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link
              href={`/login${nextQuery}`}
              className="underline underline-offset-2"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              href={`/signup${nextQuery}`}
              className="underline underline-offset-2"
            >
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
