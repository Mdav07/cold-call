"use client";

// Seasonal lobby/room decor on/off (holiday weather and lobby dressing). Remembered in this browser.
// Only meaningful while a season is open; the Theme button hides itself otherwise.

import { useSyncExternalStore } from "react";

const KEY = "cc-season-theme";
const listeners = new Set<() => void>();
let on: boolean | null = null;

function read(): boolean {
  if (on == null) {
    try {
      // Default on: a season that is open should look seasonal until the player turns it off.
      const v = localStorage.getItem(KEY);
      on = v === null ? true : v === "1";
    } catch {
      on = true;
    }
  }
  return on;
}

export function setSeasonTheme(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}

export function useSeasonTheme(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => true,
  );
}
