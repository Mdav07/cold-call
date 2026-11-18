"use client";

// The Daily Case invitation in the lobby: once per UTC day (cc-daily-seen-<date>), only after the
// tutorial is cleared. 88a8 mounts it from Lobby.tsx. Owned by 6b5c (see .plans/daily.md).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClientValue } from "@/app/play/clientHooks";
import Link from "next/link";
import { dailyCase, todayUtc, type DailyCase } from "@/shared/dailyCase";
import { useClearedHere } from "@/app/floor/guestProgress";
import { Walker } from "@/app/intro/Intro";
import { confirm, ding } from "@/app/floor/hud/sound";
import { StreakBadge } from "@/app/play/StreakBadge";

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
export function DailyPopup({
  tutorialCleared,
  clearedToday = false,
}: {
  tutorialCleared?: boolean;
  clearedToday?: boolean;
}) {
  const guestCleared = useClearedHere()[0];
  const eligible = (tutorialCleared ?? guestCleared) && !clearedToday;
  const playRef = useRef<HTMLAnchorElement>(null);
  // The date and localStorage are browser-only: "seen" is true on the server, so nothing shows until hydration.
  const seen = useClientValue(() => seenToday(todayUtc()), true);
  const [dismissed, setDismissed] = useState(false);
  const c: DailyCase | null = useMemo(
    () => (eligible && !seen && !dismissed ? dailyCase(todayUtc()) : null),
    [eligible, seen, dismissed],
  );
  const date = c?.date ?? null;
  useEffect(() => {
    if (date) ding();
  }, [date]);
  const later = useCallback(() => {
    if (date) markSeen(date);
    setDismissed(true);
  }, [date]);

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
    // Enter is stopped too (not cancelled): the lobby's scene treats Enter as "interact" and calls
    // preventDefault, which would cancel the focused button's own activation.
    const swallow = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") return;
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keydown", swallow, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keydown", swallow, true);
    };
  }, [c, later]);

  if (!c) return null;

  // Phones held sideways (short screens): wider and in two columns, so Play is on screen without scrolling.
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/65 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-title"
        className="pixel-frame flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col gap-4 overflow-y-auto bg-[var(--cc-panel)] p-4 sm:p-5 [@media(max-height:500px)]:max-w-3xl [@media(max-height:500px)]:gap-3"
      >
        <header className="-mx-4 -mt-4 border-b-4 border-[var(--cc-edge)] bg-[var(--cc-accent)] px-4 pb-3 pt-4 text-[var(--cc-edge)] sm:-mx-5 sm:-mt-5 sm:px-5 [@media(max-height:500px)]:pb-2 [@media(max-height:500px)]:pt-3">
          <p className="font-pixel text-[9px] tracking-widest">
            DAILY CASE · {c.date}
          </p>
          <h2
            id="daily-title"
            className="mt-2 font-pixel text-base leading-snug sm:text-lg [@media(max-height:500px)]:text-sm"
          >
            {c.title}
          </h2>
        </header>

        <div className="flex flex-col gap-4 [@media(max-height:500px)]:grid [@media(max-height:500px)]:grid-cols-2 [@media(max-height:500px)]:gap-5">
          <div className="flex flex-col gap-4 [@media(max-height:500px)]:gap-3">
            <div className="flex items-center gap-4">
              <div className="grid h-[104px] w-[64px] shrink-0 place-items-end justify-center bg-[var(--cc-bg)] pb-1">
                <Walker sprite={c.employee.sprite} scale={3} walking />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <p className="font-pixel text-[11px] leading-relaxed text-[var(--cc-ink)]">
                  {c.employee.name}
                </p>
                <p className="font-pixel text-[9px] leading-relaxed text-[var(--cc-muted)]">
                  {c.employee.title}
                </p>
                <p className="font-pixel text-[9px] leading-relaxed text-[var(--cc-muted)]">
                  {c.place}
                </p>
              </div>
            </div>

            <p className="font-pixel text-[11px] leading-loose text-[var(--cc-ink)]">
              A new case every day, the same for everyone. One person, one small
              payment. Fastest times go on the Daily board.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <StreakBadge variant="full" />

            <div className="flex flex-wrap gap-2">
              <Link
                ref={playRef}
                href="/daily"
                className="pixel-button min-h-11"
                onClick={() => {
                  confirm();
                  // Close it too: the lobby stays mounted (hidden) while you're away and would reopen with it.
                  later();
                }}
              >
                Play today&apos;s case ▶
              </Link>
              <button
                type="button"
                className="pixel-button min-h-11 !bg-[var(--cc-panel-2)] !text-[var(--cc-ink)]"
                onClick={later}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
