"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "coldcall-casefile-my-notes";

export function MyNotes() {
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved != null) setText(saved);
    } catch {
      // private mode / blocked storage — keep empty
    }
    setReady(true);
  }, []);

  const onChange = (value: string) => {
    setText(value);
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
