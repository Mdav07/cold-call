"use client";

// The Daily Case streak: a pixel flame and the days in a row, what to do next, and (full size) a week of
// pips with the next reward. Compact for top bars; full for the Daily popup and the result screen.

import { nextReward, useStreak, type Streak } from "./streak";

/** An 8x10 pixel flame; grey when there is no streak going. */
function Flame({ lit, size = 2 }: { lit: boolean; size?: number }) {
  const outer = lit ? "#e8542c" : "#6b6878";
  const inner = lit ? "#f6b23c" : "#8f8c9b";
  const core = lit ? "#fff1b8" : "#b4b1c0";
  // Rows of [x, width, colour] runs.
  const rows: [number, number, string][][] = [
    [[3, 1, outer]],
    [[3, 2, outer]],
    [[2, 3, outer]],
    [[2, 4, outer]],
    [[1, 2, outer], [3, 2, inner], [5, 1, outer]],
    [[1, 1, outer], [2, 4, inner], [6, 1, outer]],
    [[0, 2, outer], [2, 1, inner], [3, 2, core], [5, 1, inner], [6, 2, outer]],
    [[0, 1, outer], [1, 2, inner], [3, 2, core], [5, 2, inner], [7, 1, outer]],
    [[1, 1, outer], [2, 4, inner], [6, 1, outer]],
    [[2, 4, outer]],
  ];
  return (
    <svg aria-hidden width={8 * size} height={10 * size} viewBox="0 0 8 10" shapeRendering="crispEdges">
      {rows.flatMap((runs, y) => runs.map(([x, w, fill]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={fill} />))}
    </svg>
  );
}

function status(s: Streak): string {
  if (s.clearedToday) return "Cleared today. Come back tomorrow to keep it going.";
  if (s.current > 0) return `Play today's case to keep your ${s.current}-day streak.`;
  return "Clear today's case to start a streak.";
}

export function StreakBadge({ variant = "compact" }: { variant?: "compact" | "full" }) {
  const s = useStreak();
  if (!s) return null;
  const lit = s.current > 0;
  const days = `${s.current}-day streak`;

  if (variant === "compact") {
    if (s.current === 0) return null; // nothing to show until there's a streak going
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-pixel text-[9px] ${lit ? "text-[#f6b23c]" : "text-[var(--cc-muted)]"}`}
        title={status(s)}
      >
        <Flame lit={lit} size={1.4} />
        {s.current}
        {!s.clearedToday && lit && <span className="sr-only"> (play today to keep it)</span>}
      </span>
    );
  }

  const next = nextReward(s.best);
  const week = Math.max(7, next?.days ?? 7);
  return (
    <section aria-label="Daily streak" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Flame lit={lit} size={3} />
        <div className="flex flex-col gap-1">
          <p className={`font-pixel text-xs ${lit ? "text-[#f6b23c]" : "text-[var(--cc-muted)]"}`}>{days}</p>
          <p className="text-sm text-[var(--cc-ink)]">{status(s)}</p>
        </div>
      </div>
      <ol className="flex gap-1" aria-label={`${s.current} of ${week} days`}>
        {Array.from({ length: week }, (_, i) => {
          const done = i < s.current;
          const reward = next && i + 1 === next.days;
          return (
            <li
              key={i}
              className={`grid h-5 flex-1 place-items-center border-2 font-pixel text-[10px] leading-none ${
                done ? "border-[#e8542c] bg-[#f6b23c] text-[#2b2420]" : "border-[var(--cc-edge)] bg-[var(--cc-panel-2)] text-[var(--cc-muted)]"
              }`}
            >
              {reward ? "★" : ""}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-[var(--cc-muted)]">
        {next
          ? `★ ${next.days} days in a row unlocks ${next.label}, a new hunter.`
          : "Every hunter look unlocked. Best streak: " + s.best + " days."}
        {s.guest ? " Sign in to keep your streak on any device." : ""}
      </p>
    </section>
  );
}
