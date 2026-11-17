"use client";

import { useEffect, useRef, useState } from "react";

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
      const list = ref.current;
      const move = (d: number) => {
        e.preventDefault();
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
        if (pick && !pick.disabled) pick.onSelect();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2" role="menu">
      {choices.map((c, i) => (
        <li key={c.label} role="none">
          <button
            type="button"
            role="menuitem"
            disabled={c.disabled}
            onMouseEnter={() => !c.disabled && setCursor(i)}
            onClick={c.onSelect}
            className="font-pixel text-xs text-[var(--cc-ink)] disabled:opacity-40"
            aria-current={i === at ? "true" : undefined}
          >
            <span className="inline-block w-4 text-[var(--cc-accent)]" aria-hidden>
              {i === at ? "▶" : ""}
            </span>
            {c.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
