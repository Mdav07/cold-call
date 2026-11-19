"use client";

// One walkable floor: the engine's canvas, the HUD, the dialogue box and the run outcome.
// A run belongs to the floor: the first conversation starts it with a cover story, later
// conversations (call-backs, the floor-mate) continue it.

import { FallingLeaves } from "@/app/play/FallingLeaves";
import { helperPropId } from "@/app/daily/room";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useClientValue, useLatest } from "@/app/play/clientHooks";
import { markClearedHere } from "@/app/floor/guestProgress";
import { markDailyCleared } from "@/app/play/streak";
import { useRouter } from "next/navigation";
import type { EmployeeId } from "@/shared/interfaces";
import { CONSOLE_QUERY, FloorScene } from "@/app/floor/engine/FloorScene";
import { useMediaQuery } from "@/app/play/clientHooks";
import type { FloorMap, FloorSceneProps, SceneEvent } from "@/app/floor/types";
import { useRunState, type RunState } from "@/app/play/useRunState";
import { OutcomeOverlay } from "@/app/play/OutcomeOverlay";
import { MusicToggle } from "@/app/play/MusicToggle";
import { HelperDialogue, NpcDialogue, PropDialogue, type NpcInfo } from "@/app/floor/dialogue/DialogueBox";
import type { HelperLine } from "@/shared/seasonalCase";
import { clearSolved, gameFor, markSolved, MiniGame, useSolved } from "@/app/floor/minigames/MiniGame";
import { Hud } from "@/app/floor/hud/Hud";
import { CaseFileOverlay } from "@/app/floor/dialogue/CaseFileOverlay";
import { Elevator } from "./Elevator";
import { ExitConfirm } from "@/app/floor/ExitConfirm";
import { RestartConfirm } from "@/app/floor/RestartConfirm";
import type { CaseData } from "@/app/casefile/data";
import { clearRun, ResumeRun, saveRun, useSavedRun } from "@/app/floor/ResumeRun";
import { Briefing, briefingFor, wasBriefed } from "./Briefing";
import type { DailyCase } from "@/shared/dailyCase";
import { currentSeason, isSeasonalDate } from "@/shared/seasonalCase";
import { markSeasonCleared } from "@/app/tower/seasonProgress";

type Open = { kind: "npc"; id: EmployeeId } | { kind: "prop"; id: string } | null;

