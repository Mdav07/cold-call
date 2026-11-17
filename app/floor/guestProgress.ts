"use client";

// Progress for guests (not signed in). Guests all play as the shared demo player, whose clears are
// everyone's, so the tower would open for a brand-new browser. Instead a guest's floors open from what
// this browser has cleared: Floor 0 is always open; Floor N needs "cc-cleared-floor-(N-1)".
import { useSyncExternalStore } from "react";

const key = (floor: number) => `cc-cleared-floor-${floor}`;

export function markClearedHere(floor: number) {
  try {
    localStorage.setItem(key(floor), "1");
  } catch {}
}

function snapshot(): string {
  try {
    return [0, 1, 2, 3].map((f) => (localStorage.getItem(key(f)) ? "1" : "0")).join("");
  } catch {
    return "0000";
  }
}
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

/** Which floors this browser has cleared, e.g. [true, false, false, false]. Before hydration: none. */
export function useClearedHere(): boolean[] {
  const s = useSyncExternalStore(subscribe, snapshot, () => "0000");
  return s.split("").map((c) => c === "1");
}

/** A guest may stand on Floor N once this browser cleared Floor N-1. */
export const openForGuest = (cleared: boolean[], floor: number) => floor <= 0 || !!cleared[floor - 1];
