import Link from "next/link";
import { signOut } from "@/app/auth/actions";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <Link href="/dashboard" className="font-semibold">
        Route Designer
      </Link>
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden text-zinc-500 sm:inline">{email}</span>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
