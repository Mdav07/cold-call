"use client";

// The bottom dialogue box on a floor: a name plate, a portrait, typewriter text and a choice
// cursor. One box shows either a prop (text only) or a conversation with an employee, which
// runs through the same ElevenLabs hook as the chat room (app/play/useEmployeeChat).

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EmployeeId } from "@/shared/interfaces";
import { useEmployeeChat } from "@/app/play/useEmployeeChat";
import type { RunState } from "@/app/play/useRunState";
import { PORTRAITS } from "@/app/play/portraits";
import { useTypewriter } from "./useTypewriter";
import { Choices, type Choice } from "./Choices";
import { ProposalPanel, SuspicionMeter, clock, moodFor } from "./parts";
import { blip, chime, voicePitch } from "@/app/floor/hud/sound";
import { collectFromProp, useCollectedEvidence } from "@/app/play/evidence";
import { DEFAULT_THEME, themeFor, themeVars, type BoxTheme } from "./themes";
import { EvidenceDrawer, evidenceForFloor, type EvidenceItem } from "@/app/play/EvidenceDrawer";

export interface NpcInfo {
  id: EmployeeId;
  name: string;
  title: string;
  /** Sprite sheet, for people without a drawn portrait (the Daily Case): the box shows its face. */
  sprite?: string;
}

/** A face cropped from a walking sprite (frame 0, head and shoulders), crisp at any size. */
function SpriteFace({ sprite }: { sprite: string }) {
  return (
    <svg viewBox="2 12 12 12" aria-hidden style={{ imageRendering: "pixelated" }}>
      <image href={sprite} width={64} height={128} style={{ imageRendering: "pixelated" }} />
    </svg>
  );
}

/**
 * Height of the on-screen keyboard that covers the page (iOS keeps the layout viewport and
 * shrinks only the visual one). Android Chrome resizes the page instead (see the viewport export
 * in layout.tsx), and there this stays 0.
 */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    on();
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => {
      vv.removeEventListener("resize", on);
      vv.removeEventListener("scroll", on);
    };
  }, []);
  return inset;
}

/** Hidden when the screen is short (a phone with the keyboard open) to keep the text field in view. */
const SHORT = "[@media(max-height:560px)]:hidden";

