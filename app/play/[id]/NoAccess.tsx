import Link from "next/link";
import { buttonPrimary } from "@/components/ui";

export function NoAccess() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Play not found</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        This play doesn&apos;t exist, or you don&apos;t have access to it. If
        someone shared it with you, ask them for a new invite link.
      </p>
      <Link href="/dashboard" className={buttonPrimary}>
        Back to my plays
      </Link>
    </main>
  );
}
