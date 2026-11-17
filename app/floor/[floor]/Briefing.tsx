"use client";

// Krystal's briefing for a floor, shown over the canvas on the first visit (per browser).
// Two short screens you click through (Next, then Start), in large pixel text.
// The scene stays paused until the player presses Start.

import krystal from "@/content/plumpurse/krystal.json";
import { MemoPlayButton } from "@/app/play/KrystalMemo";
import { PORTRAITS } from "@/app/play/portraits";
import { useEffect, useRef, useState } from "react";
import { confirm, tick } from "@/app/floor/hud/sound";

type BriefingText = { audio: string; text: string };

export function briefingFor(floor: number): BriefingText | null {
  return (krystal.briefings as Record<string, BriefingText>)[String(floor)] ?? null;
}

const key = (floor: number) => `cc-briefed-floor-${floor}`;

/** True if this browser has already seen the floor's briefing. Storage errors count as not seen. */
export function wasBriefed(floor: number): boolean {
  try {
    return localStorage.getItem(key(floor)) === "1";
  } catch {
    return false;
  }
}

function markBriefed(floor: number) {
  try {
    localStorage.setItem(key(floor), "1");
  } catch {
    // private window or blocked storage: the briefing shows again next time
  }
}

/** Splits the memo into two halves at a sentence boundary, one per screen. */
function halves(text: string): [string, string] {
  const sentences = text.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [text];
  let first = "";
  let i = 0;
  while (i < sentences.length - 1 && first.length < text.length / 2) first += sentences[i++];
  return [first.trim(), sentences.slice(i).join("").trim()];
}

/** The one thing to do on the tutorial floor, in a line. */
const GOALS: Record<number, string> = {
  0: "Goal: get Barry to pay the courier. Ask for $1 or less.",
};

const TEXT = "font-pixel text-[13px] leading-[1.9] text-[var(--cc-ink)] sm:text-[15px]";

export function Briefing({
  floor,
  floorName,
  onStart,
  onCaseFile,
}: {
  floor: number;
  /** The map's name, e.g. "Floor 1 · The Bullpen", shown as a chapter title. */
  floorName: string;
  onStart: () => void;
  onCaseFile: () => void;
}) {
  const [kicker, title] = floorName.includes(" · ") ? floorName.split(" · ") : [`Floor ${floor}`, floorName];
  const [page, setPage] = useState<0 | 1>(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  // Focus follows the page, so Enter walks through: Next, then Start.
  useEffect(() => (page === 0 ? nextRef : startRef).current?.focus(), [page]);
  const b = briefingFor(floor);
  if (!b) return null;
  const [one, two] = halves(b.text);
  const Face = PORTRAITS.krystal;
  const start = () => {
    confirm();
    markBriefed(floor);
    onStart();
  };
  const go = (p: 0 | 1) => {
    tick();
    setPage(p);
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="briefing-title"
        className="pixel-frame flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col gap-5 overflow-y-auto bg-[var(--cc-panel)] p-4 sm:p-6"
      >
        {/* Chapter card: a band across the top, like a level title in a handheld RPG. */}
        <header className="-mx-4 -mt-4 border-b-4 border-[var(--cc-edge)] bg-[var(--cc-accent)] px-4 pb-3 pt-4 text-[var(--cc-edge)] sm:-mx-6 sm:-mt-6 sm:px-6">
          <p className="font-pixel text-[9px] tracking-widest">COLD CALL · {kicker.toUpperCase()}</p>
          <h2 id="briefing-title" className="mt-2 font-pixel text-base leading-snug sm:text-xl">
            {title}
          </h2>
        </header>

        <div className="flex items-center gap-3">
          {Face && (
            <div className="pixel-frame grid h-14 w-14 shrink-0 place-items-center overflow-hidden bg-[var(--cc-portrait)] [&>svg]:h-full [&>svg]:w-full">
              <Face mood="neutral" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-pixel text-[10px] text-[var(--cc-muted)]">Krystal says</p>
            <p className="font-pixel text-xs text-[var(--cc-accent)]">{krystal.name ?? "Krystal"}</p>
          </div>
          <MemoPlayButton title={`Krystal's briefing for ${title}`} audio={b.audio} />
        </div>

        <div aria-live="polite" className="flex min-h-[7.5rem] flex-col gap-4">
          {page === 0 ? (
            <p className={TEXT}>{one}</p>
          ) : (
            <>
              <p className={TEXT}>{two}</p>
              {GOALS[floor] && <p className="font-pixel text-[11px] leading-loose text-[var(--cc-accent)]">{GOALS[floor]}</p>}
              <p className="font-pixel text-[10px] leading-loose text-[var(--cc-muted)]">
                Arrows or WASD to walk. Space to talk.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {page === 0 ? (
            <button ref={nextRef} type="button" className="pixel-button" onClick={() => go(1)}>
              Next ▶
            </button>
          ) : (
            <>
              <button type="button" className="pixel-button" onClick={() => go(0)}>
                ◀ Back
              </button>
              <button ref={startRef} type="button" className="pixel-button" onClick={start}>
                Start
              </button>
            </>
          )}
          <button type="button" className="pixel-button" onClick={onCaseFile}>
            Case file
          </button>
          <span className="ml-auto font-pixel text-[9px] text-[var(--cc-muted)]" aria-label={`Page ${page + 1} of 2`}>
            {page + 1} / 2
          </span>
        </div>
      </section>
    </div>
  );
}
