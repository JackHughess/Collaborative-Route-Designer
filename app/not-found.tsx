import Link from "next/link";
import { buttonPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          There&apos;s nothing at this address.
        </p>
        <Link href="/dashboard" className={buttonPrimary}>
          Go to my plays
        </Link>
      </div>
    </main>
  );
}
