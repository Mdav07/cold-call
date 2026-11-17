"use client";

// The walkable tower lobby: the same engine as the floors, with the elevators and the street door as exits.
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FloorScene } from "@/app/floor/engine/FloorScene";
import type { FloorMap, SceneEvent } from "@/app/floor/types";
import { PropDialogue } from "@/app/floor/dialogue/DialogueBox";
import { MusicToggle } from "@/app/play/MusicToggle";
import { Elevator } from "@/app/floor/[floor]/Elevator";

const PLAYER_SPRITE = "/sprites/hunter.png";

export function Lobby({ map }: { map: FloorMap }) {
  const router = useRouter();
  const [prop, setProp] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<{ to: string; label: string } | null>(null);

  const onEvent = useCallback((e: SceneEvent) => {
    if (e.type === "exit") {
      const n = e.to.split("/").pop();
      setLeaving({ to: e.to, label: n === "0" ? "Across the street · Pocket Branch" : `Going up · Floor ${n}` });
    } else if (e.type === "interact-prop") setProp(e.id);
  }, []);
  const arrived = useCallback(() => {
    if (leaving) router.push(leaving.to);
  }, [leaving, router]);

  const open = map.props?.find((p) => p.id === prop);
  return (
    <main className="cc-floor-1 relative flex h-dvh flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1">
        <FloorScene map={map} playerSprite={PLAYER_SPRITE} paused={!!open || !!leaving} onEvent={onEvent} />
      </div>
      <div className="pointer-events-none absolute left-0 top-0 z-10 p-3 sm:p-4">
        <nav className="pixel-frame pointer-events-auto flex max-w-[calc(100vw-5rem)] flex-wrap items-center gap-x-4 gap-y-1 bg-[var(--cc-panel)]/95 px-3 py-2 font-pixel text-[10px] text-[var(--cc-ink)]">
          <span className="text-[var(--cc-accent)]">PLUMPURSE TOWER · LOBBY</span>
          <Link className="hover:underline" href="/casefile">CASE FILE</Link>
          <Link className="hover:underline" href="/leaderboard">LEADERBOARD</Link>
          <Link className="hover:underline" href="/signin">SIGN IN</Link>
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
