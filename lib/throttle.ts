/**
 * Calls `fn` at most once per `ms` with the latest arguments, plus a trailing
 * call so the last value always lands. `flush` runs any pending call now.
 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;

  const run = () => {
    timer = null;
    if (!pending) return;
    const args = pending;
    pending = null;
    last = Date.now();
    fn(...args);
  };

  return {
    call(...args: A) {
      pending = args;
      const wait = ms - (Date.now() - last);
      if (wait <= 0) {
        if (timer) clearTimeout(timer);
        run();
      } else if (!timer) {
        timer = setTimeout(run, wait);
      }
    },
    flush() {
      if (timer) clearTimeout(timer);
      run();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
