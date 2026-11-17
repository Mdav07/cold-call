"use client";

// One walkable floor: the engine's canvas, the HUD, the dialogue box and the run outcome.
// A run belongs to the floor: the first conversation starts it with a cover story, later
// conversations (call-backs, the floor-mate) continue it.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { EmployeeId } from "@/shared/interfaces";
import { FloorScene } from "@/app/floor/engine/FloorScene";
import type { FloorMap, FloorSceneProps, SceneEvent } from "@/app/floor/types";
import { useRunState, type RunState } from "@/app/play/useRunState";
import { OutcomeOverlay } from "@/app/play/OutcomeOverlay";
import { NpcDialogue, PropDialogue, type NpcInfo } from "@/app/floor/dialogue/DialogueBox";
import { Hud } from "@/app/floor/hud/Hud";

type Open = { kind: "npc"; id: EmployeeId } | { kind: "prop"; id: string } | null;

export function FloorGame({
  map,
  npcs,
  playerSprite,
  defaultCover,
  vault,
}: {
  map: FloorMap;
  npcs: NpcInfo[];
  playerSprite: string;
  defaultCover: string;
  vault: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [cover, setCover] = useState(defaultCover);
  // The employee whose state the page polls: the one you are talking to, or last talked to.
  const [focus, setFocus] = useState<EmployeeId>(map.npcs[0]?.id ?? "penny");
  const [lockedOut, setLockedOut] = useState<Set<EmployeeId>>(new Set());
  const [levels, setLevels] = useState<Partial<Record<EmployeeId, number>>>({});
  const [dismissedRun, setDismissedRun] = useState<string | null>(null);

  const polled = useRunState(runId, focus, !!runId);

  // useRunState keeps its last value when the run or employee changes, until the next poll
  // lands. Trust a value only if it arrived for the current run and employee.
  // Each employee's suspicion and lockout are remembered as values come in (adjusted during
  // render, so the emotes update in the same frame).
  const key = `${runId}:${focus}`;
  const [seen, setSeen] = useState<{ ref: RunState | null; key: string }>({ ref: null, key: "" });
  if (polled !== seen.ref) {
    setSeen({ ref: polled, key });
    if (polled && runId) {
      if (levels[focus] !== polled.level) setLevels((l) => ({ ...l, [focus]: polled.level }));
      if (polled.locked_out && !lockedOut.has(focus)) setLockedOut((s) => new Set(s).add(focus));
    }
  }
  const state = runId && seen.ref === polled && seen.key === key ? polled : null;

  const outcome = state?.run?.outcome;
  const showOutcome = !!state && (outcome === "breach" || outcome === "lockout") && dismissedRun !== runId;

  const onSession = useCallback((id: string, startedAt: number | null) => {
    setRunId(id);
    if (startedAt != null) setRunStartedAt((t) => t ?? startedAt);
  }, []);

  /** The run is over: the next conversation starts a new one. */
  const resetRun = (clearLocks: boolean) => {
    setDismissedRun(runId);
    setOpen(null);
    setRunId(null);
    setRunStartedAt(null);
    setLevels({});
    if (clearLocks) setLockedOut(new Set());
  };

  const onEvent = useCallback(
    (e: SceneEvent) => {
      if (e.type === "exit") return router.push(e.to);
      if (e.type === "interact-npc") {
        setFocus(e.id);
        setOpen({ kind: "npc", id: e.id });
      } else setOpen({ kind: "prop", id: e.id });
    },
    [router],
  );

  const emotes: FloorSceneProps["emotes"] = {};
  for (const n of map.npcs) {
    emotes[n.id] =
      open?.kind === "npc" && open.id === n.id
        ? "talking"
        : lockedOut.has(n.id)
          ? "alarm"
          : (levels[n.id] ?? 0) >= 60
            ? "suspicious"
            : null;
  }

  // Keep the player above the dialogue box: measure it while it is open.
  const [inset, setInset] = useState(0);
  const boxOpen = !!open;
  useEffect(() => {
    const box = boxOpen ? document.querySelector<HTMLElement>("[data-dialogue-box]") : null;
    if (!box) return setInset(0);
    const ro = new ResizeObserver(() => setInset(box.offsetHeight));
    ro.observe(box);
    return () => ro.disconnect();
  }, [boxOpen, open]);

  const npc = open?.kind === "npc" ? npcs.find((n) => n.id === open.id) : null;
  const prop = open?.kind === "prop" ? map.props?.find((p) => p.id === open.id) : null;
  const finished = !!state?.run?.ended_at;

  return (
    <main className={`cc-floor-1 cc-floor-${map.floor} relative flex h-dvh flex-col overflow-hidden`}>
      <div className="relative min-h-0 flex-1">
        <FloorScene map={map} playerSprite={playerSprite} paused={!!open || showOutcome} onEvent={onEvent} emotes={emotes} insetBottom={inset} />
      </div>

      <Hud floorName={map.name} startedAt={runStartedAt} finalMs={state?.run?.duration_ms ?? null} vault={vault} />

      {npc && !showOutcome && (
        <NpcDialogue
          key={npc.id}
          npc={npc}
          // A finished run is not continued: talking again starts a new one.
          runId={finished ? null : runId}
          cover={cover}
          onCover={setCover}
          state={focus === npc.id ? state : null}
          lockedOut={lockedOut.has(npc.id)}
          onSession={onSession}
          onClose={() => setOpen(null)}
        />
      )}
      {prop && <PropDialogue label={prop.label} text={prop.text} onClose={() => setOpen(null)} />}

      {showOutcome && state && (
        <OutcomeOverlay
          state={state}
          employeeName={npcs.find((n) => n.id === focus)?.name.split(" ")[0] ?? "They"}
          onRetry={() => resetRun(true)}
          onClose={() => resetRun(outcome === "breach")}
        />
      )}
    </main>
  );
}
