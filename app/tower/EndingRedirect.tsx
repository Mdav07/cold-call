"use client";

// After Floor 3 is cleared, send the player through Krystal's ending cutscene once
// (cc-ending-seen). Signed-in clears come from the tower payload; guests use this browser's
// cc-cleared-floor-3 flag. Lives outside Lobby.tsx so other agents can keep editing the lobby.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Floor = { floor: number; cleared: boolean };

export function EndingRedirect({ floors }: { floors: Floor[] }) {
  const router = useRouter();
  useEffect(() => {
    try {
      if (localStorage.getItem("cc-ending-seen") === "1") return;
      const serverClear = floors.some((f) => f.floor === 3 && f.cleared);
      const guestClear = localStorage.getItem("cc-cleared-floor-3") === "1";
      if (!serverClear && !guestClear) return;
      router.replace("/ending");
    } catch {
      // storage blocked: don't trap anyone in the cutscene
    }
  }, [floors, router]);
  return null;
}
