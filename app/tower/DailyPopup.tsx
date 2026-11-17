"use client";

// The Daily Case invitation in the lobby: once per UTC day (cc-daily-seen-<date>), only after the
// tutorial is cleared. 88a8 mounts it from Lobby.tsx. Owned by 6b5c (see .plans/daily.md).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { dailyCase, todayUtc, type DailyCase } from "@/shared/dailyCase";
import { useClearedHere } from "@/app/floor/guestProgress";
import { Walker } from "@/app/intro/Intro";
import { confirm, ding } from "@/app/floor/hud/sound";

const seenKey = (date: string) => `cc-daily-seen-${date}`;

function seenToday(date: string): boolean {
  try {
    return localStorage.getItem(seenKey(date)) === "1";
  } catch {
    return true; // storage blocked: don't pop up on every visit
  }
}

function markSeen(date: string) {
  try {
    localStorage.setItem(seenKey(date), "1");
  } catch {}
}

/**
 * @param tutorialCleared Signed-in players: whether their account has cleared the tutorial. Leave it
 *   undefined for guests; then this browser's own clear (cc-cleared-floor-0) decides.
 * @param clearedToday Optional: the player already cleared today's case (no need to invite them).
 */
export function DailyPopup({ tutorialCleared, clearedToday = false }: { tutorialCleared?: boolean; clearedToday?: boolean }) {
  const guestCleared = useClearedHere()[0];
  const eligible = (tutorialCleared ?? guestCleared) && !clearedToday;
  const [c, setC] = useState<DailyCase | null>(null);
  const playRef = useRef<HTMLAnchorElement>(null);

  // Decide after mount: the date and localStorage are browser-only.
  useEffect(() => {
    if (!eligible) return;
    const date = todayUtc();
    if (seenToday(date)) return;
    setC(dailyCase(date));
    ding();
  }, [eligible]);

  useEffect(() => {
    if (!c) return;
    playRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      later();
    };
    // Capture: the lobby's own keys (walking, Space) wait until the card is closed.
    const swallow = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab" || e.key === "Enter") return;
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keydown", swallow, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keydown", swallow, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);

  if (!c) return null;
  const later = () => {
    markSeen(c.date);
    setC(null);
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/65 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-title"
        className="pixel-frame flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col gap-4 overflow-y-auto bg-[var(--cc-panel)] p-4 sm:p-5"
      >
        <header className="-mx-4 -mt-4 border-b-4 border-[var(--cc-edge)] bg-[var(--cc-accent)] px-4 pb-3 pt-4 text-[var(--cc-edge)] sm:-mx-5 sm:-mt-5 sm:px-5">
          <p className="font-pixel text-[9px] tracking-widest">DAILY CASE · {c.date}</p>
          <h2 id="daily-title" className="mt-2 font-pixel text-base leading-snug sm:text-lg">
            {c.title}
          </h2>
        </header>

        <div className="flex items-center gap-4">
          <div className="grid h-[104px] w-[64px] shrink-0 place-items-end justify-center bg-[var(--cc-bg)] pb-1">
            <Walker sprite={c.employee.sprite} scale={3} walking />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="font-pixel text-[11px] leading-relaxed text-[var(--cc-ink)]">{c.employee.name}</p>
            <p className="font-pixel text-[9px] leading-relaxed text-[var(--cc-muted)]">{c.employee.title}</p>
            <p className="font-pixel text-[9px] leading-relaxed text-[var(--cc-muted)]">{c.place}</p>
          </div>
        </div>

        <p className="font-pixel text-[11px] leading-loose text-[var(--cc-ink)]">
          A new case every day, the same for everyone. One person, one small payment. Fastest times go on the Daily board.
        </p>

        <div className="flex flex-wrap gap-2">
          <Link
            ref={playRef}
            href="/daily"
            className="pixel-button"
            onClick={() => {
              confirm();
              markSeen(c.date);
            }}
          >
            Play today&apos;s case ▶
          </Link>
          <button type="button" className="pixel-button !bg-[var(--cc-panel-2)] !text-[var(--cc-ink)]" onClick={later}>
            Later
          </button>
        </div>
      </section>
    </div>
  );
}
