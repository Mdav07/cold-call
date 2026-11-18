"use client";

// Continue or restart: a floor (or a day's Daily Case) remembers its open run in this browser. Coming
// back, the player picks: continue it (same run clock, suspicion and lockouts) or start over.

import { useEffect, useRef, useState } from "react";
import { useClientValue } from "@/app/play/clientHooks";

export interface SavedRun {
  runId: string;
  startedAt: number | null; // when the first message was sent (the run clock), if it was
  savedAt: number;
}

const EVENT = "coldcall-saved-run";
const keyFor = (place: string) => `cc-run-${place}`;

export function saveRun(place: string, run: Omit<SavedRun, "savedAt">): void {
  try {
    localStorage.setItem(keyFor(place), JSON.stringify({ ...run, savedAt: Date.now() }));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function clearRun(place: string): void {
  try {
    localStorage.removeItem(keyFor(place));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** The run saved for this place, or null (always null on the server). */
export function useSavedRun(place: string): SavedRun | null {
  const raw = useClientValue(
    () => {
      try {
        return localStorage.getItem(keyFor(place));
      } catch {
        return null;
      }
    },
    null,
    subscribe,
  );
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as SavedRun;
    return typeof r.runId === "string" ? r : null;
  } catch {
    return null;
  }
}

const ago = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60_000));
  return m < 60 ? `${m} minute${m === 1 ? "" : "s"} ago` : `${Math.round(m / 60)} hour${m < 90 ? "" : "s"} ago`;
};

/**
 * Asks to continue or restart, after checking the saved run is still open on the server (a finished or
 * unknown run is forgotten silently). `employeeId` is any employee of this place, for the state check.
 */
export function ResumeRun({
  place,
  saved,
  employeeId,
  onContinue,
  onRestart,
}: {
  place: string;
  saved: SavedRun;
  employeeId: string;
  onContinue: (run: SavedRun) => void;
  onRestart: () => void;
}) {
  const [open, setOpen] = useState<boolean | null>(null); // null while checking
  const [when, setWhen] = useState("");
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/session/state?run_id=${encodeURIComponent(saved.runId)}&employee_id=${encodeURIComponent(employeeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { run?: { outcome?: string | null } | null } | null) => {
        if (!live) return;
        const stillOpen = !!s?.run && !s.run.outcome;
        if (!stillOpen) clearRun(place);
        setWhen(ago(Date.now() - (saved.startedAt ?? saved.savedAt)));
        setOpen(stillOpen);
      })
      .catch(() => live && setOpen(false));
    return () => {
      live = false;
    };
  }, [saved.runId, saved.startedAt, saved.savedAt, employeeId, place]);

  useEffect(() => {
    if (open) continueRef.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/65 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-title"
        className="pixel-frame flex w-full max-w-sm flex-col gap-4 bg-[var(--cc-panel)] p-4 sm:p-5"
      >
        <h2 id="resume-title" className="font-pixel text-xs leading-relaxed text-[var(--cc-accent)]">
          Run in progress
        </h2>
        <p className="text-sm text-[var(--cc-ink)]">
          You started a run here {when}. Continue it, with the same clock and
          everyone&apos;s suspicion, or start over from scratch?
        </p>
        <div className="flex flex-wrap gap-2">
          <button ref={continueRef} type="button" className="pixel-button" onClick={() => onContinue(saved)}>
            Continue ▶
          </button>
          <button
            type="button"
            className="pixel-button"
            onClick={() => {
              clearRun(place);
              onRestart();
            }}
          >
            Start over
          </button>
        </div>
      </section>
    </div>
  );
}
