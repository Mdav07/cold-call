"use client";

import { useState } from "react";
import { useClientValue } from "@/app/play/clientHooks";

const STORAGE_KEY = "coldcall-casefile-my-notes";

export function MyNotes() {
  // null until hydrated (storage is browser-only); then what was saved, until the player types.
  const saved = useClientValue<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return ""; // private mode / blocked storage
    }
  }, null);
  const [edited, setEdited] = useState<string | null>(null);
  const ready = saved !== null;
  const text = edited ?? saved ?? "";

  const onChange = (value: string) => {
    setEdited(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore write failures
    }
  };

  return (
    <section aria-labelledby="my-notes-heading" className="flex flex-col gap-2">
      <h2 id="my-notes-heading" className="font-pixel text-[10px] text-[var(--cc-accent)]">
        My notes
      </h2>
      <p className="text-xs text-[var(--cc-muted)]">Scratch space for what you pick up. Saved on this device only.</p>
      <textarea
        className="min-h-56 w-full resize-y border border-[#d8ccb0] bg-[#fffdf6] px-3 text-sm leading-7 text-[var(--cc-ink)] placeholder:text-[var(--cc-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-accent)]"
        style={{
          // Ruled paper: a faint blue line every 1.75rem, matching the line height.
          backgroundImage: "repeating-linear-gradient(transparent 0 calc(1.75rem - 1px), #c8d4e8 calc(1.75rem - 1px) 1.75rem)",
          backgroundAttachment: "local",
          paddingTop: "0.2rem",
        }}
        value={ready ? text : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write what you notice…"
        aria-label="My notes"
        disabled={!ready}
      />
    </section>
  );
}
