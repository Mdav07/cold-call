"use client";

// DAILY CASE in the lobby's top bar: today's case and the six before it. Today counts for the board and
// the streak; an earlier day is practice (/daily?date=…), played the same way but never counted.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { dailyCase, recentDailyDates } from "@/shared/dailyCase";

const dayLabel = (date: string, i: number) =>
  i === 0 ? "Today" : i === 1 ? "Yesterday" : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function DailyArchive() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<{ date: string; title: string; who: string }[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const toggle = () => {
    // The dates are the browser's "now": computed when opened, never during server render.
    if (!open) {
      setDays(recentDailyDates().map((date) => {
        const c = dailyCase(date);
        return { date, title: c.title, who: c.employee.name };
      }));
    }
    setOpen(!open);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        className="border-2 border-[var(--cc-accent)] bg-[var(--cc-panel-2)] px-2 py-1 text-[var(--cc-accent)] hover:bg-[var(--cc-accent)] hover:text-[var(--cc-edge)]"
        aria-expanded={open}
        onClick={toggle}
      >
        DAILY CASE {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="pixel-frame absolute left-0 top-full z-30 mt-3 flex w-72 max-w-[calc(100vw-2rem)] flex-col bg-[var(--cc-panel)] p-2">
          {days.map((d, i) => (
            <Link
              key={d.date}
              href={i === 0 ? "/daily" : `/daily?date=${d.date}`}
              onClick={() => setOpen(false)}
              className="flex flex-col gap-1 px-2 py-2 hover:bg-[var(--cc-panel-2)]"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className={i === 0 ? "text-[var(--cc-accent)]" : undefined}>{dayLabel(d.date, i)}</span>
                <span className="text-[8px] text-[var(--cc-muted)]">{i === 0 ? "COUNTS" : "PRACTICE"}</span>
              </span>
              <span className="text-[9px] leading-relaxed text-[var(--cc-muted)]">
                {d.title} · {d.who}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