export function FloorGame({
  map,
  npcs,
  playerSprite,
  defaultCover,
  vault,
  gate,
  unlockedFloors,
  caseData,
  daily,
  helperTalks,
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
  /** The case file's contents for the unlocked floors (built on the server). */
  caseData: CaseData;
  /**
   * Today's Daily Case (/daily): the briefing comes from the case and is remembered per day, and the
   * case file is the case's own small file. Everything else (talk, outcome, elevator) is the same.
   */
  daily?: DailyCase;
  /** Scripted characters' conversations, by character id (the seasonal helper). */
  helperTalks?: Record<string, { name: string; lines: HelperLine[] }>;
}) {
  const dailyBriefKey = daily ? `cc-briefed-daily-${daily.date}` : null;
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [caseFile, setCaseFile] = useState(false);
  const openCaseFile = useCallback(() => setCaseFile(true), []);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const clockArmed = useRef(false); // the level clock has started this visit (see below)
  // Continue or restart: this place's open run is remembered in the browser (app/floor/ResumeRun).
  const place = daily ? `daily-${daily.date}` : `floor-${map.floor}`;
  // Which lobby entrance this level comes back to (RESTART, the security escort).
  const entranceKey = daily ? (isSeasonalDate(daily.date) ? "seasonal" : "daily") : `floor-${map.floor}`;
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
  // 100% suspicion: security walks the player out (the escort cutscene in FloorScene). Key: run and
  // employee, so each lockout plays it once. Set below, once the lockout is known.
  const [escort, setEscort] = useState<string | null>(null);
  const [escorted, setEscorted] = useState<ReadonlySet<string>>(new Set());
  const [settledKey, setSettledKey] = useState<string | null>(null);

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
    // The seasonal case isn't a Daily Case: no streak; the lobby door remembers it as cleared instead.
    if (daily && isSeasonalDate(daily.date)) markSeasonCleared(daily.date);
    else if (daily && !practice) markDailyCleared(daily.date);
  }, [outcome, map.floor, daily, practice]);
  // Security comes for an employee who locked you out during this visit (not one found locked when a
  // saved run is resumed): right away if their call is closed, once their last line has played if it's
  // still open, and after 7 s at the latest (a call can stay open without settling).
  const lockNpc = runId ? [...lockedOut].find((id) => talkedTo.has(id) && !escorted.has(`${runId}:${id}`)) : undefined;
  const lockKey = lockNpc ? `${runId}:${lockNpc}` : null;
  const lockCallOpen = open?.kind === "npc" && open.id === lockNpc;
  const lockReady = !lockCallOpen || settledKey === lockKey;
  // The result waits for the employee to finish their last reply (NpcDialogue calls onSettled);
  // with no conversation open it shows at once.
  const [settledRun, setSettledRun] = useState<string | null>(null);
  const showOutcome =
    !escort &&
    !lockKey && // a lockout still to be walked out: the result waits for the guard
    !!state && (outcome === "breach" || outcome === "lockout") && dismissedRun !== runId && (open?.kind !== "npc" || settledRun === runId);
  const outcomeRef = useLatest(outcome);
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
    clearSolved(place); // a new run: the clue games start over
    setDismissedRun(runId);
    setOpen(null);
    setRunId(null);
    setRunStartedAt(null);
    clockArmed.current = false; // the next start of the level (coming back, or Start) starts the clock
    setLevels({});
    setEscort(null);
    if (clearLocks) setLockedOut(new Set());
  };

  // RESTART in the HUD (confirmed first): hang up, forget the run, reset the clock, suspicion and lockouts.
  // The next conversation starts a fresh run.
  const [askRestart, setAskRestart] = useState(false);

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
  const leave = useCallback((to: string, label?: string) => {
    if (leavingRef.current) return;
    setPending(null);
    setLeaving({ to, label: label ?? (to === "/tower" ? "Lobby · back to the tower" : `Going to ${to.replace("/floor/", "Floor ")}`) });
  }, [leavingRef]);
  const restart = () => {
    setAskRestart(false);
    setCaseFile(false);
    setTalkedTo(new Set());
    setCleared(false);
    resetRun(true);
    // Back to the lobby, standing at this level's entrance, to start it fresh.
    leave(`/tower?at=${entranceKey}`, "Lobby · back to the start");
  };
  const arrived = useCallback(() => {
    const ride = leavingRef.current;
    if (!ride) return;
    router.push(ride.to);
    // Next keeps this page's state for when you come back; a ride still set then would close the
    // doors and send you off again (the elevator bounce loop). The doors stay shut until the page changes.
    setLeaving(null);
    setEscort(null); // walked out by security: the room is back to normal if you return
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

  // The run clock starts when the level does: Start on the briefing (or arriving, when there's none
  // to read), or choosing to start over on the resume prompt. Continuing a saved run keeps its start.
  const levelReady = briefing === false && !showResume;
  useEffect(() => {
    if (!levelReady || clockArmed.current) return;
    clockArmed.current = true;
    const t = setTimeout(() => setRunStartedAt((s) => s ?? Date.now()), 0);
    return () => clearTimeout(t);
  }, [levelReady]);

  const onEvent = useCallback(
    (e: SceneEvent) => {
      if (e.type === "exit") return askLeave(e.to);
      if (e.type === "interact-npc") {
        // A scripted character (the seasonal helper): their lines open like a sign, not an AI call.
        const scripted = map.props?.find((p) => p.id === helperPropId(e.id));
        if (scripted) {
          setTalkedTo((s) => (s.has(e.id) ? s : new Set(s).add(e.id))); // the guide moves on
          setOpen({ kind: "prop", id: scripted.id });
          return;
        }
        setFocus(e.id);
        setTalkedTo((s) => (s.has(e.id) ? s : new Set(s).add(e.id)));
        setOpen({ kind: "npc", id: e.id });
      } else setOpen({ kind: "prop", id: e.id });
    },
    [askLeave, map],
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

  // The guide's arrows lead to the nearest employee you haven't talked to yet and who hasn't locked you
  // out (Floor 1: Dee, then Penny; Floor 2: Annie, then Bill), even after a breach: one employee paying
  // doesn't mean you're done meeting people. Only once everyone's been met do they point at the elevator,
  // and only if the level is done (a breach); otherwise they disappear.
  const exit = map.exits?.[0];
  const dist = (n: { x: number; y: number }) => Math.abs(n.x - map.spawn.x) + Math.abs(n.y - map.spawn.y);
  const nextNpc = [...map.npcs].filter((n) => !talkedTo.has(n.id) && !lockedOut.has(n.id)).sort((a, b) => dist(a) - dist(b))[0];
  const toExit = cleared && !nextNpc && !!exit;
  const goal = nextNpc ? { x: nextNpc.x, y: nextNpc.y } : toExit ? { x: exit.x, y: exit.y } : null;
  const tags = toExit ? [{ x: exit.x, y: exit.y - 1, text: "LOBBY" }] : undefined;

  useEffect(() => {
    if (!lockKey || escort) return;
    const t = setTimeout(() => {
      setEscorted((s) => new Set(s).add(lockKey));
      setOpen(null);
      setEscort(lockKey);
    }, lockReady ? 0 : 7000);
    return () => clearTimeout(t);
  }, [lockKey, lockReady, escort]);

  // After the escort: if the run is over (everyone who could pay has locked you out), the result shows
  // here by the door; otherwise the guard has put you in the elevator back to the lobby.
  const escortDone = useCallback(() => {
    if (outcomeRef.current) setEscort(null);
    else leave(`/tower?at=${entranceKey}`, "Escorted out by security · the lobby");
  }, [outcomeRef, leave, entranceKey]);

  const npc = open?.kind === "npc" ? npcs.find((n) => n.id === open.id) : null;
  const prop = open?.kind === "prop" ? map.props?.find((p) => p.id === open.id) : null;
  // A clue with a game shows its text only once the game is solved (for this run).
  const solved = useSolved(place);
  // Scripted characters' lines (helper:…) never get a mini-game, and don't shift the clues' games.
  const clueIds = (map.props ?? []).map((p) => p.id).filter((id) => !id.startsWith("helper:"));
  const propGame = prop && !prop.id.startsWith("helper:") ? gameFor(map.floor, clueIds, prop.id) : null;
  const playing = prop && propGame && !solved.includes(prop.id) ? propGame : null;
  const finished = !!state?.run?.ended_at;

  // Phones held upright: the handheld-console layout, with the HUD bar docked on the deck under the map.
  const consoleMode = useMediaQuery(CONSOLE_QUERY);
  const hudProps = { floorName: map.name, startedAt: runStartedAt, finalMs: state?.run?.duration_ms ?? null, vault, onTower: () => askLeave("/tower"), onCaseFile: openCaseFile, onRestart: runId && !showOutcome && !escort ? () => setAskRestart(true) : undefined };
  const hud = <Hud {...hudProps} />;

  return (
    <main className={`cc-floor-1 cc-floor-${map.floor} relative flex h-dvh flex-col overflow-hidden`}>
      <div className="relative min-h-0 flex-1">
        <FloorScene map={map} playerSprite={playerSprite} paused={!!open || showOutcome || briefing !== false || !!leaving || !!pending || caseFile || showResume || askRestart || !!escort} onEvent={onEvent} emotes={emotes} insetBottom={boxOpen ? inset : 0} goal={escort ? null : goal} tags={tags} names={names} escort={escort ? { key: escort, onDone: escortDone } : null} deck={consoleMode ? <Hud docked {...hudProps} /> : undefined} />
        {daily && isSeasonalDate(daily.date) && currentSeason()?.door === "harvest" && <FallingLeaves />}
      </div>

      {!consoleMode && hud}

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
          onSettled={() => {
            setSettledRun(runId);
            setSettledKey(`${runId}:${npc.id}`);
          }}
          dailyDate={daily?.date}
          clockStart={runStartedAt}
        />
      )}
      {prop && playing && (
        <MiniGame
          key={prop.id}
          kind={playing}
          seed={`${place}:${prop.id}`}
          label={prop.label}
          easy={map.floor === 0}
          onWin={() => markSolved(place, prop.id)}
          onCancel={() => setOpen(null)}
        />
      )}
      {prop && !playing && (() => {
        // A scripted character with a conversation talks it through; otherwise their lines read like a sign.
        const talk = prop.id.startsWith("helper:") ? helperTalks?.[prop.id.slice("helper:".length)] : undefined;
        return talk?.lines.length ? (
          <HelperDialogue name={talk.name} lines={talk.lines} onClose={() => setOpen(null)} />
        ) : (
          <PropDialogue id={prop.id} label={prop.label} text={prop.text} onClose={() => setOpen(null)} />
        );
      })()}

      {showOutcome && state && (
        <OutcomeOverlay
          state={state}
          employeeName={npcs.find((n) => n.id === focus)?.name.split(" ")[0] ?? "They"}
          onRetry={() => {
            resetRun(true);
            setRunStartedAt(Date.now()); // trying again starts the clock again
          }}
          onClose={() => {
            if (outcome === "breach") setCleared(true);
            resetRun(outcome === "breach");
          }}
        />
      )}

      <MusicToggle track={`music-floor-${daily ? 0 : map.floor}.mp3`} />

      {/* Hidden, not closed, while the case file is open: its buttons showed through the overlay. */}
      {briefing && <div className={caseFile ? "hidden" : undefined}><Briefing
            floor={map.floor}
            floorName={map.name}
            onStart={() => setBriefing(false)}
            onCaseFile={openCaseFile}
            pages={daily?.brief}
            storageKey={dailyBriefKey ?? undefined}
            level={daily && isSeasonalDate(daily.date) ? "seasonal" : undefined}
          /></div>}
      {caseFile && <CaseFileOverlay data={caseData} floor={map.floor} unlockedFloors={unlockedFloors} daily={daily} onClose={() => setCaseFile(false)} />}
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
          onRestart={() => {
            clearSolved(place); // starting over: the clue games start over too
            setResumeDecided(true);
          }}
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
