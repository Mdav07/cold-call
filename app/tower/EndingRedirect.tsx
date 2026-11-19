"use client";

// After Floor 3 is cleared, send the player through Krystal's ending cutscene once
// (cc-ending-seen). Signed-in clears come from the tower payload; guests use only this
// browser's cc-cleared-floor-3 flag — never the shared demo player's clears, or the ending
// would fire for every new guest the moment they hit the lobby.
// Lives outside Lobby.tsx so other agents can keep editing the lobby.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Floor = { floor: number; cleared: boolean };

export function EndingRedirect({ floors, guest }: { floors: Floor[]; guest: boolean }) {
  const router = useRouter();
  useEffect(() => {
    try {
      if (localStorage.getItem("cc-ending-seen") === "1") return;
      // Guests share the demo player's tower row; only this browser's clear counts for them.
      const cleared = guest
        ? localStorage.getItem("cc-cleared-floor-3") === "1"
        : floors.some((f) => f.floor === 3 && f.cleared);
      if (!cleared) return;
      router.replace("/ending");
    } catch {
      // storage blocked: don't trap anyone in the cutscene
    }
  }, [floors, guest, router]);
  return null;
}
