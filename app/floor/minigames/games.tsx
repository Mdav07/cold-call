"use client";

// The first four clue games (games2.tsx has four more). Each is 5–15 seconds, works with a mouse, a finger or the keyboard, and calls
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

// ---------- 1. Wires: drag each wire to the socket of its colour ----------

const WIRES = [
  { name: "red", hex: "#e05d5d" },
  { name: "blue", hex: "#5d8de0" },
  { name: "yellow", hex: "#f4c95d" },
  { name: "green", hex: "#6fbf73" },
];

/**
 * Press on a wire's plug and drag: a live wire follows the pointer (mouse or finger), and letting go
 * over the socket of the same colour connects it. Tapping a plug and then a socket works too, and so
 * does the keyboard (Tab or arrows to a plug, Enter, then to a socket, Enter).
 */
type Pt = { x: number; y: number };

export function Wires({ rand, onWin }: { rand: Rand; onWin: () => void }) {
  const [left] = useState(() => shuffle(WIRES, rand));
  const [right] = useState(() => shuffle(WIRES, rand));
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [miss, setMiss] = useState(false);
  const [drag, setDrag] = useState<{ name: string; x0: number; y0: number; x: number; y: number } | null>(null);
  const [lines, setLines] = useState<{ name: string; a: Pt; b: Pt }[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const doneRef = useRef<string[]>([]);

  const centre = (sel: string, side: "l" | "r") => {
    const root = box.current;
    const el = root?.querySelector<HTMLElement>(sel);
    if (!root || !el) return null;
    const a = root.getBoundingClientRect(), b = el.getBoundingClientRect();
    return { x: (side === "l" ? b.right : b.left) - a.left, y: b.top + b.height / 2 - a.top };
  };
  // A connected wire runs between the real plug and socket centres: measured when it's joined, and
  // again whenever the layout changes size.
  const measure = (names: string[]) =>
    names.flatMap((name) => {
      const a = centre(`[data-plug="${name}"]`, "l"), b = centre(`[data-socket="${name}"]`, "r");
      return a && b ? [{ name, a, b }] : [];
    });
  useEffect(() => {
    const ro = new ResizeObserver(() => setLines(measure(doneRef.current)));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const local = (e: { clientX: number; clientY: number }) => {
    const a = box.current!.getBoundingClientRect();
    return { x: e.clientX - a.left, y: e.clientY - a.top };
  };

  const join = (from: string | null, to: string) => {
    if (!from || doneRef.current.includes(to)) return;
    if (from === to) {
      const next = [...doneRef.current, to];
      doneRef.current = next;
      setDone(next);
      setLines(measure(next));
      tick();
      if (next.length === WIRES.length) onWin();
    } else {
      setMiss(true);
      setTimeout(() => setMiss(false), 350);
    }
    setPicked(null);
  };

  const hex = (name: string) => WIRES.find((w) => w.name === name)!.hex;

  return (
    <div ref={box} className={`relative grid grid-cols-[auto_1fr_auto] items-stretch gap-2 ${miss ? "cc-shake" : ""}`}>
      <div className="flex flex-col gap-1" role="group" aria-label="Wires" onKeyDown={(e) => arrowNav(e)}>
        {left.map((w) => (
          <button
            key={w.name}
            type="button"
            data-plug={w.name}
            disabled={done.includes(w.name)}
            aria-pressed={picked === w.name}
            aria-label={`${w.name} wire`}
            onClick={() => {
              tick();
              setPicked(w.name);
            }}
            onPointerDown={(e) => {
              if (done.includes(w.name)) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const a = centre(`[data-plug="${w.name}"]`, "l")!;
              const p = local(e);
              setDrag({ name: w.name, x0: a.x, y0: a.y, x: p.x, y: p.y });
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              const p = local(e);
              setDrag({ ...drag, x: p.x, y: p.y });
            }}
            onPointerUp={(e) => {
              if (!drag) return;
              const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-socket]");
              const moved = Math.hypot(local(e).x - drag.x0, local(e).y - drag.y0) > 24;
              setDrag(null);
              if (target) join(drag.name, target.dataset.socket!);
              else if (moved) setPicked(null);
            }}
            onPointerCancel={() => setDrag(null)}
            className={`h-10 w-16 touch-none border-2 ${picked === w.name ? "border-[var(--cc-ink)]" : "border-[var(--cc-edge)]"} disabled:opacity-60`}
            style={{ background: w.hex }}
          />
        ))}
      </div>
      <div aria-hidden />
      <div className="flex flex-col gap-1" role="group" aria-label="Sockets" onKeyDown={(e) => arrowNav(e)}>
        {right.map((w) => (
          <button
            key={w.name}
            type="button"
            data-socket={w.name}
            disabled={done.includes(w.name)}
            aria-label={`${w.name} socket`}
            onClick={() => join(picked, w.name)}
            className="grid h-10 w-16 place-items-center border-2 border-[var(--cc-edge)] bg-[var(--cc-bg)] disabled:opacity-60"
          >
            <span className="block size-5 rounded-full border-2 border-[var(--cc-edge)]" style={{ background: w.hex }} />
          </button>
        ))}
      </div>
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
        {lines.map((l) => (
          <line key={l.name} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke={hex(l.name)} strokeWidth={6} strokeLinecap="round" />
        ))}
        {drag && (
          <line x1={drag.x0} y1={drag.y0} x2={drag.x} y2={drag.y} stroke={hex(drag.name)} strokeWidth={6} strokeLinecap="round" />
        )}
      </svg>
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
