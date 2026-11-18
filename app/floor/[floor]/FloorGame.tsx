"use client";

// One walkable floor: the engine's canvas, the HUD, the dialogue box and the run outcome.
// A run belongs to the floor: the first conversation starts it with a cover story, later
// conversations (call-backs, the floor-mate) continue it.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useClientValue, useLatest } from "@/app/play/clientHooks";
import { markClearedHere } from "@/app/floor/guestProgress";
import { markDailyCleared } from "@/app/play/streak";
import { useRouter } from "next/navigation";
import type { EmployeeId } from "@/shared/interfaces";
import { FloorScene } from "@/app/floor/engine/FloorScene";
import type { FloorMap, FloorSceneProps, SceneEvent } from "@/app/floor/types";
import { useRunState, type RunState } from "@/app/play/useRunState";
import { OutcomeOverlay } from "@/app/play/OutcomeOverlay";
import { MusicToggle } from "@/app/play/MusicToggle";
import { KrystalRadio } from "@/app/play/KrystalRadio";
import { NpcDialogue, PropDialogue, type NpcInfo } from "@/app/floor/dialogue/DialogueBox";
import { Hud } from "@/app/floor/hud/Hud";
import { CaseFileOverlay } from "@/app/floor/dialogue/CaseFileOverlay";
import { Elevator } from "./Elevator";
import { ExitConfirm } from "@/app/floor/ExitConfirm";
import { RestartConfirm } from "@/app/floor/RestartConfirm";
import { clearRun, ResumeRun, saveRun, useSavedRun } from "@/app/floor/ResumeRun";
import { Briefing, briefingFor, wasBriefed } from "./Briefing";
import type { DailyCase } from "@/shared/dailyCase";

type Open = { kind: "npc"; id: EmployeeId } | { kind: "prop"; id: string } | null;

