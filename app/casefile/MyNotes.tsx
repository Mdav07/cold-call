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
    <section aria-labelledby="my-notes-heading" className="flex flex-col gap-3">
      <h2 id="my-notes-heading" className="font-pixel text-xs text-[var(--cc-accent)]">
        My notes
      </h2>
      <p className="text-sm text-[var(--cc-muted)]">
        Scratch space for what you pick up. Saved on this device only.
      </p>
      <textarea
        className="min-h-48 w-full resize-y border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] p-3 text-sm text-[var(--cc-ink)] placeholder:text-[var(--cc-muted)] focus-visible:outline-2 focus-visible:outline-[var(--cc-accent)] focus-visible:outline-offset-2"
        value={ready ? text : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write what you notice…"
        aria-label="My notes"
        disabled={!ready}
      />
    </section>
  );
}
