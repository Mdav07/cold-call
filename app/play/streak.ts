"use client";

// The Daily Case streak on the client: the signed-in player's streak from /api/session/streak, or, for
// guests, this browser's own clears (cc-daily-cleared-<date>, set by markDailyCleared on a real breach of
// today's case). Also the streak rewards: hunter looks that unlock at a number of days in a row.

import { useEffect, useState, useSyncExternalStore } from "react";
import { todayUtc } from "@/shared/dailyCase";

export interface StreakReward {
  days: number;
  sprite: string; // hunter sprite id
  label: string;
}

/** Hunter looks earned by streaks (best streak, so they stay unlocked once earned). */
export const STREAK_REWARDS: StreakReward[] = [
  { days: 3, sprite: "hunter-1", label: "Aqua Ari" },
  { days: 7, sprite: "hunter-5", label: "Lime Leo" },
];

export interface Streak {
  current: number;
  best: number;
  clearedToday: boolean;
  guest: boolean;
}

const clearedKey = (date: string) => `cc-daily-cleared-${date}`;
const BEST_KEY = "cc-streak-best"; // the best streak seen in this browser, for unlocking rewards offline
const EVENT = "coldcall-streak";

const DAY = 86_400_000;
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

function has(date: string): boolean {
  try {
    return window.localStorage.getItem(clearedKey(date)) === "1";
  } catch {
    return false;
  }
}

/** Call once a guest (or anyone) breaches today's Daily Case for real (not a practice replay). */
export function markDailyCleared(date: string = todayUtc()): void {
  try {
    window.localStorage.setItem(clearedKey(date), "1");
  } catch {
    // blocked storage: the streak just won't be remembered here
  }
  rememberBest(localStreak().best);
  window.dispatchEvent(new Event(EVENT));
}

/** This browser's streak from its own clears (looks back a year at most). */
export function localStreak(today: string = todayUtc()): Omit<Streak, "guest"> {
  const clearedToday = has(today);
  let current = 0;
  for (let d = clearedToday ? today : shift(today, -1); has(d) && current < 366; d = shift(d, -1)) current++;
  let best = current;
  let run = 0;
  for (let i = 0; i < 366; i++) {
    run = has(shift(today, -i)) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current, best, clearedToday };
}

function readBest(): number {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function rememberBest(best: number) {
  if (best <= readBest()) return;
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The best streak this browser has seen (signed in or not), live. 0 on the server. */
export function useBestStreak(): number {
  return useSyncExternalStore(subscribe, readBest, () => 0);
}

/** Rewards unlocked by a best streak. */
export const unlockedRewards = (best: number) => STREAK_REWARDS.filter((r) => best >= r.days);

/** The next reward still to earn, or null when all are unlocked. */
export const nextReward = (best: number) => STREAK_REWARDS.find((r) => best < r.days) ?? null;

/** The player's streak: null while loading. */
export function useStreak(): Streak | null {
  const [server, setServer] = useState<Streak | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    let live = true;
    fetch("/api/session/streak")
      .then((r) => (r.ok ? r.json() : { guest: true }))
      .then((d: Partial<Streak> & { guest?: boolean }) => {
        if (!live) return;
        const s: Streak = d.guest
          ? { ...localStreak(), guest: true }
          : { current: d.current ?? 0, best: d.best ?? 0, clearedToday: !!d.clearedToday, guest: false };
        rememberBest(s.best);
        setServer(s);
      })
      .catch(() => live && setServer({ ...localStreak(), guest: true }));
    return () => {
      live = false;
    };
  }, [tick]);
  return server;
}
