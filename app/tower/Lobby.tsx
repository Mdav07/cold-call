"use client";

// The walkable tower lobby: the same engine as the floors, with the elevators and the street door as exits.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLatest, useMediaQuery } from "@/app/play/clientHooks";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CONSOLE_QUERY, FloorScene } from "@/app/floor/engine/FloorScene";
import type { FloorMap, SceneEvent } from "@/app/floor/types";
import { PropDialogue } from "@/app/floor/dialogue/DialogueBox";
import { MusicToggle } from "@/app/play/MusicToggle";
import { Elevator } from "@/app/floor/[floor]/Elevator";
import { ExitConfirm } from "@/app/floor/ExitConfirm";
import { openForGuest, useClearedHere } from "@/app/floor/guestProgress";
import { DAILY_X, LOBBY_H, LOBBY_W, MAT_WORDS } from "./lobbyMap";
import { DailyPopup } from "./DailyPopup";
import { DailyArchive } from "./DailyArchive";
import { StreakBadge } from "@/app/play/StreakBadge";

const PLAYER_SPRITE = "/sprites/hunter.png";

export function Lobby({
  map: serverMap,
  guide,
  guest,
  tutorialCleared,
  dailyClearedToday,
}: {
  map: FloorMap;
  /** Signed in: whether the account cleared the tutorial (the Daily Case opens after it). Guests: undefined. */
  tutorialCleared?: boolean;
  dailyClearedToday?: boolean;
  /** Not signed in: floors open from this browser's own clears, not the shared demo player's. */
  guest: boolean;
  guide: { goal: { x: number; y: number } | null; tags: { x: number; y: number; text: string }[] };
}) {
  const router = useRouter();
  const [prop, setProp] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<{ to: string; label: string } | null>(null);

  const leavingRef = useLatest(leaving);
  // The Daily door is always an exit; while the tutorial isn't cleared, walking in says so instead of
  // silently doing nothing. Every other exit asks to confirm first (ExitConfirm).
  const [dailyLocked, setDailyLocked] = useState(false);
  const tutorialDoneRef = useRef(false);
  const pendingRef = useLatest(pending);
  const onEvent = useCallback((e: SceneEvent) => {
    if (e.type === "exit") {
      if (leavingRef.current || pendingRef.current) return;
      if (e.to === "/daily" && !tutorialDoneRef.current) {
        setDailyLocked(true);
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
      label: to === "/daily" ? "Through the side door · Daily Case" : n === "0" ? "Across the street · Tutorial" : `Going up · Floor ${n}`,
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

  // First visit: Krystal's intro and the character pick come first (/intro sets cc-intro-seen).
  useEffect(() => {
    try {
      if (!localStorage.getItem("cc-intro-seen")) router.replace("/intro");
    } catch {}
  }, [router]);

  // Guests: lock each elevator whose floor below this browser hasn't cleared, and point at the next
  // floor to play (the tutorial door first). Daily opens after tutorial — account clear OR this browser.
  const cleared = useClearedHere();
  const key = cleared.join("");
  const tutorialDone = !!tutorialCleared || !!cleared[0];
  useEffect(() => {
    tutorialDoneRef.current = tutorialDone;
  }, [tutorialDone]);
  const map = useMemo(() => {
    const dailyCell = DAILY_X + (LOBBY_H - 1) * LOBBY_W;
    // Elevator mats (y=2): never block — stand/read even when locked; gating is exit-only.
    const elevMats = new Set(
      Object.values({ 1: 4, 2: 9, 3: 14 }).map((x) => x + 2 * LOBBY_W),
    );
    let exits = [...(serverMap.exits ?? [])];
    let blocked = (serverMap.blocked ?? []).filter((i) => i !== dailyCell && !elevMats.has(i));

    // Locked like the elevators until the tutorial is cleared: the doorway is blocked and the sign on the
    // D mat says LOCKED. (onEvent still answers a locked exit with a message, as a fallback.)
    if (!exits.some((e) => e.to === "/daily")) exits.push({ x: DAILY_X, y: LOBBY_H - 1, to: "/daily" });
    if (!tutorialDone) blocked = [...blocked, dailyCell];
    const props = (serverMap.props ?? []).map((pr) =>
      pr.id !== "daily-sign"
        ? pr
        : {
            ...pr,
            label: `${pr.label.replace(/ · (LOCKED|OPEN)$/, "")} · ${tutorialDone ? "OPEN" : "LOCKED"}`,
            text: tutorialDone
              ? pr.text.replace("Opens once you clear the tutorial.", "Walk through the door to play.")
              : "Locked. Clear the Tutorial first, through the T door. Then a new case opens behind this door every day.",
          },
    );

    if (guest) {
      // Drop locked-floor exits; keep mats walkable so guests can still read the sparkles.
      exits = exits.filter((e) => {
        if (e.to === "/daily") return true;
        if (!e.to.startsWith("/floor/")) return true;
        const n = Number(e.to.split("/").pop());
        return openForGuest(cleared, n);
      });
    }

    return { ...serverMap, exits, blocked, props };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMap, guest, key, tutorialDone]);
  const shown = useMemo(() => {
    if (!guest) return guide;
    const next = [0, 1, 2, 3].find((n) => openForGuest(cleared, n) && !cleared[n]);
    const exit = map.exits?.find((e) => e.to === `/floor/${next}`);
    if (next == null || !exit) return { goal: null, tags: [] };
    return { goal: { x: exit.x, y: exit.y }, tags: [] }; // T / D / 1–3 mats are the signs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest, guide, key, map]);
  const tags = useMemo(() => [...MAT_WORDS, ...shown.tags], [shown.tags]);

  const open = map.props?.find((p) => p.id === prop);
  // Phones held upright: the handheld-console layout, with the lobby's bar docked on the deck.
  const consoleMode = useMediaQuery(CONSOLE_QUERY);
  const nav = (
  <nav className={`pixel-frame pointer-events-auto flex ${consoleMode ? "w-full justify-center" : "max-w-[calc(100vw-5rem)]"} flex-wrap items-center gap-x-2 gap-y-2 bg-[var(--cc-panel)]/95 px-3 py-2.5 font-pixel text-[10px] leading-none text-[var(--cc-ink)]`}>
          <span className="mr-1 text-[var(--cc-accent)]">PLUMPURSE TOWER · LOBBY</span>
          <span className="hidden h-4 w-px bg-[var(--cc-edge)] sm:block" aria-hidden />
          <span className="flex items-center gap-2">
            <DailyArchive tutorialCleared={tutorialDone} clearedToday={dailyClearedToday} />
            <StreakBadge />
          </span>
          <Link className="border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2 py-1 pointer-coarse:py-2.5 hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]" href="/casefile">CASE FILE</Link>
          <Link className="border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2 py-1 pointer-coarse:py-2.5 hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]" href="/leaderboard">LEADERBOARD</Link>
          <Link className="border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2 py-1 pointer-coarse:py-2.5 hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]" href="/signin">SIGN IN</Link>
          <Link className="border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2 py-1 pointer-coarse:py-2.5 hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]" href="/hunter">YOUR HUNTER</Link>
          <Link className="border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2 py-1 pointer-coarse:py-2.5 hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]" href="/intro">REPLAY INTRO</Link>
        </nav>
  );

  return (
    <main className="cc-floor-1 relative flex h-dvh flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1">
        <FloorScene map={map} playerSprite={PLAYER_SPRITE} paused={!!open || !!leaving || !!pending || dailyLocked} onEvent={onEvent} goal={shown.goal} tags={tags} deck={consoleMode ? nav : undefined} />
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
          text="The Daily Case opens once you've cleared the Tutorial, through the T door. After that, a new case waits behind this door every day."
          onClose={() => setDailyLocked(false)}
        />
      )}
      {pending && (
        <ExitConfirm to={pending} onGo={() => startRide(pending)} onStay={() => setPending(null)} />
      )}
      <MusicToggle track="music-floor-1.mp3" />
      <Elevator label="Lobby · Plumpurse Tower" leaving={leaving} onClosed={arrived} />
    </main>
  );
}
