"use client";

import { useId } from "react";
import { button, buttonPrimary } from "@/components/ui";
import {
  PLAYBACK_RATES,
  type Playback,
  type PlaybackRate,
} from "./usePlayback";

export function PlaybackBar({ playback }: { playback: Playback }) {
  const id = useId();
  const { t, duration, playing, rate } = playback;
  const empty = duration <= 0;

  return (
    <div
      role="group"
      aria-label="Playback"
      className="flex flex-wrap items-center gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <button
        type="button"
        className={`${buttonPrimary} w-20`}
        onClick={playback.toggle}
        disabled={empty}
        aria-keyshortcuts="Space"
        title={empty ? "Draw a route to run the play" : "Play or pause (Space)"}
      >
        {playing ? "Pause" : t >= duration && t > 0 ? "Replay" : "Play"}
      </button>
      <button
        type="button"
        className={button}
        onClick={playback.restart}
        disabled={empty}
        aria-keyshortcuts="K"
        title="Restart from the snap (K)"
      >
        Restart
      </button>
      <button
        type="button"
        className={button}
        onClick={playback.reset}
        disabled={!playback.active}
        title="Stop and show the formation"
      >
        Reset
      </button>

      <label htmlFor={`${id}-scrub`} className="sr-only">
        Time after the snap
      </label>
      <input
        id={`${id}-scrub`}
        type="range"
        min={0}
        max={Math.max(duration, 0.01)}
        step={0.01}
        value={t}
        disabled={empty}
        onChange={(e) => playback.seek(e.target.valueAsNumber)}
        className="min-w-32 flex-1 accent-emerald-600"
        aria-valuetext={`${t.toFixed(1)} of ${duration.toFixed(1)} seconds`}
      />
      <span className="w-24 text-right text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
        {t.toFixed(1)}s / {duration.toFixed(1)}s
      </span>

      <label htmlFor={`${id}-rate`} className="sr-only">
        Playback speed
      </label>
      <select
        id={`${id}-rate`}
        value={rate}
        onChange={(e) =>
          playback.setRate(Number(e.target.value) as PlaybackRate)
        }
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {PLAYBACK_RATES.map((r) => (
          <option key={r} value={r}>
            {r}×
          </option>
        ))}
      </select>
    </div>
  );
}
