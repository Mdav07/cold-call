"use client";

// Krystal's briefing for a floor, shown over the canvas on the first visit (per browser).
// The scene stays paused until the player presses Start.

import krystal from "@/content/plumpurse/krystal.json";
import { KrystalMemo } from "@/app/play/KrystalMemo";
import { TUTORIAL_STEPS } from "@/app/play/ChatRoom";
import { PORTRAITS } from "@/app/play/portraits";
import { useEffect, useRef } from "react";
import { confirm } from "@/app/floor/hud/sound";

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

export function Briefing({ floor, onStart }: { floor: number; onStart: () => void }) {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => startRef.current?.focus(), []);
  const b = briefingFor(floor);
  if (!b) return null;
  const Face = PORTRAITS.krystal;
  const start = () => {
    confirm();
    markBriefed(floor);
    onStart();
  };
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="briefing-title"
        className="pixel-frame flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col gap-4 overflow-y-auto bg-[var(--cc-panel)] p-4 sm:p-5"
      >
        <div className="flex items-center gap-3">
          {Face && (
            <div className="pixel-frame grid h-16 w-16 shrink-0 place-items-center overflow-hidden bg-[var(--cc-portrait)] [&>svg]:h-full [&>svg]:w-full">
              <Face mood="neutral" />
            </div>
          )}
          <div>
            <p className="font-pixel text-[10px] text-[var(--cc-muted)]">Voice memo from</p>
            <h2 id="briefing-title" className="font-pixel text-xs text-[var(--cc-accent)]">
              {krystal.name ?? "Krystal"}
            </h2>
          </div>
        </div>
        <KrystalMemo
          title={`Briefing: ${floor === 0 ? "the Pocket Branch" : `Floor ${floor}`}`}
          audio={b.audio}
          text={b.text}
        />
        {floor === 0 && (
          <ol className="list-decimal pl-5 text-sm leading-relaxed text-[var(--cc-ink)]">
            {TUTORIAL_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}
        <p className="text-xs text-[var(--cc-muted)]">
          Walk with the arrow keys or WASD. Face someone and press Space to talk. Krystal&apos;s note by the door
          has this briefing again.
        </p>
        <div className="flex flex-wrap gap-2">
          <button ref={startRef} type="button" className="pixel-button" onClick={start}>
            Start
          </button>
          <a href="/casefile" target="_blank" rel="noopener" className="pixel-button">
            Case file
          </a>
        </div>
      </section>
    </div>
  );
}
