// /seasonal: the holiday case behind the lobby's holiday door. Each holiday is open on its dates and plays one of
// its layouts a day (shared/seasonalCase.ts): the proposer is the Daily agent, the co-signer the live "helper".
// Two holidays open at once: the door asks which (?s=<season id>). Closed between holidays: says when the next opens.

import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { dailyCase } from "@/shared/dailyCase";
import { nextSeason, openSeasons, seasonById, seasonalHelper, shortDate, todaysCaseDate } from "@/shared/seasonalCase";
import { FloorGame } from "@/app/floor/[floor]/FloorGame";
import type { NpcInfo } from "@/app/floor/dialogue/DialogueBox";
import { HudVault } from "@/app/floor/hud/HudVault";
import { buildDailyRoom } from "@/app/daily/room";
import { EMPTY_CASE_DATA } from "@/app/casefile/data";
import { DailyGate } from "@/app/daily/DailyGate";

export const metadata: Metadata = { title: "Cold Call · Seasonal Case" };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function SeasonalPage({ searchParams }: PageProps<"/seasonal">) {
  return (
    <Suspense
      fallback={
        <main className="cc-floor-1 grid min-h-dvh flex-1 place-items-center bg-[#15141a]">
          <p className="font-pixel text-[10px] text-[var(--cc-muted)]">Opening the seasonal case…</p>
        </main>
      }
    >
      <SeasonalRoom searchParams={searchParams} />
    </Suspense>
  );
}

async function SeasonalRoom({ searchParams }: { searchParams: PageProps<"/seasonal">["searchParams"] }) {
  await connection(); // which holiday is open depends on the date
  const { s: picked } = await searchParams;
  const open = openSeasons();
  const chosen = seasonById(typeof picked === "string" ? picked : null);
  const season = open.length === 1 ? open[0] : open.find((o) => o.id === chosen?.id) ?? null;
  if (open.length > 1 && !season) {
    // Two holidays open at once (Halloween + Diwali, Christmas + Hanukkah): the door asks which.
    return (
      <main className="cc-floor-1 grid min-h-dvh flex-1 place-items-center bg-[#15141a] p-4">
        <section className="pixel-frame flex w-full max-w-md flex-col gap-4 bg-[var(--cc-panel)] p-6">
          <h1 className="font-pixel text-sm text-[var(--cc-accent)]">Two holiday cases tonight</h1>
          <p className="text-[var(--cc-ink)]">Pick a door. Each has its own case and its own leaderboard.</p>
          <ul className="flex flex-col gap-3">
            {open.map((o) => {
              const c = dailyCase(todaysCaseDate(o));
              return (
                <li key={o.id}>
                  <Link href={`/seasonal?s=${o.id}`} className="pixel-button flex w-full flex-col items-start gap-1 text-left">
                    <span>{o.name} ▶</span>
                    <span className="font-sans text-xs normal-case text-[var(--cc-muted)]">
                      {c.title} · open until {shortDate(o.closes)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href="/tower" className="pixel-button self-start">
            ◀ Back to the lobby
          </Link>
        </section>
      </main>
    );
  }
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
  const caseDate = todaysCaseDate(season);
  const c = dailyCase(caseDate);
  const helper = seasonalHelper(caseDate);
  const map = buildDailyRoom(c, helper ? { id: helper.id, sprite: helper.sprite } : undefined);
  map.name = `${season.name} · ${c.title}`;
  const npcs: NpcInfo[] = [{ id: "daily", name: c.employee.name, title: c.employee.title, sprite: c.employee.sprite }];
  if (helper) {
    // Live second signer: same chat path as Annie/Bill (employee_id "helper").
    npcs.push({ id: "helper", name: helper.name, title: helper.title, sprite: helper.sprite });
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
