import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import directory from "@/content/plumpurse/directory.json";
import type { EmployeeId } from "@/shared/interfaces";
import type { FloorMap } from "@/app/floor/types";
import type { NpcInfo } from "@/app/floor/dialogue/DialogueBox";
import { HudVault } from "@/app/floor/hud/HudVault";
import { unlockedFloorsForRequest } from "@/server/game/unlocks";
import { caseDataFor, EMPTY_CASE_DATA } from "@/app/casefile/data";
import floor0 from "@/app/floor/maps/floor-0.json";
import floor1 from "@/app/floor/maps/floor-1.json";
import floor2 from "@/app/floor/maps/floor-2.json";
import floor3 from "@/app/floor/maps/floor-3.json";
import { FloorGame } from "./FloorGame";
import { Gate } from "./Gate";

/** One map per floor, from B (app/floor/maps/src compiles to these). */
const MAPS: Record<string, FloorMap> = {
  "0": floor0 as unknown as FloorMap,
  "1": floor1 as unknown as FloorMap,
  "2": floor2 as unknown as FloorMap,
  "3": floor3 as unknown as FloorMap,
};

const PLAYER_SPRITE = "/sprites/hunter.png";

/** Provisional unlocks while tower data streams in (current floor must be open to be here). */
function provisionalUnlocks(floor: number): number[] {
  if (floor === 0) return [0];
  return Array.from({ length: floor }, (_, i) => i + 1);
}

export function generateStaticParams() {
  return Object.keys(MAPS).map((floor) => ({ floor }));
}

export default async function FloorPage({ params }: PageProps<"/floor/[floor]">) {
  const { floor } = await params;
  const map = MAPS[floor];
  if (!map) notFound();

  const npcs: NpcInfo[] = map.npcs.map((n) => {
    const e = directory.employees.find((x) => x.id === n.id);
    return { id: n.id as EmployeeId, name: e?.name ?? n.id, title: e?.title ?? "" };
  });

  const shared = {
    map,
    npcs,
    playerSprite: PLAYER_SPRITE,
    defaultCover: "", // no cover-story step: the player introduces themselves in their first message
    vault: (
      <Suspense fallback={<span className="text-[var(--cc-muted)]">VAULT …</span>}>
        <HudVault floor={map.floor} />
      </Suspense>
    ) as ReactNode,
    gate: (
      <Suspense fallback={null}>
        <Gate floor={map.floor} />
      </Suspense>
    ) as ReactNode,
  };

  return (
    <Suspense fallback={<FloorGame {...shared} unlockedFloors={provisionalUnlocks(map.floor)} caseData={EMPTY_CASE_DATA} />}>
      <FloorGameWithUnlocks {...shared} />
    </Suspense>
  );
}

async function FloorGameWithUnlocks({
  map,
  npcs,
  playerSprite,
  defaultCover,
  vault,
  gate,
}: {
  map: FloorMap;
  npcs: NpcInfo[];
  playerSprite: string;
  defaultCover: string;
  vault: ReactNode;
  gate: ReactNode;
}) {
  // Signed in: the account's clears. Guests: this browser's clears (cookie). The case file only gets
  // the contents of floors that are really unlocked, even on a floor reached by typing its URL.
  const open = await unlockedFloorsForRequest();
  const caseData = caseDataFor(open);
  const unlockedFloors = open.includes(map.floor) ? open : [...open, map.floor];
  return (
    <FloorGame
      map={map}
      npcs={npcs}
      playerSprite={playerSprite}
      defaultCover={defaultCover}
      unlockedFloors={unlockedFloors}
      caseData={caseData}
      vault={vault}
      gate={gate}
    />
  );
}
