"use client";

import Link from "next/link";
import { useEffect } from "react";
import { button, buttonPrimary } from "@/components/ui";

/** Catches unexpected errors in any page below the root layout. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <div role="alert" className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Your plays are safe: edits are saved as you go. Try again, or head back to
          your plays.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-zinc-500">Error id: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3">
          <button type="button" className={buttonPrimary} onClick={reset}>
            Try again
          </button>
          <Link href="/dashboard" className={button}>
            My plays
          </Link>
        </div>
      </div>
    </main>
  );
}
