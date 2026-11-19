"use client";

// The walkable tower lobby: the same engine as the floors, with the elevators and the two front doors (Tutorial, Daily) as exits.
import { FallingLeaves } from "@/app/play/FallingLeaves";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLatest, useMediaQuery } from "@/app/play/clientHooks";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CONSOLE_QUERY, FloorScene } from "@/app/floor/engine/FloorScene";
import type { FloorMap, SceneEvent } from "@/app/floor/types";
import { PropDialogue } from "@/app/floor/dialogue/DialogueBox";
import { AudioThemeBar } from "@/app/play/AudioThemeBar";
import { useSeasonTheme } from "@/app/play/seasonTheme";
import { Elevator } from "@/app/floor/[floor]/Elevator";
import { ExitConfirm } from "@/app/floor/ExitConfirm";
import { openForGuest, useClearedHere } from "@/app/floor/guestProgress";
import { CASE2_X, CASE2_Y, DAILY_X, DOOR_Y, ELEVATORS, LOBBY_W, buildLobby, elevatorSign, lobbyMatNames, SEASONAL_X } from "./lobbyMap";
import type { TowerFloor } from "@/server/game/tower";
import { DailyPopup } from "./DailyPopup";
import { DailyArchive } from "./DailyArchive";
import { StreakBadge } from "@/app/play/StreakBadge";
import { EarnedChip } from "@/app/play/earnings";
import { currentSeason, nextSeason, shortDate } from "@/shared/seasonalCase";

const PLAYER_SPRITE = "/sprites/hunter.png";

