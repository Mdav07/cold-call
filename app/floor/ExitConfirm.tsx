"use client";

// Confirm before riding an exit so stepping on a mat doesn't yank you out by accident.
import { useEffect, useRef } from "react";
import { confirm as confirmSound } from "@/app/floor/hud/sound";

export function exitLabel(to: string): string {
  if (to === "/tower") return "Leave for the lobby?";
  if (to === "/daily") return "Enter today's Daily Case?";
  if (to === "/floor/0") return "Cross the street to the Pocket Branch?";
  const n = to.replace("/floor/", "");
  if (/^\d+$/.test(n)) return `Take the elevator to Floor ${n}?`;
  return `Go to ${to}?`;
}

export function ExitConfirm({
  to,
  onGo,
  onStay,
}: {
  to: string;
  onGo: () => void;
  onStay: () => void;
}) {
  const goRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    goRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onStay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStay]);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/65 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-confirm-title"
        className="pixel-frame flex w-full max-w-sm flex-col gap-4 bg-[var(--cc-panel)] p-4 sm:p-5"
      >
        <h2 id="exit-confirm-title" className="font-pixel text-xs leading-relaxed text-[var(--cc-accent)]">
          {exitLabel(to)}
        </h2>
        <p className="font-pixel text-[10px] leading-relaxed text-[var(--cc-muted)]">
          Confirm so you don&apos;t leave by accident.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            ref={goRef}
            type="button"
            className="pixel-button"
            onClick={() => {
              confirmSound();
              onGo();
            }}
          >
            Go ▶
          </button>
          <button type="button" className="pixel-button !bg-[var(--cc-panel-2)] !text-[var(--cc-ink)]" onClick={onStay}>
            Stay
          </button>
        </div>
      </section>
    </div>
  );
}
