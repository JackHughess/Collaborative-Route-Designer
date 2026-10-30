import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { DEFAULT_FORMATION_ID, FORMATIONS } from "@/lib/play/formations";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createPlay, deletePlay, leavePlay } from "./actions";

export const metadata: Metadata = { title: "My plays · Route Designer" };

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser("/dashboard");
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: rows, error: loadError } = await supabase
    .from("play_members")
    .select("role, plays(id, name, updated_at)")
    .eq("user_id", user.id);

  const plays = (rows ?? [])
    .flatMap((row) => (row.plays ? [{ ...row.plays, role: row.role }] : []))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const message = error ?? loadError?.message;

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-3xl space-y-8 p-4 sm:p-8">
        <section aria-labelledby="new-play" className="space-y-3">
          <h1 id="new-play" className="text-2xl font-semibold">
            My plays
          </h1>
          <form
            action={createPlay}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row sm:items-end dark:border-zinc-800"
          >
            <label className="flex-1 space-y-1">
              <span className="text-sm font-medium">Play name</span>
              <input
                name="name"
                placeholder="Mesh concept"
                maxLength={120}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 focus:outline-2 focus:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Formation</span>
              <select
                name="formation"
                defaultValue={DEFAULT_FORMATION_ID}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 focus:outline-2 focus:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {FORMATIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              New play
            </button>
          </form>
        </section>

        {message && (
          <p
            role="alert"
            className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {message}
          </p>
        )}

        {plays.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
            No plays yet. Create your first one above.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {plays.map((play) => (
              <li key={play.id} className="flex items-center gap-3 p-4">
                <Link
                  href={`/play/${play.id}`}
                  className="min-w-0 flex-1 rounded focus-visible:outline-2 focus-visible:outline-emerald-600"
                >
                  <span className="block truncate font-medium">
                    {play.name}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {play.role !== "owner" && (
                      <span className="capitalize">{play.role} · </span>
                    )}
                    Updated {dateFormat.format(new Date(play.updated_at))}
                  </span>
                </Link>
                <form action={play.role === "owner" ? deletePlay : leavePlay}>
                  <input type="hidden" name="id" value={play.id} />
                  <ConfirmSubmit
                    message={
                      play.role === "owner"
                        ? `Delete “${play.name}” for everyone? This can't be undone.`
                        : `Leave “${play.name}”? You'll need a new invite to rejoin.`
                    }
                    label={`${play.role === "owner" ? "Delete" : "Leave"} ${play.name}`}
                    className="rounded-md px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    {play.role === "owner" ? "Delete" : "Leave"}
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
