// Shared Tailwind class strings for small controls.

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500";

export const button = `inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 ${focusRing}`;

export const buttonPrimary = `inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const buttonDanger = `inline-flex items-center justify-center gap-1.5 rounded-md border border-red-300 px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 ${focusRing}`;

/** Toggle button; pair with aria-pressed. */
export function toggle(active: boolean) {
  return `inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
    active
      ? "border-emerald-600 bg-emerald-600 text-white"
      : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
  }`;
}

export const input =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-60 focus:outline-2 focus:outline-offset-0 focus:outline-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export const label =
  "block text-xs font-medium text-zinc-600 dark:text-zinc-400";
