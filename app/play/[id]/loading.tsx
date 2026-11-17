/** Shown while the server loads the play and checks your access. */
export default function LoadingPlay() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true">
      <div className="flex h-14 items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className="h-5 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="ml-auto h-8 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="flex flex-1 items-center justify-center bg-emerald-800/90">
        <p role="status" className="text-sm text-emerald-50">
          Loading play…
        </p>
      </div>
    </div>
  );
}