export function FloorGame({
  map,
  npcs,
  playerSprite,
  defaultCover,
  vault,
  gate,
  unlockedFloors,
  daily,
}: {
  map: FloorMap;
  npcs: NpcInfo[];
  playerSprite: string;
  defaultCover: string;
  vault: ReactNode;
  /** Server-rendered lock screen (null when the floor is open). */
  gate: ReactNode;
  /** Floors the player has open — drives the case-file filter chips. */
  unlockedFloors: number[];
  /**
   * Today's Daily Case (/daily): the briefing comes from the case and is remembered per day, and the
   * case file is the case's own small file. Everything else (talk, outcome, elevator) is the same.
   */
  daily?: DailyCase;
}) {
  const dailyBriefKey = daily ? `cc-briefed-daily-${daily.date}` : null;
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [caseFile, setCaseFile] = useState(false);
  const openCaseFile = useCallback(() => setCaseFile(true), []);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  // Continue or restart: this place's open run is remembered in the browser (app/floor/ResumeRun).
  const place = daily ? `daily-${daily.date}` : `floor-${map.floor}`;
  const saved = useSavedRun(place);
  const savedRef = useLatest(saved);
  const [resumeDecided, setResumeDecided] = useState(false);
  const [cover, setCover] = useState(defaultCover);
  // The employee whose state the page polls: the one you are talking to, or last talked to.
  const [focus, setFocus] = useState<EmployeeId>(map.npcs[0]?.id ?? "penny");
  const [lockedOut, setLockedOut] = useState<Set<EmployeeId>>(new Set());
  const [levels, setLevels] = useState<Partial<Record<EmployeeId, number>>>({});
  const [dismissedRun, setDismissedRun] = useState<string | null>(null);
  // Guide state: who the player has talked to, and has this floor been breached this visit.
  const [talkedTo, setTalkedTo] = useState<ReadonlySet<EmployeeId>>(new Set());
  const [cleared, setCleared] = useState(false);

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
  // A breach opens the next floor for this browser too (guests play as the shared demo player).
  // A clear of today's Daily Case (not a practice replay) keeps a guest's streak, kept in this browser.
  const practice = !!state?.run?.practice;
  // A finished run is never offered to continue.
  useEffect(() => {
    if (outcome) clearRun(place);
  }, [outcome, place]);
  useEffect(() => {
    if (outcome !== "breach") return;
    markClearedHere(map.floor);
    if (daily && !practice) markDailyCleared(daily.date);
  }, [outcome, map.floor, daily, practice]);
  // The result waits for the employee to finish their last reply (NpcDialogue calls onSettled);
  // with no conversation open it shows at once.
  const [settledRun, setSettledRun] = useState<string | null>(null);
  const showOutcome =
    !!state && (outcome === "breach" || outcome === "lockout") && dismissedRun !== runId && (open?.kind !== "npc" || settledRun === runId);
  // The HUD's VAULT is a server read: refresh it once the payment has landed and the result is up.
  const paidShown = showOutcome && outcome === "breach";
  useEffect(() => {
    if (paidShown) router.refresh();
  }, [paidShown, router]);

  const onSession = useCallback(
    (id: string, startedAt: number | null) => {
      setRunId(id);
      if (startedAt != null) setRunStartedAt((t) => t ?? startedAt);
      const prev = savedRef.current;
      saveRun(place, { runId: id, startedAt: startedAt ?? (prev?.runId === id ? prev.startedAt : null) });
    },
    [place, savedRef],
  );

  /** The run is over: the next conversation starts a new one. */
  const resetRun = (clearLocks: boolean) => {
    clearRun(place);
    setDismissedRun(runId);
    setOpen(null);
    setRunId(null);
    setRunStartedAt(null);
    setLevels({});
    if (clearLocks) setLockedOut(new Set());
  };

  // RESTART in the HUD (confirmed first): hang up, forget the run, reset the clock, suspicion and lockouts.
  // The next conversation starts a fresh run.
  const [askRestart, setAskRestart] = useState(false);
  const restart = () => {
    setAskRestart(false);
    setCaseFile(false);
    setTalkedTo(new Set());
    setCleared(false);
    resetRun(true);
  };

  // Leaving: confirm first, then elevator doors close, then the page changes.
  const [pending, setPending] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<{ to: string; label: string } | null>(null);
  const leavingRef = useLatest(leaving);
  const pendingRef = useLatest(pending);
  const askLeave = useCallback((to: string) => {
    if (leavingRef.current || pendingRef.current) return;
    router.prefetch(to);
    setOpen(null);
    setPending(to);
  }, [router, leavingRef, pendingRef]);
  const leave = useCallback((to: string) => {
    if (leavingRef.current) return;
    setPending(null);
    setLeaving({ to, label: to === "/tower" ? "Lobby · back to the tower" : `Going to ${to.replace("/floor/", "Floor ")}` });
  }, [leavingRef]);
  const arrived = useCallback(() => {
    const ride = leavingRef.current;
    if (!ride) return;
    router.push(ride.to);
    // Next keeps this page's state for when you come back; a ride still set then would close the
    // doors and send you off again (the elevator bounce loop). The doors stay shut until the page changes.
    setLeaving(null);
  }, [router, leavingRef]);

  // Krystal's briefing on the first visit to this floor (read after mount: storage is client-only).
  const needsBriefing = useClientValue<boolean | null>(
    () => (dailyBriefKey ? !wasBriefed(dailyBriefKey) : !!briefingFor(map.floor) && !wasBriefed(map.floor)),
    null,
  );
  const [briefed, setBriefed] = useState(false); // closed this visit
  const briefing: boolean | null = briefed ? false : needsBriefing;
  const setBriefing = (v: boolean) => setBriefed(!v);
  const showResume = !!saved && !runId && !resumeDecided && briefing === false;

  const onEvent = useCallback(
    (e: SceneEvent) => {
      if (e.type === "exit") return askLeave(e.to);
      if (e.type === "interact-npc") {
        setFocus(e.id);
        setTalkedTo((s) => (s.has(e.id) ? s : new Set(s).add(e.id)));
        setOpen({ kind: "npc", id: e.id });
      } else setOpen({ kind: "prop", id: e.id });
    },
    [askLeave],
  );

  // Only "talking" is a bubble. Wary (suspicion 60+) and locked out go in the name plate instead: a "?"
  // or "!" bubble floated a tile above the head, over desks and walls, and hid the name and talk hint.
  const emotes: FloorSceneProps["emotes"] = {};
  const names: Record<string, string> = {};
  for (const n of map.npcs) {
    emotes[n.id] = open?.kind === "npc" && open.id === n.id ? "talking" : null;
    const first = npcs.find((x) => x.id === n.id)?.name.split(" ")[0] ?? n.id;
    names[n.id] = lockedOut.has(n.id) ? `${first} (locked)` : (levels[n.id] ?? 0) >= 60 ? `${first} (wary)` : first;
  }

  // Keep the player above the dialogue box: measure it while it is open.
  const [inset, setInset] = useState(0);
  const boxOpen = !!open;
  useEffect(() => {
    const box = boxOpen ? document.querySelector<HTMLElement>("[data-dialogue-box]") : null;
    if (!box) return;
    const ro = new ResizeObserver(() => setInset(box.offsetHeight));
    ro.observe(box);
    return () => ro.disconnect();
  }, [boxOpen, open]);

  // The guide's dots point to the elevator only once the level is done (a breach). Until then they lead
  // to the nearest employee you haven't talked to yet and who hasn't locked you out (Floor 1: Dee, then
  // Penny; Floor 2: Annie, then Bill), and disappear once you've met everyone.
  const exit = map.exits?.[0];
  const dist = (n: { x: number; y: number }) => Math.abs(n.x - map.spawn.x) + Math.abs(n.y - map.spawn.y);
  const nextNpc = [...map.npcs].filter((n) => !talkedTo.has(n.id) && !lockedOut.has(n.id)).sort((a, b) => dist(a) - dist(b))[0];
  const goal = cleared && exit ? { x: exit.x, y: exit.y } : nextNpc ? { x: nextNpc.x, y: nextNpc.y } : null;
  const tags = cleared && exit ? [{ x: exit.x, y: exit.y - 1, text: "LOBBY" }] : undefined;

  const npc = open?.kind === "npc" ? npcs.find((n) => n.id === open.id) : null;
  const prop = open?.kind === "prop" ? map.props?.find((p) => p.id === open.id) : null;
  const finished = !!state?.run?.ended_at;

  return (
    <main className={`cc-floor-1 cc-floor-${map.floor} relative flex h-dvh flex-col overflow-hidden`}>
      <div className="relative min-h-0 flex-1">
        <FloorScene map={map} playerSprite={playerSprite} paused={!!open || showOutcome || briefing !== false || !!leaving || !!pending || caseFile || showResume || askRestart} onEvent={onEvent} emotes={emotes} insetBottom={boxOpen ? inset : 0} goal={goal} tags={tags} names={names} />
      </div>

      <Hud floorName={map.name} startedAt={runStartedAt} finalMs={state?.run?.duration_ms ?? null} vault={vault} onTower={() => askLeave("/tower")} onCaseFile={openCaseFile} onRestart={runId && !showOutcome ? () => setAskRestart(true) : undefined} />

      {npc && !showOutcome && (
        <NpcDialogue
          key={npc.id}
          npc={npc}
          floor={map.floor}
          // A finished run is not continued: talking again starts a new one.
          runId={finished ? null : runId}
          cover={cover}
          onCover={setCover}
          state={focus === npc.id ? state : null}
          lockedOut={lockedOut.has(npc.id)}
          onSession={onSession}
          onClose={() => setOpen(null)}
          onCaseFile={openCaseFile}
          onSettled={() => setSettledRun(runId)}
          dailyDate={daily?.date}
        />
      )}
      {prop && <PropDialogue id={prop.id} label={prop.label} text={prop.text} onClose={() => setOpen(null)} />}

      {showOutcome && state && (
        <OutcomeOverlay
          state={state}
          employeeName={npcs.find((n) => n.id === focus)?.name.split(" ")[0] ?? "They"}
          onRetry={() => resetRun(true)}
          onClose={() => {
            if (outcome === "breach") setCleared(true);
            resetRun(outcome === "breach");
          }}
        />
      )}

      <MusicToggle track={`music-floor-${daily ? 0 : map.floor}.mp3`} />

      {/* Krystal's radio: a hint line for a time penalty, on the four floors (not the Daily Case). Hidden while

          a conversation, the briefing or the result is open, so it never covers them. */}

      {!daily && !open && !showOutcome && briefing === false && <KrystalRadio floor={map.floor} runId={runId} variant="floating" />}
      {/* Hidden, not closed, while the case file is open: its buttons showed through the overlay. */}
      {briefing && <div className={caseFile ? "hidden" : undefined}><Briefing
            floor={map.floor}
            floorName={map.name}
            onStart={() => setBriefing(false)}
            onCaseFile={openCaseFile}
            pages={daily?.brief}
            storageKey={dailyBriefKey ?? undefined}
          /></div>}
      {caseFile && <CaseFileOverlay floor={map.floor} unlockedFloors={unlockedFloors} daily={daily} onClose={() => setCaseFile(false)} />}
      {gate}
      {showResume && saved && (
        <ResumeRun
          place={place}
          saved={saved}
          employeeId={map.npcs[0]?.id ?? "barry"}
          onContinue={(r) => {
            setRunId(r.runId);
            setRunStartedAt(r.startedAt);
            setResumeDecided(true);
          }}
          onRestart={() => setResumeDecided(true)}
        />
      )}
      {askRestart && <RestartConfirm onRestart={restart} onStay={() => setAskRestart(false)} />}
      {pending && (
        <ExitConfirm to={pending} onGo={() => leave(pending)} onStay={() => setPending(null)} />
      )}
      <Elevator label={map.name} leaving={leaving} onClosed={arrived} />
    </main>
  );
}
