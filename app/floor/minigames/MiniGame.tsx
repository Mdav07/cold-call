"use client";

// Clue mini-games, Among Us style: a clue prop on Floors 1–3 and in the Daily Case opens a short task
// first, and the clue shows when it's done. Solved clues stay solved for the run (this browser, per
// place), and a new run (RESTART, or after a result) starts them over. The tutorial has one easy game
// to teach it. Krystal's own notes never have one.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Keycard, Keypad, Shred, Wires, winSound, type Rand } from "./games";

export type GameKind = "wires" | "keycard" | "keypad" | "shred";
const KINDS: GameKind[] = ["wires", "keycard", "keypad", "shred"];

const TITLES: Record<GameKind, { title: string; how: string }> = {
  wires: { title: "Fix the wiring", how: "Join each wire to the socket of the same colour." },
  keycard: { title: "Swipe the keycard", how: "Hold to slide the card, let go over the green." },
  keypad: { title: "Enter the code", how: "Type the code from the sticky note." },
  shred: { title: "Tape the shredded memo", how: "Pick the strips in reading order." },
};

/** The tutorial's one teaching game: Barry's courier schedule. */
const TUTORIAL_PROP = "swiftbag-schedule";

/**
 * Which game a prop gets, if any. Floors 1–3 and the Daily: every prop except Krystal's notes, the
 * kinds dealt in turn across the room's props so a floor mixes them. Tutorial: one easy keypad.
 */
export function gameFor(floor: number, propIds: string[], id: string): GameKind | null {
  if (id.startsWith("krystal")) return null;
  if (floor === 0) return id === TUTORIAL_PROP ? "keypad" : null;
  const clues = propIds.filter((p) => !p.startsWith("krystal")).sort();
  const i = clues.indexOf(id);
  return i < 0 ? null : KINDS[(i + floor) % KINDS.length];
}

// ---------- solved clues, per place, for the run ----------

const key = (place: string) => `cc-clue-games-${place}`;
const EVENT = "coldcall-clue-games";

function read(place: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key(place)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function markSolved(place: string, id: string) {
  try {
    const now = read(place);
    if (!now.includes(id)) localStorage.setItem(key(place), JSON.stringify([...now, id]));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** A new run: every clue game starts over. */
export function clearSolved(place: string) {
  try {
    localStorage.removeItem(key(place));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(l: () => void) {
  window.addEventListener(EVENT, l);
  window.addEventListener("storage", l);
  return () => {
    window.removeEventListener(EVENT, l);
    window.removeEventListener("storage", l);
  };
}

/** The prop ids solved in this place (a string, so the snapshot is stable between renders). */
export function useSolved(place: string): string[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key(place)) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function seeded(s: string): Rand {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- the overlay ----------

export function MiniGame({
  kind,
  seed,
  label,
  easy = false,
  onWin,
  onCancel,
}: {
  kind: GameKind;
  /** Same seed, same puzzle: the prop id and the place. */
  seed: string;
  /** The clue's label, e.g. "Vendor registry". */
  label: string;
  easy?: boolean;
  onWin: () => void;
  onCancel: () => void;
}) {
  const [rand] = useState(() => seeded(seed));
  const [won, setWon] = useState(false);
  const box = useRef<HTMLElement>(null);
  const cancel = useRef(onCancel);
  const win = useRef(onWin);
  useEffect(() => {
    cancel.current = onCancel;
    win.current = onWin;
  });

  // Escape leaves the clue for later (nothing is lost). Focus starts inside the game.
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cancel.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const done = () => {
    if (won) return;
    setWon(true);
    winSound();
    setTimeout(() => win.current(), 650);
  };

  const t = TITLES[kind];
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/65 p-3 sm:p-6">
      <style>{`@keyframes cc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.cc-shake{animation:cc-shake .3s steps(4) 1}
@media (prefers-reduced-motion: reduce){.cc-shake{animation:none}}`}</style>
      <section
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="minigame-title"
        className="pixel-frame flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col gap-4 overflow-y-auto bg-[var(--cc-panel)] p-4 sm:p-5 [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:py-3"
      >
        <header className="flex flex-col gap-1">
          <p className="font-pixel text-[9px] tracking-widest text-[var(--cc-muted)]">🔒 {label.toUpperCase()}</p>
          <h2 id="minigame-title" className="font-pixel text-xs leading-relaxed text-[var(--cc-accent)]">
            {won ? "Unlocked!" : t.title}
          </h2>
          {/* Short screens (phones sideways): the title says enough, and the game fits without scrolling. */}
          <p className="text-sm text-[var(--cc-ink)] [@media(max-height:500px)]:hidden">{t.how}</p>
        </header>
        <div className={won ? "pointer-events-none opacity-60" : undefined}>
          {kind === "wires" && <Wires rand={rand} onWin={done} />}
          {kind === "keycard" && <Keycard rand={rand} onWin={done} />}
          {kind === "keypad" && <Keypad rand={rand} onWin={done} easy={easy} />}
          {kind === "shred" && <Shred rand={rand} onWin={done} />}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-pixel text-[9px] text-[var(--cc-muted)]">Esc · leave it for later</p>
          <button type="button" className="pixel-button min-h-10 !bg-[var(--cc-panel-2)] !text-[var(--cc-ink)]" onClick={onCancel}>
            Leave
          </button>
        </div>
      </section>
    </div>
  );
}
