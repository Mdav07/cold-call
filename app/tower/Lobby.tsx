"use client";

// The walkable tower lobby: the same engine as the floors, with the elevators and the street door as exits.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FloorScene } from "@/app/floor/engine/FloorScene";
import type { FloorMap, SceneEvent } from "@/app/floor/types";
import { PropDialogue } from "@/app/floor/dialogue/DialogueBox";
import { MusicToggle } from "@/app/play/MusicToggle";
import { Elevator } from "@/app/floor/[floor]/Elevator";
import { openForGuest, useClearedHere } from "@/app/floor/guestProgress";
import { DAILY_TAG, TUTORIAL_TAG } from "./lobbyMap";
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
  const [leaving, setLeaving] = useState<{ to: string; label: string } | null>(null);

  const leavingRef = useRef(leaving);
  leavingRef.current = leaving;
  const onEvent = useCallback((e: SceneEvent) => {
    if (e.type === "exit") {
      if (leavingRef.current) return;
      const n = e.to.split("/").pop();
      setLeaving({
        to: e.to,
        label: e.to === "/daily" ? "Through the side door · Daily Case" : n === "0" ? "Across the street · Pocket Branch" : `Going up · Floor ${n}`,
      });
    } else if (e.type === "interact-prop") setProp(e.id);
  }, []);
  const arrived = useCallback(() => {
    const ride = leavingRef.current;
    if (!ride) return;
    router.push(ride.to);
    // Next keeps this page's state for when you come back; a ride still set then would close the
    // doors and send you off again (the elevator bounce loop). The doors stay shut until the page changes.
    setLeaving(null);
  }, [router]);

  // First visit: Krystal's intro and the character pick come first (/intro sets cc-intro-seen).
  useEffect(() => {
    try {
      if (!localStorage.getItem("cc-intro-seen")) router.replace("/intro");
    } catch {}
  }, [router]);

  // Guests: lock each elevator whose floor below this browser hasn't cleared, and point at the next
  // floor to play (the tutorial door first).
  const cleared = useClearedHere();
  const key = cleared.join("");
  const map = useMemo(() => {
    if (!guest) return serverMap;
    const closed = (serverMap.exits ?? []).filter((e) => {
      const n = Number(e.to.split("/").pop());
      if (e.to === "/daily") return !cleared[0]; // the Daily Case opens after the tutorial
      return e.to.startsWith("/floor/") && !openForGuest(cleared, n);
    });
    return {
      ...serverMap,
      exits: serverMap.exits?.filter((e) => !closed.includes(e)),
      blocked: [...(serverMap.blocked ?? []), ...closed.map((e) => e.y * serverMap.width + e.x)],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMap, guest, key]);
  const shown = useMemo(() => {
    if (!guest) return guide;
    const next = [0, 1, 2, 3].find((n) => openForGuest(cleared, n) && !cleared[n]);
    const exit = map.exits?.find((e) => e.to === `/floor/${next}`);
    const daily = cleared[0] ? [DAILY_TAG] : [];
    if (next == null || !exit) return { goal: null, tags: daily };
    return next === 0
      ? { goal: { x: exit.x, y: exit.y }, tags: [TUTORIAL_TAG] }
      : { goal: { x: exit.x, y: exit.y }, tags: [{ x: exit.x, y: exit.y - 1, text: `FLOOR ${next}` }, ...daily] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest, guide, key, map]);

  const open = map.props?.find((p) => p.id === prop);
  return (
    <main className="cc-floor-1 relative flex h-dvh flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1">
        <FloorScene map={map} playerSprite={PLAYER_SPRITE} paused={!!open || !!leaving} onEvent={onEvent} goal={shown.goal} tags={shown.tags} />
      </div>
      <DailyPopup tutorialCleared={tutorialCleared} clearedToday={dailyClearedToday} />
      <div className="pointer-events-none absolute left-0 top-0 z-10 p-3 sm:p-4">
        <nav className="pixel-frame pointer-events-auto flex max-w-[calc(100vw-5rem)] flex-wrap items-center gap-x-4 gap-y-1 bg-[var(--cc-panel)]/95 px-3 py-2.5 font-pixel text-[10px] leading-none text-[var(--cc-ink)]">
          <span className="text-[var(--cc-accent)]">PLUMPURSE TOWER · LOBBY</span>
          <span className="flex items-center gap-2">
            <DailyArchive />
            <StreakBadge />
          </span>
          <Link className="hover:underline" href="/casefile">CASE FILE</Link>
          <Link className="hover:underline" href="/leaderboard">LEADERBOARD</Link>
          <Link className="hover:underline" href="/signin">SIGN IN</Link>
          <Link className="hover:underline" href="/hunter">YOUR HUNTER</Link>
          <Link className="hover:underline" href="/intro">REPLAY INTRO</Link>
        </nav>
      </div>
      <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap font-pixel text-[9px] text-[var(--cc-muted)] [@media(pointer:fine)]:block">
        Arrow keys to walk · Space to read · Elevators go up
      </p>
      {open && <PropDialogue label={open.label} text={open.text} onClose={() => setProp(null)} />}
      <MusicToggle track="music-floor-1.mp3" />
      <Elevator label="Lobby · Plumpurse Tower" leaving={leaving} onClosed={arrived} />
    </main>
  );
}
