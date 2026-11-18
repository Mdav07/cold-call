"use client";

// The four clue games. Each is 5–15 seconds, works with a mouse, a finger or the keyboard, and calls
// onWin once. `rand` is seeded per prop, so a clue's puzzle is the same each time you open it.

import { useEffect, useRef, useState } from "react";
import { chime, tick } from "@/app/floor/hud/sound";

export type Rand = () => number;
const shuffle = <T,>(a: T[], r: Rand): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

const CELL = "pixel-button min-h-11 min-w-11";
const OFF = "!bg-[var(--cc-panel-2)] !text-[var(--cc-ink)]";

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

// ---------- 1. Wires: join each wire to the socket of its colour ----------

const WIRES = [
  { name: "red", hex: "#e05d5d" },
  { name: "blue", hex: "#5d8de0" },
  { name: "yellow", hex: "#f4c95d" },
  { name: "green", hex: "#6fbf73" },
];

export function Wires({ rand, onWin }: { rand: Rand; onWin: () => void }) {
  const [left] = useState(() => shuffle(WIRES, rand));
  const [right] = useState(() => shuffle(WIRES, rand));
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [miss, setMiss] = useState(false);
  const ROW = 44; // 40px buttons + 4px gap

  const join = (name: string) => {
    if (!picked) return;
    if (picked === name) {
      const next = [...done, name];
      setDone(next);
      tick();
      if (next.length === WIRES.length) onWin();
    } else {
      setMiss(true);
      setTimeout(() => setMiss(false), 350);
    }
    setPicked(null);
  };

  return (
    <div className={`grid grid-cols-[auto_1fr_auto] items-stretch gap-2 ${miss ? "cc-shake" : ""}`}>
      <div className="flex flex-col gap-1" role="group" aria-label="Wires" onKeyDown={(e) => arrowNav(e)}>
        {left.map((w) => (
          <button
            key={w.name}
            type="button"
            disabled={done.includes(w.name)}
            aria-pressed={picked === w.name}
            aria-label={`${w.name} wire`}
            onClick={() => {
              tick();
              setPicked(w.name);
            }}
            className={`h-10 w-16 border-2 ${picked === w.name ? "border-[var(--cc-ink)]" : "border-[var(--cc-edge)]"} disabled:opacity-60`}
            style={{ background: w.hex }}
          />
        ))}
      </div>
      <svg className="w-full" style={{ height: ROW * 4 - 4 }} viewBox={`0 0 100 ${ROW * 4}`} preserveAspectRatio="none" aria-hidden>
        {done.map((name) => {
          const a = left.findIndex((w) => w.name === name);
          const b = right.findIndex((w) => w.name === name);
          return (
            <line
              key={name}
              x1={0}
              y1={a * ROW + 20}
              x2={100}
              y2={b * ROW + 20}
              stroke={WIRES.find((w) => w.name === name)!.hex}
              strokeWidth={6}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-1" role="group" aria-label="Sockets" onKeyDown={(e) => arrowNav(e)}>
        {right.map((w) => (
          <button
            key={w.name}
            type="button"
            disabled={done.includes(w.name)}
            aria-label={`${w.name} socket`}
            onClick={() => join(w.name)}
            className="grid h-10 w-16 place-items-center border-2 border-[var(--cc-edge)] bg-[var(--cc-bg)] disabled:opacity-60"
          >
            <span className="block size-5 rounded-full border-2 border-[var(--cc-edge)]" style={{ background: w.hex }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- 2. Keycard: hold to swipe, let go in the green ----------

/** The card moves while held; let go while it's over the reader (the green zone). */
export function Keycard({ onWin }: { rand: Rand; onWin: () => void }) {
  const [pos, setPos] = useState(0); // 0..1 along the slot
  const [msg, setMsg] = useState("Hold, then let go in the green.");
  const held = useRef(false);
  const start = useRef(0);
  const won = useRef(false);
  const SPEED = 0.9; // slot widths per second: the whole swipe takes a little over a second
  const ZONE: [number, number] = [0.72, 0.9];

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (held.current) {
        const p = Math.min(1, ((performance.now() - start.current) / 1000) * SPEED);
        setPos(p);
        if (p >= 1) {
          held.current = false;
          setMsg("Too far! Try again.");
          setTimeout(() => setPos(0), 300);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const press = () => {
    if (won.current || held.current) return;
    held.current = true;
    start.current = performance.now();
    tick();
  };
  const release = () => {
    if (!held.current) return;
    held.current = false;
    const p = Math.min(1, ((performance.now() - start.current) / 1000) * SPEED);
    if (p >= ZONE[0] && p <= ZONE[1]) {
      won.current = true;
      setPos(p);
      setMsg("Accepted.");
      onWin();
    } else {
      setMsg(p < ZONE[0] ? "Too short. Try again." : "Too far! Try again.");
      setTimeout(() => setPos(0), 300);
    }
  };

  // Keyboard: hold Space or Enter.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        press();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        release();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-14 border-2 border-[var(--cc-edge)] bg-[var(--cc-bg)]">
        <div
          className="absolute inset-y-0 bg-[var(--cc-ok,#6fbf73)]/35"
          style={{ left: `${ZONE[0] * 100}%`, width: `${(ZONE[1] - ZONE[0]) * 100}%` }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 h-10 w-14 -translate-y-1/2 border-2 border-[var(--cc-edge)] bg-[var(--cc-accent)]"
          style={{ left: `calc(${pos} * (100% - 3.5rem))` }}
          aria-hidden
        >
          <div className="mx-1 mt-1 h-1.5 bg-[var(--cc-edge)]" />
        </div>
      </div>
      <button
        type="button"
        className={`${CELL} touch-none select-none`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={(e) => e.preventDefault()}
      >
        Hold to swipe
      </button>
      <p className="font-pixel text-[10px] text-[var(--cc-muted)]" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}

// ---------- 3. Keypad: type the code from the sticky note ----------

export function Keypad({ rand, onWin, easy = false }: { rand: Rand; onWin: () => void; easy?: boolean }) {
  const len = easy ? 3 : 4;
  const [code] = useState(() => Array.from({ length: len }, () => Math.floor(rand() * 10)).join(""));
  const [typed, setTyped] = useState("");
  const [miss, setMiss] = useState(false);
  const typedRef = useRef("");

  const press = (d: string) => {
    if (typedRef.current.length >= len) return;
    tick();
    const next = typedRef.current + d;
    typedRef.current = next;
    setTyped(next);
    if (next.length === len) {
      if (next === code) onWin();
      else {
        setMiss(true);
        setTimeout(() => {
          typedRef.current = "";
          setTyped("");
          setMiss(false);
        }, 450);
      }
    }
  };
  const back = () => {
    typedRef.current = typedRef.current.slice(0, -1);
    setTyped(typedRef.current);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-4 [@media(max-height:500px)]:items-center">
      <div className="rotate-[-3deg] bg-[#f4e27a] px-3 py-2 font-pixel text-[11px] leading-relaxed text-[#2b2420] shadow-[3px_3px_0_rgba(0,0,0,0.35)]">
        <p className="text-[8px]">DOOR CODE</p>
        <p className="mt-1 text-base tracking-[0.2em]">{code}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p
          className={`border-2 border-[var(--cc-edge)] bg-[var(--cc-bg)] px-2 py-1 text-center font-pixel text-base tracking-[0.4em] text-[var(--cc-accent)] ${miss ? "cc-shake text-[var(--cc-danger)]" : ""}`}
          aria-live="polite"
          aria-label={`Typed ${typed.length} of ${len}`}
        >
          {typed.padEnd(len, "·")}
        </p>
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Keypad" onKeyDown={(e) => arrowNav(e, 3)}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" className={`${CELL} ${OFF} !min-h-10 !px-0`} onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button type="button" className={`${CELL} ${OFF} !min-h-10 !px-0`} onClick={back} aria-label="Delete">
            <span className="text-[9px]">DEL</span>
          </button>
          <button type="button" className={`${CELL} ${OFF} !min-h-10 !px-0`} onClick={() => press("0")}>
            0
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 4. Shredded strips: put the shredded memo back in order ----------

const WORDS = ["INVOICE", "PAYROLL", "LEDGER", "VENDOR", "RECEIPT", "TRANSFER", "CHEQUE", "ACCOUNT"];

export function Shred({ rand, onWin }: { rand: Rand; onWin: () => void }) {
  const [word] = useState(() => WORDS[Math.floor(rand() * WORDS.length)]);
  // Four strips, each a slice of the word, in order.
  const [strips] = useState(() => {
    const n = 4;
    const size = Math.ceil(word.length / n);
    return Array.from({ length: n }, (_, i) => ({ i, text: word.slice(i * size, (i + 1) * size) || "·" }));
  });
  const [shown] = useState(() => shuffle(strips, rand));
  const [placed, setPlaced] = useState(0);
  const [miss, setMiss] = useState<number | null>(null);

  const take = (i: number) => {
    if (i === placed) {
      tick();
      const next = placed + 1;
      setPlaced(next);
      if (next === strips.length) onWin();
    } else {
      setMiss(i);
      setTimeout(() => setMiss(null), 350);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-14 items-stretch justify-center gap-0.5 border-2 border-dashed border-[var(--cc-edge)] bg-[var(--cc-bg)] p-1">
        {strips.slice(0, placed).map((s) => (
          <span key={s.i} className="grid min-w-10 place-items-center bg-[#efe7d6] px-1 font-pixel text-base text-[#2b2420]">
            {s.text}
          </span>
        ))}
      </div>
      <div className="flex justify-center gap-2" role="group" aria-label="Strips" onKeyDown={(e) => arrowNav(e)}>
        {shown.map((s) =>
          s.i < placed ? (
            <span key={s.i} className="min-h-14 min-w-12" aria-hidden />
          ) : (
            <button
              key={s.i}
              type="button"
              onClick={() => take(s.i)}
              aria-label={`Strip ${s.text}`}
              className={`grid min-h-14 min-w-12 place-items-center border-2 border-[var(--cc-edge)] bg-[#efe7d6] px-1 font-pixel text-base text-[#2b2420] [clip-path:polygon(0_4%,100%_0,96%_100%,4%_96%)] ${miss === s.i ? "cc-shake" : ""}`}
            >
              {s.text}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export const winSound = chime;
