import { Suspense } from "react";
import { signedInUserId } from "@/server/game/auth";
import { getDemoUserId } from "@/server/game/players";
import { getTower } from "@/server/game/tower";
import { getDaily } from "@/server/game/daily";
import { dailyCleared } from "@/server/game/dailyBoard";
import { Lobby } from "./Lobby";
import { buildLobby, lobbyGuide } from "./lobbyMap";

async function Floors() {
  const signedIn = await signedInUserId();
  const userId = signedIn ?? (process.env.SUPABASE_SERVICE_ROLE_KEY ? await getDemoUserId() : null);
  const [floors, daily, caseDone] = await Promise.all([
    getTower(userId),
    getDaily(userId),
    signedIn ? dailyCleared(signedIn) : Promise.resolve(false),
  ]);
  const c = daily.contract;
  const dailyText = c
    ? `Today: Floor ${c.floor}. ${c.modifier} ${daily.clearedToday ? "Cleared today; come back tomorrow." : "Clear it for the full bounty."} Streak: ${daily.streak.current} days (best ${daily.streak.longest}).`
    : null;
  return (
    <Lobby
      map={buildLobby(floors, dailyText)}
      guide={lobbyGuide(floors)}
      guest={!signedIn}
      // The Daily Case popup: signed-in players by their account; guests by this browser (DailyPopup).
      tutorialCleared={signedIn ? !!floors.find((f) => f.floor === 0)?.cleared : undefined}
      dailyClearedToday={caseDone}
    />
  );
}

// The lobby is a walkable floor; the old card list is in git history (before the night UI pass).
export default function TowerPage() {
  return (
    <Suspense fallback={<main className="cc-floor-1 flex h-dvh items-center justify-center font-pixel text-xs text-[var(--cc-muted)]">Opening the lobby…</main>}>
      <Floors />
    </Suspense>
  );
}
