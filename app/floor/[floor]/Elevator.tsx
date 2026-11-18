"use client";

// Elevator doors over the floor: they open when the player arrives and close before the player
// leaves through an exit (or the HUD's tower link). With reduced motion the doors don't slide:
// the floor label shows briefly and the page switches.

import { useEffect, useRef, useState } from "react";
import { REDUCED_MOTION, useLatest, useMediaQuery } from "@/app/play/clientHooks";
import { ding } from "@/app/floor/hud/sound";

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Ignore a second arrival ding within this window (Strict Mode remount / fast remount). */
let lastArrivalDing = 0;

export function Elevator({
  label,
  leaving,
  onClosed,
}: {
  /** Shown on the doors when arriving, e.g. "Floor 1 · The Bullpen". */
  label: string;
  /** Where the player is going; doors close, then onClosed runs. */
  leaving: { to: string; label: string } | null;
  onClosed: () => void;
}) {
  // Doors start closed (server render too), open after mount, close again on leaving.
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const instant = useMediaQuery(REDUCED_MOTION);
  const closedRef = useRef(false);
  const onClosedRef = useLatest(onClosed);

  useEffect(() => {
    const r = reduced();
    let cancelled = false;
    const t1 = setTimeout(() => {
      if (cancelled) return;
      setOpen(true);
      const now = performance.now();
      if (now - lastArrivalDing > 900) {
        lastArrivalDing = now;
        ding();
      }
    }, r ? 250 : 350);
    const t2 = setTimeout(() => {
      if (!cancelled) setGone(true);
    }, r ? 260 : 1100);
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const closing = !!leaving;
  useEffect(() => {
    if (!closing) {
      closedRef.current = false;
      return;
    }
    // Doors back on screen for the close (an animation timeline, synced with timers below).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGone(false);
    // One frame with the doors still open, so the close animates.
    const raf = requestAnimationFrame(() => setOpen(false));
    const t = setTimeout(() => {
      if (closedRef.current) return;
      closedRef.current = true;
      onClosedRef.current();
    }, instant ? 200 : 650);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [closing, instant, onClosedRef]);

  if (gone && !closing) return null;
  const doors = instant ? "" : "transition-transform duration-500 ease-in-out";
  const text = leaving ? leaving.label : label;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 overflow-hidden" aria-live="polite" role="status">
      <div
        className={`absolute inset-y-0 left-0 w-1/2 border-r-2 border-[var(--cc-edge)] bg-[#5b6270] ${doors}`}
        style={{ transform: open ? "translateX(-100%)" : "translateX(0)", backgroundImage: "repeating-linear-gradient(90deg, transparent 0 22px, rgba(0,0,0,0.12) 22px 24px)" }}
      />
      <div
        className={`absolute inset-y-0 right-0 w-1/2 border-l-2 border-[var(--cc-edge)] bg-[#5b6270] ${doors}`}
        style={{ transform: open ? "translateX(100%)" : "translateX(0)", backgroundImage: "repeating-linear-gradient(90deg, transparent 0 22px, rgba(0,0,0,0.12) 22px 24px)" }}
      />
      <div
        className={`absolute inset-0 grid place-items-center p-4 ${instant ? "" : "transition-opacity duration-300"}`}
        style={{ opacity: open ? 0 : 1 }}
      >
        <p className="pixel-frame bg-[var(--cc-panel)] px-4 py-3 text-center font-pixel text-xs leading-none text-[var(--cc-accent)]">
          {leaving ? "▼ " : "▲ "}
          {text}
        </p>
      </div>
    </div>
  );
}
