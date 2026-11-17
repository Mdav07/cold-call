// /daily: today's Daily Case room. A new short case every UTC day, the same for everyone
// (shared/dailyCase.ts). The room, briefing and case file come from the case; talking, the outcome
// screen and the elevator are the floors' own (FloorGame).
// /daily?date=YYYY-MM-DD replays one of the last few days' cases as practice (shared/dailyCase.ts
// archiveDate); a bad or too-old date plays today's.

import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { archiveDate, dailyCase, todayUtc } from "@/shared/dailyCase";
import { FloorGame } from "@/app/floor/[floor]/FloorGame";
import type { NpcInfo } from "@/app/floor/dialogue/DialogueBox";
import { HudVault } from "@/app/floor/hud/HudVault";
import { buildDailyRoom } from "./room";
import { DailyGate } from "./DailyGate";

export const metadata: Metadata = { title: "Cold Call · Daily Case" };

// Same as the floors: on phones the keyboard resizes the page so the text field stays visible.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function DailyPage({ searchParams }: PageProps<"/daily">) {
  return (
    <Suspense
      fallback={
        <main className="cc-floor-1 grid min-h-dvh flex-1 place-items-center bg-[#15141a]">
          <p className="font-pixel text-[10px] text-[var(--cc-muted)]">Opening today&apos;s case…</p>
        </main>
      }
    >
      <DailyRoom searchParams={searchParams} />
    </Suspense>
  );
}

async function DailyRoom({ searchParams }: { searchParams: PageProps<"/daily">["searchParams"] }) {
  // Today's case depends on the date: always render at request time.
  await connection();
  const { date } = await searchParams;
  const today = todayUtc();
  const day = archiveDate(typeof date === "string" ? date : null) ?? today;
  const practice = day !== today;
  const c = dailyCase(day);
  const map = buildDailyRoom(c);
  // An earlier day is practice: it doesn't count for the board or the streak. Say so in the HUD.
  if (practice) map.name = `Practice · ${c.date} · ${c.title}`;
  const npcs: NpcInfo[] = [
    { id: "daily", name: c.employee.name, title: c.employee.title, sprite: c.employee.sprite },
  ];
  return (
    <FloorGame
      map={map}
      npcs={npcs}
      playerSprite="/sprites/hunter.png"
      defaultCover="a vendor calling about today's job"
      unlockedFloors={[0]}
      daily={c}
      // The Daily Case pays from the Pocket Branch vault.
      vault={
        <Suspense fallback={<span className="text-[var(--cc-muted)]">VAULT …</span>}>
          <HudVault floor={0} />
        </Suspense>
      }
      gate={
        <Suspense fallback={null}>
          <DailyGate />
        </Suspense>
      }
    />
  );
}
