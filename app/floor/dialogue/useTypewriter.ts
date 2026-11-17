"use client";

import { useCallback, useEffect, useState } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Reveals `text` one character at a time. `skip()` shows the rest at once.
 * With prefers-reduced-motion the text appears whole.
 */
export function useTypewriter(text: string, charsPerSecond = 60) {
  const [shown, setShown] = useState(0);
  const [prev, setPrev] = useState(text);

  // A new line restarts the reveal (state adjusted during render, not in an effect).
  if (prev !== text) {
    setPrev(text);
    setShown(0);
  }

  useEffect(() => {
    if (reducedMotion()) {
      setShown(text.length);
      return;
    }
    const step = 1000 / charsPerSecond;
    const t = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(t);
          return n;
        }
        return n + 1;
      });
    }, step);
    return () => clearInterval(t);
  }, [text, charsPerSecond]);

  const skip = useCallback(() => setShown(text.length), [text]);
  const done = shown >= text.length;
  return { visible: text.slice(0, shown), done, skip };
}