export function Lobby({
  map: serverMap,
  floors,
  guide,
  guest,
  tutorialCleared,
  dailyClearedToday,
}: {
  map: FloorMap;
  /** The tower as the server sees it (for a guest, the shared demo player): signs are redone per player. */
  floors: TowerFloor[];
  /** Signed in: whether the account cleared the tutorial (the Daily Case opens after it). Guests: undefined. */
  tutorialCleared?: boolean;
  dailyClearedToday?: boolean;
  /** Not signed in: floors open from this browser's own clears, not the shared demo player's. */
  guest: boolean;
  guide: { goal: { x: number; y: number } | null; tags: { x: number; y: number; text: string }[] };
}) {
  const router = useRouter();
  const seasonThemeOn = useSeasonTheme();
  const [prop, setProp] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<{ to: string; label: string } | null>(null);

  const leavingRef = useLatest(leaving);
  // The Daily door is always an exit; while the tutorial isn't cleared, walking in says so instead of
  // silently doing nothing. Every other exit asks to confirm first (ExitConfirm).
  const [dailyLocked, setDailyLocked] = useState(false);
  const [seasonNote, setSeasonNote] = useState(false);
  const [case2Note, setCase2Note] = useState(false);
  const [endingSeen, setEndingSeen] = useState(false);
  const tutorialDoneRef = useRef(false);
  const pendingRef = useLatest(pending);
  const onEvent = useCallback((e: SceneEvent) => {
    if (e.type === "exit") {
      if (leavingRef.current || pendingRef.current) return;
      if (e.to === "/daily" && !tutorialDoneRef.current) {
        setDailyLocked(true);
        return;
      }
      // The seasonal door: locked like the Daily until the Tutorial is cleared; between seasons it says
      // when the next one opens.
      if (e.to === "/seasonal" && (!tutorialDoneRef.current || !currentSeason())) {
        setSeasonNote(true);
        return;
      }
      // Case 2 door: tease only — Fatwallet Federal isn't built yet.
      if (e.to === "/case2") {
        setCase2Note(true);
        return;
      }
      setPending(e.to);
    } else if (e.type === "interact-prop") setProp(e.id);
  }, [leavingRef, pendingRef]);
  const startRide = useCallback((to: string) => {
    const n = to.split("/").pop();
    setPending(null);
    setLeaving({
      to,
      label: to === "/daily" ? "Through the side door · Daily Case" : to === "/seasonal" ? `Through the holiday door · ${currentSeason()?.name ?? "Seasonal"}` : n === "0" ? "Across the street · Tutorial" : `Going up · Floor ${n}`,
    });
  }, []);
  const arrived = useCallback(() => {
    const ride = leavingRef.current;
    if (!ride) return;
    router.push(ride.to);
    // Next keeps this page's state for when you come back; a ride still set then would close the
    // doors and send you off again (the elevator bounce loop). The doors stay shut until the page changes.
    setLeaving(null);
  }, [router, leavingRef]);

  // First visit: Krystal's intro, sign-in, then hunter pick if needed (/intro sets cc-intro-seen).
  useEffect(() => {
    try {
      if (!localStorage.getItem("cc-intro-seen")) router.replace("/intro");
    } catch {}
  }, [router]);
  useEffect(() => {
    try {
      setEndingSeen(localStorage.getItem("cc-ending-seen") === "1");
    } catch {}
  }, []);

  // Guests: lock each elevator whose floor below this browser hasn't cleared, and point at the next
  // floor to play (the tutorial door first). Daily opens after tutorial — account clear OR this browser.
  const cleared = useClearedHere();
  const key = cleared.join("");
  // Signed in: the account's own Tutorial clear, the same rule as the Daily page and /api/session (a clear
  // made earlier as a guest in this browser doesn't count, or the door would open onto a locked page).
  // Guests: this browser's clear.
  const tutorialDone = tutorialCleared !== undefined ? tutorialCleared : !!cleared[0];
  // Case 2 door: Floor 3 cleared (account or this browser) and the ending cutscene already played.
  const floor3Done = guest ? !!cleared[3] : !!floors.find((f) => f.floor === 3)?.cleared;
  const showCase2 = endingSeen && floor3Done;
  useEffect(() => {
    tutorialDoneRef.current = tutorialDone;
  }, [tutorialDone]);
  // Theme off → drop harvest décor/leaves, but keep the Thanksgiving door + mat.
  const map = useMemo(() => {
    const base = buildLobby(floors, null, { seasonalDecor: seasonThemeOn, case2Door: showCase2 });
    base.spawn = serverMap.spawn;
    // Elevator mats (y=2): never block — stand/read even when locked; gating is exit-only.
    const elevMats = new Set(Object.values(ELEVATORS).map((x) => x + 2 * LOBBY_W));
    let exits = [...(base.exits ?? [])];
    const blocked = (base.blocked ?? []).filter((i) => !elevMats.has(i));

    // The Daily door is an exit whatever your progress: until the Tutorial is cleared, walking into it
    // says it's locked (onEvent), and a LOCKED plate sits on the door.
    if (!exits.some((e) => e.to === "/daily")) exits.push({ x: DAILY_X, y: DOOR_Y, to: "/daily" });
    const props = (base.props ?? []).map((pr) => {
      // Guests: each elevator sign follows this browser's clears, not the shared demo player's.
      const n = Number(pr.id.match(/^sign-([123])$/)?.[1]);
      if (n && guest) return { ...pr, ...elevatorSign(floors.find((f) => f.floor === n), n, openForGuest(cleared, n), !!cleared[n]) };
      if (pr.id === "seasonal-sign" && currentSeason())
        return { ...pr, text: pr.text.replace(/(Walk through the door to play\.|Opens once you clear the tutorial\.)$/, tutorialDone ? "Walk through the door to play." : "Opens once you clear the tutorial.") };
      return pr.id !== "daily-sign"
        ? pr
        : {
            ...pr,
            label: `${pr.label.replace(/ · (LOCKED|OPEN)$/, "")} · ${tutorialDone ? "OPEN" : "LOCKED"}`,
            text: tutorialDone
              ? pr.text.replace("Opens once you clear the tutorial.", "Walk through the door to play.")
              : "Locked. Clear the Tutorial first, through the glass door. Then a new case waits behind this door every day.",
          };
    });

    if (guest) {
      // Drop locked-floor exits; keep mats walkable so guests can still read the sparkles.
      exits = exits.filter((e) => {
        if (e.to === "/daily" || e.to === "/seasonal" || e.to === "/case2") return true;
        if (!e.to.startsWith("/floor/")) return true;
        const n = Number(e.to.split("/").pop());
        return openForGuest(cleared, n);
      });
    }

    return { ...base, exits, blocked, props };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMap, floors, guest, key, tutorialDone, seasonThemeOn, showCase2]);
  const shown = useMemo(() => {
    if (!guest) return guide;
    const next = [0, 1, 2, 3].find((n) => openForGuest(cleared, n) && !cleared[n]);
    const exit = map.exits?.find((e) => e.to === `/floor/${next}`);
    if (next == null || !exit) return { goal: null, tags: [] };
    return { goal: { x: exit.x, y: exit.y }, tags: [] }; // T / D / 1–3 mats are the signs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest, guide, key, map]);
  // A LOCKED sign, always visible, on every door you can't use yet (and none on doors you can).
  const tags = useMemo(() => {
    const locked: { x: number; y: number; text: string; always: true; fit: number }[] = [];
    for (const [k, x] of Object.entries(ELEVATORS))
      if (!map.exits?.some((e) => e.to === `/floor/${k}`)) locked.push({ x, y: 1, text: "LOCKED", always: true, fit: 2.8 });
    if (!tutorialDone) locked.push({ x: DAILY_X, y: DOOR_Y, text: "LOCKED", always: true, fit: 2.8 });
    // Seasonal door stays with Theme off; still LOCKED until tutorial / CLOSED out of season.
    if (!tutorialDone || !currentSeason())
      locked.push({ x: SEASONAL_X, y: DOOR_Y, text: currentSeason() ? "LOCKED" : "CLOSED", always: true, fit: 2.8 });
    if (showCase2) locked.push({ x: CASE2_X, y: CASE2_Y, text: "SOON", always: true, fit: 2.8 });
    return [...lobbyMatNames({ case2Door: showCase2 }), ...shown.tags, ...locked];
  }, [shown.tags, map, tutorialDone, showCase2]);

  const open = map.props?.find((p) => p.id === prop);
  // Phones held upright: the handheld-console layout, with the lobby's bar docked on the deck.
  const consoleMode = useMediaQuery(CONSOLE_QUERY);
  const nav = (
  <nav
    className={`pixel-frame pointer-events-auto flex items-center bg-[var(--cc-panel)]/95 font-pixel leading-none text-[var(--cc-ink)] ${
      // On the handheld-console deck: one row that scrolls sideways, so the screen keeps its height.
      consoleMode
        ? "w-full flex-nowrap gap-x-1.5 overflow-x-auto px-2 py-1.5 text-[9px] [&>*]:shrink-0"
        : "max-w-[calc(100vw-5rem)] flex-wrap gap-x-2 gap-y-2 px-3 py-2.5 text-[10px]"
    }`}
  >
          {!consoleMode && <span className="mr-1 text-[var(--cc-accent)]">PLUMPURSE TOWER · LOBBY</span>}
          <span className="hidden h-4 w-px bg-[var(--cc-edge)] sm:block" aria-hidden />
          <span className="flex items-center gap-2">
            <DailyArchive tutorialCleared={tutorialDone} clearedToday={dailyClearedToday} />
            <StreakBadge />
            <EarnedChip label="EARNED" className="border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2 py-1" />
          </span>
          {/* Order: play loop → account/profile → rare meta. */}
          <Link className="border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2 py-1 pointer-coarse:py-2.5 hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]" href="/casefile">CASE FILE</Link>
          <Link className="border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2 py-1 pointer-coarse:py-2.5 hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]" href="/leaderboard">LEADERBOARD</Link>
          {/* One place for the account and the hunter: guests see SIGN IN, signed-in players PROFILE. */}
          <Link className="border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2 py-1 pointer-coarse:py-2.5 hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]" href={guest ? "/signin" : "/hunter"}>{guest ? "SIGN IN" : "PROFILE"}</Link>
          <Link className="border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2 py-1 pointer-coarse:py-2.5 hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]" href="/intro">REPLAY INTRO</Link>
        </nav>
  );

  return (
    <main className="cc-floor-1 relative flex h-dvh flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1">
        <FloorScene map={map} playerSprite={PLAYER_SPRITE} paused={!!open || !!leaving || !!pending || dailyLocked || seasonNote || case2Note} onEvent={onEvent} goal={shown.goal} tags={tags} deck={consoleMode ? nav : undefined} />
        {seasonThemeOn && currentSeason()?.door === "harvest" && <FallingLeaves />}
      </div>
      <DailyPopup tutorialCleared={tutorialCleared} clearedToday={dailyClearedToday} />
      {!consoleMode && <div className="pointer-events-none absolute left-0 top-0 z-10 p-3 sm:p-4">{nav}</div>}
      <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap font-pixel text-[9px] text-[var(--cc-muted)] sm:[@media(pointer:fine)]:block">
        Arrow keys to walk · Space to read · Elevators go up
      </p>
      {open && <PropDialogue label={open.label} text={open.text} onClose={() => setProp(null)} />}
      {dailyLocked && (
        <PropDialogue
          label="Daily Case · locked"
          text="The Daily Case opens once you've cleared the Tutorial, through the glass door. After that, a new case waits behind this door every day."
          onClose={() => setDailyLocked(false)}
        />
      )}
      {seasonNote && (
        <PropDialogue
          label={currentSeason() ? `${currentSeason()!.name} case · locked` : "Seasonal case · closed"}
          text={
            currentSeason()
              ? `The ${currentSeason()!.name} case opens once you've cleared the Tutorial, through the glass door.`
              : nextSeason()
                ? `No holiday case right now. Next: ${nextSeason()!.name}, opening ${shortDate(nextSeason()!.opens)}.`
                : "No holiday case right now."
          }
          onClose={() => setSeasonNote(false)}
        />
      )}
      {case2Note && (
        <PropDialogue
          label="Case 2 · Fatwallet Federal · coming soon"
          text="Krystal's trail leads to Fatwallet Federal next — but Case 2 isn't open yet. Come back when it is. Daily and seasonal jobs are still open while you wait."
          onClose={() => setCase2Note(false)}
        />
      )}
      {pending && (
        <ExitConfirm to={pending} onGo={() => startRide(pending)} onStay={() => setPending(null)} />
      )}
      <AudioThemeBar track="music-floor-1.mp3" />
      <Elevator label="Lobby · Plumpurse Tower" leaving={leaving} onClosed={arrived} />
    </main>
  );
}
