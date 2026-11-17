import { Suspense } from "react";
import { notFound } from "next/navigation";
import directory from "@/content/plumpurse/directory.json";
import type { EmployeeId } from "@/shared/interfaces";
import type { FloorMap } from "@/app/floor/types";
import type { NpcInfo } from "@/app/floor/dialogue/DialogueBox";
import { HudVault } from "@/app/floor/hud/HudVault";
import floor1 from "@/app/floor/maps/floor-1.placeholder.json";
import { FloorGame } from "./FloorGame";

/** Floors with a map. B adds floor-<n>.json for the rest; add each here as it lands. */
const MAPS: Record<string, FloorMap> = {
  "1": floor1 as unknown as FloorMap,
};

const PLAYER_SPRITE = "/sprites/placeholder-player.png";

/** The cover story offered on the first talk of a run (the player can change it). */
const DEFAULT_COVER: Record<number, string> = {
  0: "the Swiftbag Couriers driver, here for the end-of-day pickup",
};
const FALLBACK_COVER = "Sam from Quillfeather Supplies, calling about an invoice";

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

  return (
    <FloorGame
      map={map}
      npcs={npcs}
      playerSprite={PLAYER_SPRITE}
      defaultCover={DEFAULT_COVER[map.floor] ?? FALLBACK_COVER}
      vault={
        <Suspense fallback={<span className="text-[var(--cc-muted)]">VAULT …</span>}>
          <HudVault floor={map.floor} />
        </Suspense>
      }
    />
  );
}
