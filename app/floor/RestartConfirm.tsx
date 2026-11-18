"use client";

// RESTART in the HUD asks first: starting over throws away the run's clock, everyone's suspicion and
// any lockouts. Enter restarts (it's focused), Escape keeps playing.

import { useEffect, useRef } from "react";
import { confirm as confirmSound } from "@/app/floor/hud/sound";

export function RestartConfirm({ onRestart, onStay }: { onRestart: () => void; onStay: () => void }) {
  const goRef = useRef<HTMLButtonElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const stay = useRef(onStay);
  useEffect(() => {
    stay.current = onStay;
  });
  useEffect(() => {
    goRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        stay.current();
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"].includes(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        (document.activeElement === goRef.current ? stayRef : goRef).current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/65 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="restart-title"
        className="pixel-frame flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col gap-4 overflow-y-auto bg-[var(--cc-panel)] p-4 sm:p-5"
      >
        <h2 id="restart-title" className="font-pixel text-xs leading-relaxed text-[var(--cc-accent)]">
          Restart this level?
        </h2>
        <p className="text-sm text-[var(--cc-ink)]">
          The clock, everyone&apos;s suspicion and any lockouts reset. You start over from scratch.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            ref={goRef}
            type="button"
            className="pixel-button min-h-11"
            onClick={() => {
              confirmSound();
              onRestart();
            }}
          >
            Restart ↺
          </button>
          <button ref={stayRef} type="button" className="pixel-button min-h-11 !bg-[var(--cc-panel-2)] !text-[var(--cc-ink)]" onClick={onStay}>
            Keep playing
          </button>
        </div>
      </section>
    </div>
  );
}
