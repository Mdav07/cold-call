"use client";

// Hunter looks you earn: four are free from the start (app/play/hunters.ts HUNTERS); these unlock by playing.
// Signed in, progress comes from the server (/api/session/progress); guests, from this browser (floor clears,
// Daily Case clears and the best Daily streak it has seen). Streaks count the Daily Case only.

import { useEffect, useState } from "react";
import { useClearedHere } from "@/app/floor/guestProgress";
import { useBestStreak } from "./streak";
import { SEASONS } from "@/shared/seasonalCase";

export interface Progress {
  clearedFloors: number[];
  dailyClears: number;
  bestStreak: number;
  /** Seasonal cases cleared, by season id (e.g. "thanksgiving-2026"). */
  seasonsCleared: string[];
}

export interface Unlock {
  sprite: string;
  label: string;
  /** How to earn it, short enough for the locked card (the tooltip spells it out). */
  how: string;
  /** The full sentence for the tooltip. */
  long?: string;
  /** For a streak unlock: the days needed (the streak badge shows the next one). */
  streakDays?: number;
  earned: (p: Progress) => boolean;
}

export const UNLOCKS: Unlock[] = [
  { sprite: "hunter-6", label: "Pink Pia", how: "Tutorial", long: "Clear the Tutorial", earned: (p) => p.clearedFloors.includes(0) },
  { sprite: "hunter-8", label: "Teal Tiana", how: "1 Daily Case", long: "Clear a Daily Case", earned: (p) => p.dailyClears >= 1 },
  { sprite: "hunter-1", label: "Aqua Ari", how: "3-day streak", long: "A 3-day Daily Case streak", streakDays: 3, earned: (p) => p.bestStreak >= 3 },
  { sprite: "hunter-5", label: "Lime Leo", how: "7-day streak", long: "A 7-day Daily Case streak", streakDays: 7, earned: (p) => p.bestStreak >= 7 },
  { sprite: "hunter-10", label: "Silver Sol", how: "30-day streak", long: "A 30-day Daily Case streak", streakDays: 30, earned: (p) => p.bestStreak >= 30 },
  { sprite: "hunter-9", label: "Slate Sora", how: "All 3 floors", long: "Clear all three floors", earned: (p) => [1, 2, 3].every((f) => p.clearedFloors.includes(f)) },
  // Seasonal cases: each holiday's case unlocks its own look.
  { sprite: "hunter-11", label: "Turkey Theo", how: "Thanks-giving case", long: "Clear the Thanksgiving case", earned: (p) => p.seasonsCleared.includes("thanksgiving-2026") },
  { sprite: "hunter-12", label: "Holly Hal", how: "Winter case", long: "Clear the Winter Holidays case", earned: (p) => p.seasonsCleared.includes("winter-2026") },
];

/** Every look that can be earned (valid as a saved choice once picked). */
export const UNLOCK_IDS = UNLOCKS.map((u) => u.sprite);

/** The next streak unlock still to earn, for the streak badge. */
export const nextStreakUnlock = (best: number) => UNLOCKS.find((u) => u.streakDays != null && best < u.streakDays) ?? null;

function guestSeasonsCleared(): string[] {
  try {
    return SEASONS.filter((s) => localStorage.getItem(`cc-season-cleared-${s.caseDate}`) === "1").map((s) => s.id);
  } catch {
    return [];
  }
}

function guestDailyClears(): number {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith("cc-daily-cleared-")).length;
  } catch {
    return 0;
  }
}

/** The player's progress, or null while loading. */
export function useProgress(): Progress | null {
  const cleared = useClearedHere();
  const localBest = useBestStreak();
  const [server, setServer] = useState<(Progress & { guest: false }) | { guest: true } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/session/progress")
      .then((r) => (r.ok ? r.json() : { guest: true }))
      .then((d) => live && setServer(d))
      .catch(() => live && setServer({ guest: true }));
    return () => {
      live = false;
    };
  }, []);
  if (!server) return null;
  if (!server.guest) return { ...server, bestStreak: Math.max(server.bestStreak, localBest), seasonsCleared: server.seasonsCleared ?? [] };
  return {
    clearedFloors: cleared.flatMap((c, f) => (c ? [f] : [])),
    dailyClears: guestDailyClears(),
    bestStreak: localBest,
    seasonsCleared: guestSeasonsCleared(),
  };
}
