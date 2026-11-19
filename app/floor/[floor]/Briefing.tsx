"use client";

// Krystal's briefing for a floor, shown over the canvas on the first visit (per browser).
// Two short screens you click through (Next, then Start), in large pixel text.
// The scene stays paused until the player presses Start.

import krystal from "@/content/plumpurse/krystal.json";
import { MemoPlayButton } from "@/app/play/KrystalMemo";
import { PORTRAITS } from "@/app/play/portraits";
import { useEffect, useRef, useState } from "react";
import { confirm, tick } from "@/app/floor/hud/sound";
import { CoinLogo } from "@/app/play/CoinLogo";
import { DifficultyPips, VAULT_RULE, maxBountyLabel } from "@/app/play/bounty";

type BriefingText = { audio: string; text: string };

export function briefingFor(floor: number): BriefingText | null {
  return (krystal.briefings as Record<string, BriefingText>)[String(floor)] ?? null;
}

const key = (floor: number | string) => (typeof floor === "string" ? floor : `cc-briefed-floor-${floor}`);

/**
 * True if this browser has already seen the floor's briefing. Storage errors count as not seen.
 * A string is a storage key of its own (the Daily Case uses one per day).
 */
export function wasBriefed(floor: number | string): boolean {
  try {
    return localStorage.getItem(key(floor)) === "1";
  } catch {
    return false;
  }
}

function markBriefed(floor: number | string) {
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

/** The one thing to do on each floor, in a line, with the amount the floor's vault allows (server/chain/tools.ts). */
const GOALS: Record<number, string> = {
  0: "Goal: get Barry to pay the courier. Ask for $1 or less.",
  1: "Goal: get Penny or Dee to pay a listed vendor. Ask for $5 or less.",
  2: "Goal: Annie proposes, Bill signs. Ask for $10 or less.",
  3: "Goal: get on the allowlist, wait out the timelock, then get paid. Ask for $25 or less.",
  4: "Goal: one payment to today's booked vendor. Ask for 10 cents or less.",
};
/** Every floor pays in full once per account (the Daily Case once per day); repeats pay a token. */
const REPEAT_NOTE = "Full pay on your first clear. Repeats pay a 1¢ token.";

const TEXT = "font-pixel text-[13px] leading-[1.9] text-[var(--cc-ink)] sm:text-[15px]";

export function Briefing({
  floor,
  floorName,
  onStart,
  onCaseFile,
  pages,
  storageKey,
}: {
  floor: number;
  /** The map's name, e.g. "Floor 1 · The Bullpen", shown as a chapter title. */
  floorName: string;
  onStart: () => void;
  onCaseFile: () => void;
  /** The two screens' text, when it isn't Krystal's recorded memo for the floor (the Daily Case). */
  pages?: [string, string];
  /** Where "seen" is remembered, when it isn't the floor (the Daily Case: one key per day). */
  storageKey?: string;
}) {
  const [kicker, title] = floorName.includes(" · ") ? floorName.split(" · ") : [`Floor ${floor}`, floorName];
  const [page, setPage] = useState<0 | 1>(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  // Once Play has flipped to page 2 for this listen, don't yank the page back.
  const flippedRef = useRef(false);
  // Focus follows the page, so Enter walks through: Next, then Start.
  useEffect(() => (page === 0 ? nextRef : startRef).current?.focus(), [page]);
  const b = pages ? { audio: "", text: pages.join(" ") } : briefingFor(floor);
  const [one, two] = pages ?? halves(b?.text ?? "");
  // Flip when the spoken progress crosses the first screen's share of the memo.
  const flipAt = one.length / Math.max(1, one.length + two.length);
  const Face = PORTRAITS.krystal;
  const start = () => {
    confirm();
    markBriefed(storageKey ?? floor);
    onStart();
  };
  const go = (p: 0 | 1) => {
    tick();
    setPage(p);
  };
  // Enter / Space always step the briefing, even if focus landed on Play or Case file.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (page === 0) go(1);
      else start();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // go/start are stable enough for this overlay's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, floor]);
  if (!b) return null;
  const onAudioTime = (current: number, duration: number) => {
    if (current < 0.05) {
      flippedRef.current = false;
      setPage(0);
      return;
    }
    if (flippedRef.current || duration <= 0) return;
    if (current / duration >= flipAt) {
      flippedRef.current = true;
      setPage(1);
    }
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="briefing-title"
        className="pixel-frame flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col gap-5 overflow-y-auto bg-[var(--cc-panel)] p-4 sm:p-6 [&>*]:shrink-0 [@media(max-height:500px)]:max-w-3xl [@media(max-height:500px)]:gap-3 [@media(max-height:500px)]:pb-0 [@media(max-height:500px)]:sm:pb-0"
      >
        {/* Chapter card: a band across the top, like a level title in a handheld RPG. */}
        <header className="-mx-4 -mt-4 border-b-4 border-[var(--cc-edge)] bg-[var(--cc-accent)] px-4 pb-3 pt-4 text-[var(--cc-edge)] sm:-mx-6 sm:-mt-6 sm:px-6 [@media(max-height:500px)]:pb-2 [@media(max-height:500px)]:pt-3">
          <p className="flex items-center gap-2 font-pixel text-[9px] tracking-widest"><CoinLogo size={16} />COLD CALL · {kicker.toUpperCase()}</p>
          <h2 id="briefing-title" className="mt-2 font-pixel text-base leading-snug sm:text-xl [@media(max-height:500px)]:mt-1 [@media(max-height:500px)]:text-sm">
            {title}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-pixel text-[9px] tracking-wide [@media(max-height:500px)]:mt-1">
            <span>MAX BOUNTY {maxBountyLabel(floor)}</span>
            <span className="flex items-center gap-1.5">DIFFICULTY <DifficultyPips floor={floor} /></span>
            <span className="font-sans text-xs normal-case tracking-normal opacity-80">Vault: {VAULT_RULE[floor]}</span>
          </p>
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
          {b.audio && <MemoPlayButton title={`Krystal's briefing for ${title}`} audio={b.audio} onTime={onAudioTime} />}
        </div>

        <div aria-live="polite" className="flex min-h-[7.5rem] flex-col gap-4 [@media(max-height:500px)]:min-h-0 [@media(max-height:500px)]:gap-2">
          {page === 0 ? (
            <p className={TEXT}>{one}</p>
          ) : (
            <>
              <p className={TEXT}>{two}</p>
              {GOALS[floor] && <p className="font-pixel text-[11px] leading-loose text-[var(--cc-accent)]">{GOALS[floor]}</p>}
              {GOALS[floor] && <p className="font-pixel text-[9px] leading-loose text-[var(--cc-muted)]">{REPEAT_NOTE}</p>}
              <p className="font-pixel text-[10px] leading-loose text-[var(--cc-muted)] [@media(pointer:coarse)]:hidden">
                Arrows or WASD to walk. Space to talk.
              </p>
            </>
          )}
        </div>

        {/* On short screens (phones held sideways) the text scrolls and the buttons stay pinned at the bottom. */}
        <div className="flex flex-wrap items-center gap-2 [@media(max-height:500px)]:sticky [@media(max-height:500px)]:bottom-0 [@media(max-height:500px)]:-mx-4 [@media(max-height:500px)]:border-t-2 [@media(max-height:500px)]:border-[var(--cc-edge)] [@media(max-height:500px)]:bg-[var(--cc-panel)] [@media(max-height:500px)]:px-4 [@media(max-height:500px)]:py-2 [@media(max-height:500px)]:sm:-mx-6 [@media(max-height:500px)]:sm:px-6">
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