/** The frame every box shares. `above` stacks on top of the box (the conversation log). */
function Frame({
  name,
  portrait,
  side,
  above,
  theme = DEFAULT_THEME,
  children,
}: {
  name: string;
  /** The speaker's colours (see themes.ts). */
  theme?: BoxTheme;
  portrait?: ReactNode;
  side?: ReactNode;
  above?: ReactNode;
  children: ReactNode;
}) {
  const keyboard = useKeyboardInset();
  return (
    <div
      data-dialogue-box
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      style={{ ...themeVars(theme), ...(keyboard ? { bottom: keyboard } : {}) }}
    >
      {above && <div className="mx-auto mb-5 max-w-4xl">{above}</div>}
      <div className="relative mx-auto max-w-4xl">
        <p
          // One line only: a long sign name is cut with an ellipsis rather than covering the text.
          className="absolute -top-4 left-4 z-10 flex max-w-[calc(100%-2rem)] items-center truncate border-2 bg-[var(--cc-tag)] px-3 py-1.5 font-pixel text-[10px] leading-none text-[var(--cc-edge)]"
          style={{ borderColor: "var(--cc-border)", boxShadow: "3px 3px 0 0 var(--cc-edge)" }}
          title={name}
        >
          {name}
        </p>
        <div
          className="flex gap-3 border-[3px] bg-[var(--cc-dialog)] p-3 pt-5 sm:gap-4 sm:p-4 sm:pt-6"
          style={{
            borderColor: "var(--cc-border)",
            boxShadow: "inset 0 0 0 3px var(--cc-dialog), inset 0 0 0 5px var(--cc-border), 4px 4px 0 0 var(--cc-edge)",
          }}
        >
          {portrait && (
            <div
              style={{ borderColor: "var(--cc-border)" }}
              className={`pixel-frame grid h-16 w-16 shrink-0 place-items-center overflow-hidden bg-[var(--cc-portrait)] sm:h-28 sm:w-28 [&>svg]:h-full [&>svg]:w-full ${keyboard ? "hidden" : SHORT}`}
            >
              {portrait}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
          {side && <div className="hidden w-44 shrink-0 flex-col gap-3 text-xs text-[var(--cc-muted)] md:flex">{side}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Typewriter text with a blip per couple of letters (muted by the HUD switch; with reduced motion
 * the text appears at once and makes no sound). A key press or a click while it types shows the rest.
 */
function Say({ text, pitch, pixel = false, onDone }: { text: string; pitch?: number; pixel?: boolean; onDone?: (done: boolean) => void }) {
  const { visible, done, skip } = useTypewriter(text);
  useEffect(() => onDone?.(done), [done, onDone]);
  const n = visible.length;
  useEffect(() => {
    if (!done && n > 0 && n % 2 === 0 && /\S/.test(text[n - 1] ?? "")) blip(pitch);
  }, [n, done, text, pitch]);
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.repeat || t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.closest?.("[aria-modal=true]")) return;
      if (e.key === "Enter" || e.key === " " || e.key === "e") {
        e.preventDefault();
        e.stopImmediatePropagation();
        skip();
      }
    };
    // Capture phase: the skip key must not also confirm a choice.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [done, skip]);
  return (
    <p
      onClick={skip}
      className={`min-h-[3.5rem] text-[var(--cc-ink)] ${pixel ? "font-pixel text-[12px] leading-[1.9] sm:text-[13px]" : "text-base leading-snug sm:text-lg"}`}
      aria-live="polite"
    >
      {visible}
      {!done && <span aria-hidden className="opacity-0">{text.slice(visible.length)}</span>}
      {done && (
        <span aria-hidden className="cc-next ml-2 align-middle text-xs text-[var(--cc-accent)]">
          ▼
        </span>
      )}
    </p>
  );
}

/** Escape closes the box, unless a text field has focus (there it only blurs). */
function useEscape(onEscape: () => void) {
  const ref = useRef(onEscape);
  useEffect(() => {
    ref.current = onEscape;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT") return t.blur();
      ref.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** A sign, memo or binder: text only, any confirm key closes it. */
/** Krystal's notes left on each floor: her face, her colours and her (pixel) font. */
const isKrystalNote = (id: string) => id.startsWith("krystal");

export function PropDialogue({ id = "", label, text, onClose }: { id?: string; label: string; text: string; onClose: () => void }) {
  const [done, setDone] = useState(false);
  useEscape(onClose);
  // Reading a prop files the evidence it reveals (Audrey's evidence.ts). Only new items come back,
  // so "Evidence found" shows once. (In dev, Strict Mode runs this twice; the second run finds
  // nothing new and leaves the state alone.)
  const [found, setFound] = useState<EvidenceItem[]>([]);
  useEffect(() => {
    if (!id) return;
    const fresh = collectFromProp(id);
    // Syncing from an external store (localStorage) the moment the note opens; it runs once per note.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fresh.length) setFound(fresh);
  }, [id]);
  const announced = useRef(false);
  useEffect(() => {
    if (done && found.length && !announced.current) {
      announced.current = true;
      chime();
    }
  }, [done, found.length]);
  const krystal = isKrystalNote(id);
  const Face = PORTRAITS.krystal;
  return (
    <Frame
      name={label}
      theme={krystal ? themeFor("krystal") : undefined}
      portrait={krystal && Face ? <Face mood="neutral" /> : undefined}
    >
      <Say text={text} pitch={krystal ? voicePitch("krystal") : 260} pixel={krystal} onDone={setDone} />
      {done && found.length > 0 && (
        <p role="status" className="font-pixel text-[10px] leading-relaxed text-[var(--cc-ok)]">
          📎 Evidence found: {found.map((f) => f.label).join(", ")}
        </p>
      )}
      <Choices active={done} choices={[{ label: "Close", onSelect: onClose }]} />
    </Frame>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

type Stage = "menu" | "talk";

/**
 * A conversation with one employee. Mount it with `key={npc.id}`; unmounting ends the call.
 * The floor's run is shared: the first talk starts a run (you introduce yourself in your first message), later talks
 * (this employee again or a floor-mate) continue it with `runId`.
 */
export function NpcDialogue({
  npc,
  floor,
  runId,
  cover,
  state,
  lockedOut,
  onSession,
  onClose,
  onCaseFile,
  onSettled,
  dailyDate,
}: {
  npc: NpcInfo;
  /** The floor, for its evidence. */
  floor: number;
  /**
   * Called once the run is over (breach or lockout) and the employee has finished their last reply:
   * the page shows the result only then, never mid-sentence.
   */
  onSettled?: () => void;
  /** The Daily Case: which day's case this conversation is about (earlier days are practice). */
  dailyDate?: string;
  runId: string | null;
  cover: string;
  /** Unused since the cover-story step was removed; kept so callers compile. */
  onCover?: (cover: string) => void;
  /** Run state polled by the page for this employee. */
  state: RunState | null;
  lockedOut: boolean;
  /** Reports the run id and when the first message was sent (starts the run clock). */
  onSession: (runId: string, startedAt: number | null) => void;
  onClose: () => void;
  /** Opens the case file overlay. */
  onCaseFile: () => void;
}) {
  const chat = useEmployeeChat(npc.id, dailyDate);
  const [stage, setStage] = useState<Stage>("menu");
  const [channel, setChannel] = useState<"chat" | "voice">("chat");
  const [draft, setDraft] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [typed, setTyped] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const floorEvidence = evidenceForFloor(floor);
  const hasEvidence = floorEvidence.length > 0;
  const collected = useCollectedEvidence();
  const evidenceLabel = `Evidence (${floorEvidence.filter((e) => collected.has(e.id)).length}/${floorEvidence.length})`;
  // Presenting evidence is a chat message the agent reads, as in the chat room.
  const present = (text: string, item: EvidenceItem) => {
    chat.send(`[EVIDENCE: ${item.label}: ${text}]`);
    setEvidenceOpen(false);
  };
  const field = useRef<HTMLInputElement>(null);
  const first = npc.name.split(" ")[0];
  const live = chat.status === "live";
  const now = useNow(live);
  const suspicion = state?.level ?? 10;
  const Art = PORTRAITS[npc.id];

  useEffect(() => {
    if (live) field.current?.focus();
  }, [live]);

  const runFor = chat.session?.run_id ?? null;
  useEffect(() => {
    if (runFor) onSession(runFor, chat.startedAt);
  }, [runFor, chat.startedAt, onSession]);

  // A lockout or a finished run ends the call from our side, but only once the employee has finished
  // talking: their last reply typed out (chat) or spoken (call), then a moment of quiet. The payment
  // usually lands while they are still confirming it. A hard cap keeps a silent agent from stalling.
  const { hangUp } = chat;
  const runOver = !!(state?.locked_out || state?.run?.ended_at);
  const [settled, setSettled] = useState(false);
  const agentLines = chat.lines.filter((l) => l.role === "agent").length;
  const snap = useRef({ agentLines, lastAgentAt: 0, busy: false, live });
  const busy = chat.waiting || !typed || (chat.channel === "voice" && chat.mode === "speaking");
  useEffect(() => {
    snap.current.lastAgentAt = Date.now();
  }, [agentLines]);
  useEffect(() => {
    snap.current.agentLines = agentLines;
    snap.current.busy = busy;
    snap.current.live = live;
  });
  useEffect(() => {
    if (!runOver) return;
    const seenAt = Date.now();
    const linesAtEnd = snap.current.agentLines;
    const t = setInterval(() => {
      const s = snap.current;
      const now = Date.now();
      // After a reply that came in since the run ended (or a closed line), a short pause is enough;
      // otherwise give the employee a few seconds to start their confirmation.
      const quietNeeded = s.agentLines > linesAtEnd || !s.live ? 1500 : 4000;
      const quiet = now - Math.max(s.lastAgentAt, seenAt);
      if ((!s.busy && quiet >= quietNeeded) || now - seenAt > 20_000) {
        clearInterval(t);
        hangUp();
        setSettled(true);
        onSettled?.();
      }
    }, 250);
    return () => clearInterval(t);
  }, [runOver, hangUp, onSettled]);

  const talkLeft =
    chat.session?.talk_seconds != null
      ? chat.session.talk_seconds * 1000 - (chat.connectedAt ? now - chat.connectedAt : 0)
      : null;
  const outOfTime = live && talkLeft != null && talkLeft <= 0;
  useEffect(() => {
    if (outOfTime) hangUp();
  }, [outOfTime, hangUp]);

  const leave = () => {
    chat.hangUp();
    onClose();
  };
  useEscape(leave);

  // No cover-story step: Talk or Call connects at once and the player introduces themselves.
  const pick = (ch: "chat" | "voice") => {
    setChannel(ch);
    setStage("talk");
    chat.start(cover, ch, runId ?? undefined);
  };

  const lastAgent = [...chat.lines].reverse().find((l) => l.role === "agent");
  const lastSystem = chat.lines.at(-1)?.role === "system" ? chat.lines.at(-1)!.text : null;
  const ended = stage === "talk" && (chat.status === "ended" || chat.status === "error");

  let text: string;
  if (lockedOut) text = `${first} won't talk to you. Security has your description.`;
  else if (stage === "talk" && chat.status === "connecting") text = channel === "voice" ? `Ringing ${first}…` : `Walking up to ${first}'s desk…`;
  else if (stage === "talk" && chat.status === "error") text = chat.error ?? "The line is dead.";
  else if (stage === "talk" && lastAgent && !ended) text = lastAgent.text;
  // Out of time isn't the end: the player can call back, with less time each call (server/game/session.ts).
  else if (ended && talkLeft != null && talkLeft <= 0) text = `Out of time: ${first} has to get back to work. Call back for a shorter chat.`;
  else if (ended) text = lastSystem ?? lastAgent?.text ?? "The line went quiet.";
  else text = `${npc.name}, ${npc.title}. ${first} looks up from the desk.`;

  const menu: Choice[] = lockedOut
    ? [{ label: "Leave", onSelect: onClose }]
    : [
        { label: ended ? "Talk again" : "Talk", onSelect: () => pick("chat") },
        { label: ended ? "Call back" : "Call", onSelect: () => pick("voice") },
        { label: "Case file", onSelect: onCaseFile },
        { label: "Leave", onSelect: onClose },
      ];

  const side = (
    <>
      <SuspicionMeter value={suspicion} />
      {state?.reason && (
        <p className={state.reason.delta > 0 ? "text-[var(--cc-danger)]" : "text-[var(--cc-ok)]"}>
          {state.reason.delta > 0 ? "▲" : "▼"} {first} noticed: {state.reason.text}
        </p>
      )}
      <div>
        <span className="font-pixel block text-[10px]">Request</span>
        {/* The payment shows with the result screen, after the employee has finished talking. */}
        {runOver && !settled ? <p>Processing…</p> : <ProposalPanel state={state} />}
      </div>
      {stage === "talk" && talkLeft != null && <p className="font-pixel text-[10px]">TALK {clock(talkLeft)}</p>}
      {chat.session?.stub && <p className="text-[var(--cc-warn)]">Stub mode: nothing is saved.</p>}
    </>
  );

  return (
    <>
      <Frame
        name={npc.name}
        theme={themeFor(npc.id)}
        portrait={
          Art ? (
            <Art mood={moodFor(suspicion)} />
          ) : npc.sprite ? (
            <SpriteFace sprite={npc.sprite} />
          ) : (
            <span className="font-pixel text-xl">{first[0]}</span>
          )
        }
        side={side}
        above={
          showLog && chat.lines.length > 0 ? (
            <ul className="pixel-frame flex max-h-60 flex-col gap-2 overflow-y-auto bg-[var(--cc-panel)] p-3 text-sm [@media(max-height:560px)]:max-h-28">
              {chat.lines.map((l) => (
                <li key={l.id} className={l.role === "system" ? "text-xs text-[var(--cc-muted)]" : "text-[var(--cc-ink)]"}>
                  {l.role !== "system" && (
                    <span className="font-pixel mr-2 text-[10px] text-[var(--cc-accent)]">{l.role === "agent" ? first : "You"}</span>
                  )}
                  {l.text}
                </li>
              ))}
            </ul>
          ) : null
        }
      >
        <Say text={text} pitch={voicePitch(npc.id)} onDone={setTyped} />
        {chat.waiting && channel === "chat" && <p className="text-xs text-[var(--cc-muted)]">{first} is typing…</p>}

        {/* Phones have no side column: show the meter under the text. */}
        <div className={`md:hidden ${SHORT}`}>
          <SuspicionMeter value={suspicion} />
        </div>

        {stage === "talk" && !ended ? (
          channel === "voice" ? (
            <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-pixel text-[10px] text-[var(--cc-ink)]" aria-live="polite">
                {!live ? "Connecting…" : chat.mode === "speaking" ? `☎ ${first} is talking…` : chat.muted ? "☎ You're muted" : "☎ Your turn: speak"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="pixel-button" onClick={chat.toggleMute} disabled={!live}>
                  {chat.muted ? "Unmute" : "Mute"}
                </button>
                {/* Evidence goes to the agent as a text message, which works on a call too. */}
                {hasEvidence && (
                  <button type="button" className="pixel-button" onClick={() => setEvidenceOpen(true)} disabled={!live}>
                    {evidenceLabel}
                  </button>
                )}
                <button type="button" className="pixel-button" onClick={onCaseFile}>
                  Case file
                </button>
                <button type="button" className="pixel-button" onClick={() => setShowLog((s) => !s)}>
                  Log
                </button>
                <button type="button" className="pixel-button" onClick={chat.hangUp} disabled={!live}>
                  Hang up
                </button>
              </div>
            </div>
            </>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                chat.send(draft);
                setDraft("");
              }}
            >
              <div className="flex gap-2">
              <input
                ref={field}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!live}
                placeholder={live ? "Say something…" : "Connecting…"}
                aria-label="Message"
                className="pixel-frame min-w-0 flex-1 bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)] outline-none disabled:opacity-50"
              />
              <button type="submit" className="pixel-button shrink-0" disabled={!live || !draft.trim()}>
                Send
              </button>
              </div>
              {/* Secondary actions, smaller, on their own row. */}
              <div className="flex flex-wrap gap-2 [&>button]:!px-2.5 [&>button]:!py-1.5 [&>button]:!text-[9px]">
                {hasEvidence && (
                  <button type="button" className="pixel-button" onClick={() => setEvidenceOpen(true)} disabled={!live}>
                    {evidenceLabel}
                  </button>
                )}
                <button type="button" className="pixel-button" onClick={onCaseFile}>
                  Case file
                </button>
                <button type="button" className="pixel-button" onClick={() => setShowLog((s) => !s)}>
                  Log
                </button>
                <button type="button" className="pixel-button" onClick={chat.hangUp} disabled={!live}>
                  Hang up
                </button>
              </div>
            </form>
          )
        ) : (
          <Choices active={typed} choices={menu} />
        )}
      </Frame>
      <EvidenceDrawer floor={floor} open={evidenceOpen} onClose={() => setEvidenceOpen(false)} onPresent={present} />
    </>
  );
}
