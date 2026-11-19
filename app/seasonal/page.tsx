// /seasonal: the holiday case behind the lobby's seasonal door (Thanksgiving first). One hand-written case
// per season, open between its dates (shared/seasonalCase.ts). It plays like the Daily Case (same room
// builder, the "daily" agent with the season's persona, the Pocket Branch vault) but keeps out of the
// Daily streak and board. Closed between seasons: says when the next one opens.

import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { dailyCase } from "@/shared/dailyCase";
import { currentSeason, nextSeason, shortDate } from "@/shared/seasonalCase";
import { FloorGame } from "@/app/floor/[floor]/FloorGame";
import type { NpcInfo } from "@/app/floor/dialogue/DialogueBox";
import { HudVault } from "@/app/floor/hud/HudVault";
import { buildDailyRoom, helperPropId } from "@/app/daily/room";
import { EMPTY_CASE_DATA } from "@/app/casefile/data";
import { DailyGate } from "@/app/daily/DailyGate";

export const metadata: Metadata = { title: "Cold Call · Seasonal Case" };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function SeasonalPage() {
  return (
    <Suspense
      fallback={
        <main className="cc-floor-1 grid min-h-dvh flex-1 place-items-center bg-[#15141a]">
          <p className="font-pixel text-[10px] text-[var(--cc-muted)]">Opening the seasonal case…</p>
        </main>
      }
    >
      <SeasonalRoom />
    </Suspense>
  );
}

async function SeasonalRoom() {
  await connection(); // which season is open depends on the date
  const season = currentSeason();
  if (!season) {
    const next = nextSeason();
    return (
      <main className="cc-floor-1 grid min-h-dvh flex-1 place-items-center bg-[#15141a] p-4">
        <section className="pixel-frame flex max-w-md flex-col gap-4 bg-[var(--cc-panel)] p-6">
          <h1 className="font-pixel text-sm text-[var(--cc-accent)]">Seasonal case · closed</h1>
          <p className="text-[var(--cc-ink)]">
            {next ? `The next one, ${next.name}, opens ${shortDate(next.opens)}.` : "No seasonal case is on the calendar yet."}
          </p>
          <Link href="/tower" className="pixel-button self-start">
            ◀ Back to the lobby
          </Link>
        </section>
      </main>
    );
  }
  const c = dailyCase(season.caseDate);
  const helper = season.helper;
  const map = buildDailyRoom(c, helper ? { id: helper.id, sprite: helper.sprite } : undefined);
  map.name = `${season.name} · ${c.title}`;
  const npcs: NpcInfo[] = [{ id: "daily", name: c.employee.name, title: c.employee.title, sprite: c.employee.sprite }];
  if (helper) {
    // A second person with fixed lines (no AI): they hold a detail the case needs. Their lines live in an
    // off-map prop, which FloorGame opens when you talk to them.
    map.props = [...(map.props ?? []), { id: helperPropId(helper.id), x: -999, y: -999, label: `${helper.name} · ${helper.title}`, text: helper.text }];
    npcs.push({ id: helper.id as NpcInfo["id"], name: helper.name, title: helper.title, sprite: helper.sprite });
  }
  return (
    <FloorGame
      map={map}
      npcs={npcs}
      playerSprite="/sprites/hunter.png"
      defaultCover=""
      unlockedFloors={[0]}
      caseData={EMPTY_CASE_DATA}
      daily={c}
      vault={
        <Suspense fallback={<span className="text-[var(--cc-muted)]">VAULT …</span>}>
          <HudVault floor={0} level="seasonal" />
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
