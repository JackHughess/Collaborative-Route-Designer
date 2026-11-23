const bar = "animate-pulse rounded bg-zinc-200 dark:bg-zinc-800";

/** Shown while the dashboard loads your plays. Mirrors the page's layout. */
export default function LoadingDashboard() {
  return (
    <div aria-busy="true">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Route Designer</span>
        <div className={`${bar} h-8 w-20`} />
      </div>
      <main className="mx-auto max-w-3xl space-y-8 p-4 sm:p-8">
        <section className="space-y-3">
          <h1 className="text-2xl font-semibold">My plays</h1>
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row sm:items-end dark:border-zinc-800">
            <div className={`${bar} h-10 flex-1`} />
            <div className={`${bar} h-10 sm:w-40`} />
            <div className={`${bar} h-10 sm:w-28`} />
          </div>
        </section>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 p-4">
              <div className="flex-1 space-y-2">
                <div className={`${bar} h-4 w-48`} />
                <div className={`${bar} h-3 w-32`} />
              </div>
              <div className={`${bar} h-7 w-16`} />
            </li>
          ))}
        </ul>
        <p role="status" className="sr-only">
          Loading your plays…
        </p>
      </main>
    </div>
  );
}
