"use client";

// "◀ Back": returns to the previous page when the player came from inside the game, otherwise
// goes to `fallback`. It is a real link, so it also works without JavaScript and in a new tab.

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

export function BackButton({ fallback = "/tower", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    let fromHere = false;
    try {
      fromHere = !!document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1;
    } catch {
      // unparsable referrer: use the fallback
    }
    if (!fromHere) return; // the link itself goes to the fallback
    e.preventDefault();
    router.back();
  };
  return (
    <a href={fallback} onClick={onClick} className="pixel-button inline-flex items-center gap-2 !px-3 !py-2 no-underline">
      <span aria-hidden>◀</span> {label}
    </a>
  );
}
