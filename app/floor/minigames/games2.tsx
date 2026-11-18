"use client";

// Four more clue games, so no room repeats one: stamp the matching invoices, crack the safe dial,
// sort the mail, repeat the light sequence. Same rules as games.tsx: 5–15 seconds, mouse, finger or
// keyboard, and onWin is called once. `rand` is seeded per prop.

import { useEffect, useRef, useState } from "react";
import { tick } from "@/app/floor/hud/sound";
import type { Rand } from "./games";

const CELL = "pixel-button min-h-11 min-w-11";
const OFF = "!bg-[var(--cc-panel-2)] !text-[var(--cc-ink)]";
const PAPER = "bg-[#efe7d6] text-[#2b2420]";

const shuffle = <T,>(a: T[], r: Rand): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** Move focus between sibling buttons with the arrow keys (rows and grids). */
function arrowNav(e: React.KeyboardEvent<HTMLElement>, cols = 1) {
  const keys: Record<string, number> = { ArrowDown: cols, ArrowUp: -cols, ArrowRight: 1, ArrowLeft: -1 };
  const step = keys[e.key];
  if (step == null) return;
  const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  const i = btns.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  btns[(i + step + btns.length) % btns.length]?.focus();
}

/** A short shake on a wrong answer. */
function useMiss(): [boolean, () => void] {
  const [miss, setMiss] = useState(false);
  return [miss, () => {
    setMiss(true);
    setTimeout(() => setMiss(false), 350);
  }];
}

// ---------- 5. Stamp: approve only the invoices that match the work order ----------

