"use client";

// Small hooks for reading browser-only state the way React 19 expects (no setState inside effects,
// no ref writes during render). Shared by the floors, the lobby and the play screens.

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

/** A ref that always holds the latest `value`, for callbacks and animation loops. Updated after render. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

const noSubscribe = () => () => {};

/**
 * A value read from the browser (localStorage and the like): `server` during server render and
 * hydration, then `read()`. `read` must return a primitive (or the same object) for the same state.
 */
export function useClientValue<T>(read: () => T, server: T, subscribe: (onChange: () => void) => () => void = noSubscribe): T {
  return useSyncExternalStore(subscribe, read, () => server);
}

/** Whether a CSS media query matches, live. False on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia?.(query);
      mq?.addEventListener("change", onChange);
      return () => mq?.removeEventListener("change", onChange);
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
