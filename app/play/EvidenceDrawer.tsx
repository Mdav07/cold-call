"use client";

// Ace Attorney–style evidence panel: list this floor's documents; choose one to present.

import { useEffect, useId, useRef } from "react";
import evidence from "@/content/plumpurse/evidence.json";

export type EvidenceItem = {
  id: string;
  floor: number;
  label: string;
  text: string;
};

const ALL = evidence.items as EvidenceItem[];

export function evidenceForFloor(floor: number): EvidenceItem[] {
  return ALL.filter((e) => e.floor === floor);
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function EvidenceDrawer({
  floor,
  open,
  onClose,
  onPresent,
}: {
  floor: number;
  open: boolean;
  onClose: () => void;
  /** Called with the chosen item's body text when the player presents it. */
  onPresent: (text: string, item: EvidenceItem) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const items = evidenceForFloor(floor);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
      );
      if (nodes.length === 0) return;
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
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pixel-frame flex max-h-[80vh] w-full max-w-lg flex-col gap-3 bg-[var(--cc-panel)] p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <p id={titleId} className="font-pixel text-sm text-[var(--cc-ink)]">
            Evidence · Floor {floor === 0 ? "0 (Pocket Branch)" : floor}
          </p>
          <button
            ref={closeRef}
            type="button"
            className="pixel-button"
            onClick={onClose}
            aria-label="Close evidence drawer"
          >
            Close
          </button>
        </div>
        <p className="text-xs text-[var(--cc-muted)]">
          Choose a document to present. Escape closes.
        </p>
        <ul className="flex flex-col gap-2 overflow-y-auto">
          {items.length === 0 ? (
            <li className="text-sm text-[var(--cc-muted)]">No evidence for this floor yet.</li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="pixel-frame w-full bg-[var(--cc-panel-2)] px-3 py-3 text-left hover:bg-[var(--cc-dialog)]"
                  onClick={() => onPresent(item.text, item)}
                >
                  <span className="font-pixel block text-xs text-[var(--cc-accent)]">{item.label}</span>
                  <span className="mt-1 block text-sm text-[var(--cc-ink)]">{item.text}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
