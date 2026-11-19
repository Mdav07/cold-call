"use client";

// The game opens in the tower lobby. A first-time player (no cc-intro-seen in this browser) sees
// Krystal's intro, then sign-in, then hunter pick if needed. The check needs localStorage, so it runs in the browser.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function introSeen(): boolean {
  try {
    return localStorage.getItem("cc-intro-seen") === "1";
  } catch {
    return true; // storage blocked: don't trap the player in the intro
  }
}

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(introSeen() ? "/tower" : "/intro");
  }, [router]);
  return (
    <main className="cc-floor-1 grid min-h-dvh flex-1 place-items-center bg-[#15141a]">
      <p className="font-pixel text-[10px] text-[var(--cc-muted)]">Cold Call…</p>
    </main>
  );
}
