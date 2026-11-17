"use client";

import { useEffect, useRef, useState } from "react";
import { confirm, tick } from "@/app/floor/hud/sound";

export interface Choice {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

/**
 * A row of choices with a cursor. Arrow keys move it, Space or Enter confirms.
 * Keys are read from the window so the player does not have to click first; while a text
 * field has focus the keys belong to the field.
 * `active` false (e.g. while the typewriter is still running) ignores the keyboard.
 */
export function Choices({ choices, active = true }: { choices: Choice[]; active?: boolean }) {
  const [cursor, setCursor] = useState(0);
  const ref = useRef(choices);
  const at = Math.min(cursor, choices.length - 1);
  const atRef = useRef(at);
  useEffect(() => {
    ref.current = choices;
    atRef.current = at;
  });

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      // An open modal (case file, evidence) owns the keyboard.
      if (document.querySelector("[aria-modal=true]")) return;
      const list = ref.current;
      const move = (d: number) => {
        e.preventDefault();
        tick();
        setCursor((c) => {
          let n = Math.min(c, list.length - 1);
          for (let i = 0; i < list.length; i++) {
            n = (n + d + list.length) % list.length;
            if (!list[n].disabled) break;
          }
          return n;
        });
      };
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "d" || e.key === "s") move(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "a" || e.key === "w") move(-1);
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const pick = list[atRef.current];
        if (pick && !pick.disabled) {
          confirm();
          pick.onSelect();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  // Omori-style cells: each choice sits in a small frame; the selected one fills with the
  // speaker's accent (dark ink on it, AA) and the pointer sits outside its left edge.
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-2 pl-4 sm:flex sm:flex-wrap sm:gap-x-4" role="menu">
      {choices.map((c, i) => {
        const on = i === at;
        return (
          <li key={c.label} role="none" className="relative">
            <span
              aria-hidden
              className={`cc-next absolute -left-4 top-1/2 -mt-2 text-xs text-[var(--cc-accent)] ${on ? "" : "invisible"}`}
              style={{ animationDuration: "0.4s" }}
            >
              ▶
            </span>
            <button
              type="button"
              role="menuitem"
              disabled={c.disabled}
              onMouseEnter={() => {
                if (c.disabled || on) return;
                tick();
                setCursor(i);
              }}
              onClick={() => {
                confirm();
                c.onSelect();
              }}
              aria-current={on ? "true" : undefined}
              className={`w-full border-2 px-3 py-1.5 text-left font-pixel text-[10px] transition-colors duration-75 disabled:opacity-40 sm:w-auto ${
                on
                  ? "border-[var(--cc-accent)] bg-[var(--cc-accent)] text-[var(--cc-edge)]"
                  : "border-[var(--cc-border)] bg-transparent text-[var(--cc-ink)]"
              }`}
            >
              {c.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