export function Stamp({ rand, onWin }: { rand: Rand; onWin: () => void }) {
  const [order] = useState(() => 1000 + Math.floor(rand() * 9000));
  // Three invoices match the work order; three are near misses (one digit off).
  const [cards] = useState(() => {
    const off = (n: number) => {
      const s = String(n).split("");
      const k = Math.floor(rand() * 4);
      s[k] = String((Number(s[k]) + 1 + Math.floor(rand() * 8)) % 10);
      return s.join("");
    };
    const good = [0, 1, 2].map((i) => ({ id: `g${i}`, wo: String(order), ok: true }));
    const bad = [0, 1, 2].map((i) => ({ id: `b${i}`, wo: off(order), ok: false }));
    return shuffle([...good, ...bad], rand);
  });
  const [stamped, setStamped] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);

  const stamp = (c: { id: string; ok: boolean }) => {
    if (stamped.includes(c.id)) return;
    if (!c.ok) {
      setWrong(c.id);
      setTimeout(() => setWrong(null), 350);
      return;
    }
    tick();
    const next = [...stamped, c.id];
    setStamped(next);
    if (next.length === 3) onWin();
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="font-pixel text-[10px] text-[var(--cc-muted)]">
        WORK ORDER <span className="text-[var(--cc-accent)]">WO-{order}</span>
      </p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Invoices" onKeyDown={(e) => arrowNav(e, 3)}>
        {cards.map((c) => {
          const done = stamped.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={done}
              onClick={() => stamp(c)}
              aria-label={`Invoice for WO-${c.wo}${done ? ", approved" : ""}`}
              className={`relative grid min-h-14 place-items-center border-2 border-[var(--cc-edge)] px-1 font-pixel text-[10px] ${PAPER} ${wrong === c.id ? "cc-shake" : ""}`}
            >
              <span className="text-[7px] opacity-70">INVOICE</span>
              <span>WO-{c.wo}</span>
              {done && (
                <span className="absolute inset-0 grid rotate-[-12deg] place-items-center font-pixel text-[11px] text-[#c23b3b]">
                  PAID
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- 6. Safe dial: turn to each number of the combination ----------

const DIAL = 20; // numbers on the dial, 0–19

export function SafeDial({ rand, onWin }: { rand: Rand; onWin: () => void }) {
  const [combo] = useState(() => {
    const a = Math.floor(rand() * DIAL);
    const b = (a + 4 + Math.floor(rand() * 10)) % DIAL;
    const c = (b + 4 + Math.floor(rand() * 10)) % DIAL;
    return [a, b, c];
  });
  const [at, setAt] = useState(0);
  const [step, setStep] = useState(0);
  const [miss, shake] = useMiss();
  const atRef = useRef(0);
  const stepRef = useRef(0);

  const turn = (d: number) => {
    tick();
    atRef.current = (atRef.current + d + DIAL) % DIAL;
    setAt(atRef.current);
  };
  const set = () => {
    if (stepRef.current >= 3) return;
    if (atRef.current !== combo[stepRef.current]) return shake();
    tick();
    stepRef.current += 1;
    setStep(stepRef.current);
    if (stepRef.current === 3) onWin();
  };

  // Keyboard: arrows turn, Enter or Space sets the number.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") turn(-1);
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") turn(1);
      else if (e.key === "Enter" || e.key === " ") set();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const angle = (at / DIAL) * 360;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-4">
      <div className="rotate-[-3deg] bg-[#f4e27a] px-3 py-2 font-pixel text-[#2b2420] shadow-[3px_3px_0_rgba(0,0,0,0.35)]">
        <p className="text-[8px]">SAFE</p>
        <p className="mt-1 text-sm tracking-[0.15em]">
          {combo.map((n, i) => (
            <span key={i} className={i < step ? "line-through opacity-50" : undefined}>
              {i ? "-" : ""}
              {n}
            </span>
          ))}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div
          className={`relative size-24 rounded-full border-4 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] [@media(max-height:500px)]:size-16 ${miss ? "cc-shake" : ""}`}
          aria-live="polite"
          aria-label={`Dial at ${at}, ${step} of 3 set`}
        >
          <div className="absolute inset-0 transition-transform duration-75" style={{ transform: `rotate(${angle}deg)` }} aria-hidden>
            <div className="absolute left-1/2 top-1 h-1/3 w-1.5 -translate-x-1/2 bg-[var(--cc-accent)]" />
          </div>
          <span className="absolute inset-0 grid place-items-center font-pixel text-base text-[var(--cc-ink)]">{at}</span>
        </div>
        <div className="flex gap-1">
          <button type="button" className={`${CELL} ${OFF}`} aria-label="Turn left" onClick={() => turn(-1)}>
            ◀
          </button>
          <button type="button" className={CELL} onClick={set}>
            Set
          </button>
          <button type="button" className={`${CELL} ${OFF}`} aria-label="Turn right" onClick={() => turn(1)}>
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 7. Mail sort: drop each letter in its department's pigeonhole ----------

const DEPTS = ["PAYABLES", "PAYROLL", "LEGAL", "IT"];

export function MailSort({ rand, onWin }: { rand: Rand; onWin: () => void }) {
  const [letters] = useState(() => Array.from({ length: 5 }, () => DEPTS[Math.floor(rand() * DEPTS.length)]));
  const [holes] = useState(() => shuffle(DEPTS, rand));
  const [n, setN] = useState(0);
  const [miss, shake] = useMiss();

  const drop = (d: string) => {
    if (n >= letters.length) return;
    if (d !== letters[n]) return shake();
    tick();
    const next = n + 1;
    setN(next);
    if (next === letters.length) onWin();
  };

  const left = letters.length - n;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className={`grid min-h-14 min-w-28 place-items-center border-2 border-[var(--cc-edge)] px-2 font-pixel ${PAPER} ${miss ? "cc-shake" : ""}`} aria-live="polite">
          <span className="text-[7px] opacity-70">INTERNAL MAIL · ATTN</span>
          <span className="text-[11px]">{left ? letters[n] : "ALL SORTED"}</span>
        </div>
        <p className="font-pixel text-[9px] text-[var(--cc-muted)]">{left} left</p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Pigeonholes" onKeyDown={(e) => arrowNav(e, 2)}>
        {holes.map((d) => (
          <button key={d} type="button" className={`${CELL} ${OFF} !min-h-12 font-pixel text-[10px]`} onClick={() => drop(d)}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- 8. Alarm panel: repeat the light sequence ----------

const LIGHTS = [
  { name: "red", hex: "#e05d5d" },
  { name: "blue", hex: "#5d8de0" },
  { name: "yellow", hex: "#f4c95d" },
  { name: "green", hex: "#6fbf73" },
];

export function Sequence({ rand, onWin }: { rand: Rand; onWin: () => void }) {
  const [seq] = useState(() => Array.from({ length: 4 }, () => Math.floor(rand() * LIGHTS.length)));
  const [lit, setLit] = useState<number | null>(null);
  const [showing, setShowing] = useState(true);
  const [got, setGot] = useState(0);
  const [miss, shake] = useMiss();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // The lights blink in order, then it's the player's turn.
  const schedule = () => {
    timers.current.forEach(clearTimeout);
    timers.current = seq.flatMap((l, i) => [
      setTimeout(() => setLit(l), 500 + i * 650),
      setTimeout(() => setLit(null), 500 + i * 650 + 420),
    ]);
    timers.current.push(setTimeout(() => setShowing(false), 500 + seq.length * 650));
  };
  const play = () => {
    setShowing(true);
    setGot(0);
    schedule();
  };
  useEffect(() => {
    schedule();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const press = (l: number) => {
    if (showing || got >= seq.length) return;
    setLit(l);
    setTimeout(() => setLit(null), 180);
    if (l !== seq[got]) {
      shake();
      setTimeout(play, 500);
      return;
    }
    tick();
    const next = got + 1;
    setGot(next);
    if (next === seq.length) onWin();
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="font-pixel text-[9px] text-[var(--cc-muted)]" aria-live="polite">
        {showing ? "Watch the lights…" : `Your turn · ${got} of ${seq.length}`}
      </p>
      <div className={`grid grid-cols-4 gap-2 ${miss ? "cc-shake" : ""}`} role="group" aria-label="Alarm lights" onKeyDown={(e) => arrowNav(e)}>
        {LIGHTS.map((l, i) => (
          <button
            key={l.name}
            type="button"
            aria-label={`${l.name} light`}
            onClick={() => press(i)}
            className="h-14 border-2 border-[var(--cc-edge)] transition-[filter,opacity] duration-75"
            style={{ background: l.hex, opacity: lit === i ? 1 : 0.35, filter: lit === i ? "brightness(1.3)" : undefined }}
          />
        ))}
      </div>
      <button type="button" className={`${CELL} ${OFF} self-start font-pixel text-[9px]`} disabled={showing} onClick={play}>
        Watch again
      </button>
    </div>
  );
}
