import { Suspense } from "react";
import { signedInUserId } from "@/server/game/auth";
import { getDemoUserId } from "@/server/game/players";
import { getTower } from "@/server/game/tower";
import { dailyCleared } from "@/server/game/dailyBoard";
import { Lobby } from "./Lobby";
import { EndingRedirect } from "./EndingRedirect";
import { buildLobby, lobbyGuide } from "./lobbyMap";

async function Floors({ searchParams }: { searchParams: PageProps<"/tower">["searchParams"] }) {
  // ?at=floor-N / daily: you came back from that level (RESTART), so you stand at its entrance.
  const at = (await searchParams).at;
  const signedIn = await signedInUserId();
  const userId = signedIn ?? (process.env.SUPABASE_SERVICE_ROLE_KEY ? await getDemoUserId() : null);
  const [floors, caseDone] = await Promise.all([
    getTower(userId),
    signedIn ? dailyCleared(signedIn) : Promise.resolve(false),
  ]);
  return (
    <>
      {/* First Floor-3 clear: Krystal's ending cutscene (Fatwallet tease) before the lobby. */}
      <EndingRedirect floors={floors} guest={!signedIn} />
      <Lobby
        map={buildLobby(floors, typeof at === "string" ? at : null)}
        floors={floors}
        guide={lobbyGuide(floors)}
        guest={!signedIn}
        // The Daily Case popup: signed-in players by their account; guests by this browser (DailyPopup).
        tutorialCleared={signedIn ? !!floors.find((f) => f.floor === 0)?.cleared : undefined}
        dailyClearedToday={caseDone}
      />
    </>
  );
}

// The lobby is a walkable floor; the old card list is in git history (before the night UI pass).
export default function TowerPage({ searchParams }: PageProps<"/tower">) {
  return (
    <Suspense fallback={<main className="cc-floor-1 flex h-dvh items-center justify-center font-pixel text-xs text-[var(--cc-muted)]">Opening the lobby…</main>}>
      <Floors searchParams={searchParams} />
    </Suspense>
  );
}
