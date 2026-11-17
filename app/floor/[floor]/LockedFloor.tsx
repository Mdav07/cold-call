"use client";

import { useEffect, useRef } from "react";

/**
 * Covers a floor the player has not unlocked. It swallows game keys (capture phase on window,
 * before the engine and the dialogue box see them) but leaves Tab and Enter for the link.
 */
export function LockedFloor({ floor, below }: { floor: number; below: string }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    link.current?.focus();
    const swallow = (e: KeyboardEvent) => {
      if (e.key === "Tab" || (e.key === "Enter" && (e.target as HTMLElement)?.tagName === "A")) return;
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", swallow, true);
    window.addEventListener("keyup", swallow, true);
    return () => {
      window.removeEventListener("keydown", swallow, true);
      window.removeEventListener("keyup", swallow, true);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--cc-bg)] p-4" role="dialog" aria-modal="true" aria-labelledby="locked-title">
      <div className="pixel-frame flex max-w-md flex-col gap-4 bg-[var(--cc-panel)] p-5 text-center">
        <p id="locked-title" className="font-pixel text-sm text-[var(--cc-danger)]">
          Floor {floor} is locked
        </p>
        <p className="text-sm text-[var(--cc-ink)]">
          The elevator won&apos;t stop here yet. Clear {below} first.
        </p>
        <a ref={link} href="/tower" className="pixel-button self-center">
          ◀ Back to the tower
        </a>
      </div>
    </div>
  );
}
