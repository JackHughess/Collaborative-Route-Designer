"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { playDuration, simulate } from "@/lib/field/geometry";
import type { PlayModel, Point } from "@/lib/play/types";

export const PLAYBACK_RATES = [0.25, 0.5, 1, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export interface Playback {
  t: number;
  duration: number;
  playing: boolean;
  rate: PlaybackRate;
  /** True once playback has started and until it is reset to the snap. */
  active: boolean;
  /** Player positions at t while active, otherwise null (draw the model as is). */
  positions: Record<string, Point> | null;
  toggle: () => void;
  restart: () => void;
  reset: () => void;
  seek: (t: number) => void;
  setRate: (rate: PlaybackRate) => void;
}

/**
 * Local playback clock. Time, play/pause and rate are never synced; every
 * client runs simulate(model, t) on its own copy of the model, so if the model
 * changes mid-playback the next frame simply uses the new one.
 */
export function usePlayback(model: PlayModel): Playback {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<PlaybackRate>(1);
  const duration = useMemo(() => playDuration(model), [model]);
  // Latest values for the animation loop and callbacks, without restarting them.
  const durationRef = useRef(duration);
  const tRef = useRef(t);
  useLayoutEffect(() => {
    durationRef.current = duration;
    tRef.current = t;
  });

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // TODO(exercise 4): advance the clock by the time since the last frame
      // (`now` and `last` are in ms; t is in seconds; respect `rate`), stop at
      // the end of the play, and otherwise ask for the next frame.
      // Read tRef/durationRef, not t/duration: this closure outlives renders.
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, rate]);

  const toggle = useCallback(() => {
    if (playing) return setPlaying(false);
    if (durationRef.current <= 0) return;
    if (tRef.current >= durationRef.current) setT(0);
    setPlaying(true);
  }, [playing]);

  const restart = useCallback(() => {
    setT(0);
    if (durationRef.current > 0) setPlaying(true);
  }, []);

  const reset = useCallback(() => {
    setPlaying(false);
    setT(0);
  }, []);

  const seek = useCallback((value: number) => {
    setT(Math.max(0, Math.min(durationRef.current, value)));
  }, []);

  const active = playing || t > 0;
  const positions = useMemo(
    () => (active ? simulate(model, Math.min(t, duration)) : null),
    [active, model, t, duration],
  );

  return {
    t: Math.min(t, duration),
    duration,
    playing,
    rate,
    active,
    positions,
    toggle,
    restart,
    reset,
    seek,
    setRate,
  };
}
