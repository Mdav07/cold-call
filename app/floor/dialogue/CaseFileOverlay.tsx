"use client";

// The case file inside the game: the manila folder over the floor, no new tab.
// Escape or Close shuts it and gives focus back; Tab stays inside while it is open.

import { useEffect, useRef } from "react";
import { CaseFile } from "@/app/casefile/CaseFile";
import type { DailyCase } from "@/shared/dailyCase";
import type { CaseData } from "@/app/casefile/data";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function CaseFileOverlay({
  data,
  floor,
  unlockedFloors,
  daily,
  onClose,
}: {
  /** The case file's contents for the unlocked floors, from the server. */
  data: CaseData;
  floor: number;
  unlockedFloors: number[];
  /** Today's Daily Case, which has its own small file. */
  daily?: DailyCase;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[role=tab][aria-selected=true]")?.focus();
    // On the document, so it runs before the window listeners of the dialogue box and the
    // engine; preventDefault tells the box's Escape handler the key is taken.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const nodes = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#15141a]/95 p-2 sm:items-center sm:bg-black/75 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Case file"
        className="flex max-h-full w-full max-w-3xl flex-col sm:max-h-[min(90dvh,52rem)]"
      >
        <CaseFile data={data} floor={floor} unlockedFloors={unlockedFloors} daily={daily} fill onClose={onClose} />
      </div>
    </div>
  );
}
