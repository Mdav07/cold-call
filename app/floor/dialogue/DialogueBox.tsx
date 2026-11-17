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

export interface NpcInfo {
  id: EmployeeId;
  name: string;
  title: string;
}

/** The frame every box shares. */
function Frame({ name, portrait, side, children }: { name: string; portrait?: ReactNode; side?: ReactNode; children: ReactNode }) {
  return (
    <div data-dialogue-box className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4">
      <div className="relative mx-auto max-w-4xl">
        <p className="pixel-frame absolute -top-4 left-4 z-10 bg-[var(--cc-accent)] px-3 py-1 font-pixel text-[10px] text-[var(--cc-edge)]">
          {name}
        </p>
        <div className="pixel-frame flex gap-3 bg-[var(--cc-dialog)] p-3 pt-5 sm:gap-4 sm:p-4 sm:pt-6">
          {portrait && (
            <div className="pixel-frame grid h-16 w-16 shrink-0 place-items-center overflow-hidden bg-[var(--cc-portrait)] sm:h-28 sm:w-28 [&>svg]:h-full [&>svg]:w-full">
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

/** Typewriter text. A key press or a click while it is typing shows the rest. */
function Say({ text, onDone }: { text: string; onDone?: (done: boolean) => void }) {
  const { visible, done, skip } = useTypewriter(text);
  useEffect(() => onDone?.(done), [done, onDone]);
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.repeat || t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
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
    <p onClick={skip} className="min-h-[3.5rem] text-base leading-snug text-[var(--cc-ink)] sm:text-lg" aria-live="polite">
      {visible}
      {!done && <span aria-hidden className="opacity-0">{text.slice(visible.length)}</span>}
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
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT") return t.blur();
      ref.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** A sign, memo or binder: text only, any confirm key closes it. */
export function PropDialogue({ label, text, onClose }: { label: string; text: string; onClose: () => void }) {
  const [done, setDone] = useState(false);
  useEscape(onClose);
  return (
    <Frame name={label}>
      <Say text={text} onDone={setDone} />
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

type Stage = "menu" | "cover" | "talk";

/**
 * A conversation with one employee. Mount it with `key={npc.id}`; unmounting ends the call.
 * The floor's run is shared: the first talk asks for a cover story and starts a run, later talks
 * (this employee again or a floor-mate) continue it with `runId`.
 */
export function NpcDialogue({
  npc,
  runId,
  cover,
  onCover,
  state,
  lockedOut,
  onSession,
  onClose,
}: {
  npc: NpcInfo;
  runId: string | null;
  cover: string;
  onCover: (cover: string) => void;
  /** Run state polled by the page for this employee. */
  state: RunState | null;
  lockedOut: boolean;
  /** Reports the run id and when the first message was sent (starts the run clock). */
  onSession: (runId: string, startedAt: number | null) => void;
  onClose: () => void;
}) {
  const chat = useEmployeeChat(npc.id);
  const [stage, setStage] = useState<Stage>("menu");
  const [channel, setChannel] = useState<"chat" | "voice">("chat");
  const [draft, setDraft] = useState("");
  const [coverDraft, setCoverDraft] = useState(cover);
  const [showLog, setShowLog] = useState(false);
  const [typed, setTyped] = useState(false);
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

  // A lockout or a finished run ends the call from our side, as in the chat room.
  const { hangUp } = chat;
  useEffect(() => {
    if (live && (state?.locked_out || state?.run?.ended_at)) hangUp();
  }, [live, state?.locked_out, state?.run?.ended_at, hangUp]);

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

  const begin = (ch: "chat" | "voice", coverStory = cover) => {
    setChannel(ch);
    setStage("talk");
    chat.start(coverStory, ch, runId ?? undefined);
  };
  const pick = (ch: "chat" | "voice") => {
    if (runId) return begin(ch); // the run already has a cover
    setChannel(ch);
    setStage("cover");
  };

  const lastAgent = [...chat.lines].reverse().find((l) => l.role === "agent");
  const lastSystem = chat.lines.at(-1)?.role === "system" ? chat.lines.at(-1)!.text : null;
  const ended = stage === "talk" && (chat.status === "ended" || chat.status === "error");

  let text: string;
  if (lockedOut) text = `${first} won't talk to you. Security has your description.`;
  else if (stage === "cover") text = `Who are you today? ${first} will hear this cover story.`;
  else if (stage === "talk" && chat.status === "connecting") text = channel === "voice" ? `Ringing ${first}…` : `Walking up to ${first}'s desk…`;
  else if (stage === "talk" && chat.status === "error") text = chat.error ?? "The line is dead.";
  else if (stage === "talk" && lastAgent && !ended) text = lastAgent.text;
  else if (ended) text = lastSystem ?? lastAgent?.text ?? "The line went quiet.";
  else text = `${npc.name}, ${npc.title}. ${first} looks up from the desk.`;

  const menu: Choice[] = lockedOut
    ? [{ label: "Leave", onSelect: onClose }]
    : [
        { label: ended ? "Talk again" : "Talk", onSelect: () => pick("chat") },
        { label: ended ? "Call back" : "Call", onSelect: () => pick("voice") },
        { label: "Case file", onSelect: () => window.open("/casefile", "_blank", "noopener") },
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
        <ProposalPanel state={state} />
      </div>
      {stage === "talk" && talkLeft != null && <p className="font-pixel text-[10px]">TALK {clock(talkLeft)}</p>}
      {chat.session?.stub && <p className="text-[var(--cc-warn)]">Stub mode: nothing is saved.</p>}
    </>
  );

  return (
    <>
      {showLog && chat.lines.length > 0 && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-48 z-20 px-3 sm:bottom-56 sm:px-4">
          <ul className="pixel-frame mx-auto flex max-h-60 max-w-4xl flex-col gap-2 overflow-y-auto bg-[var(--cc-panel)] p-3 text-sm">
            {chat.lines.map((l) => (
              <li key={l.id} className={l.role === "system" ? "text-xs text-[var(--cc-muted)]" : "text-[var(--cc-ink)]"}>
                {l.role !== "system" && (
                  <span className="font-pixel mr-2 text-[10px] text-[var(--cc-accent)]">{l.role === "agent" ? first : "You"}</span>
                )}
                {l.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Frame
        name={npc.name}
        portrait={Art ? <Art mood={moodFor(suspicion)} /> : <span className="font-pixel text-xl">{first[0]}</span>}
        side={side}
      >
        <Say text={text} onDone={setTyped} />
        {chat.waiting && channel === "chat" && <p className="text-xs text-[var(--cc-muted)]">{first} is typing…</p>}

        {/* Phones have no side column: show the meter under the text. */}
        <div className="md:hidden">
          <SuspicionMeter value={suspicion} />
        </div>

        {stage === "cover" ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const c = coverDraft.trim() || cover;
              onCover(c);
              begin(channel, c);
            }}
          >
            <input
              autoFocus
              value={coverDraft}
              onChange={(e) => setCoverDraft(e.target.value)}
              maxLength={200}
              aria-label="Your cover story"
              className="pixel-frame min-w-0 flex-1 bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)] outline-none"
            />
            <div className="flex gap-2">
              <button type="submit" className="pixel-button">
                {channel === "voice" ? "☎ Call" : "✉ Talk"}
              </button>
              <button type="button" className="pixel-button" onClick={() => setStage("menu")}>
                Back
              </button>
            </div>
          </form>
        ) : stage === "talk" && !ended ? (
          channel === "voice" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-pixel text-[10px] text-[var(--cc-ink)]" aria-live="polite">
                {!live ? "Connecting…" : chat.mode === "speaking" ? `☎ ${first} is talking…` : chat.muted ? "☎ You're muted" : "☎ Your turn: speak"}
              </p>
              <div className="flex gap-2">
                <button type="button" className="pixel-button" onClick={chat.toggleMute} disabled={!live}>
                  {chat.muted ? "Unmute" : "Mute"}
                </button>
                <button type="button" className="pixel-button" onClick={() => setShowLog((s) => !s)}>
                  Log
                </button>
                <button type="button" className="pixel-button" onClick={chat.hangUp} disabled={!live}>
                  Hang up
                </button>
              </div>
            </div>
          ) : (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                chat.send(draft);
                setDraft("");
              }}
            >
              <input
                ref={field}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!live}
                placeholder={live ? "Say something…" : "Connecting…"}
                aria-label="Message"
                className="pixel-frame min-w-0 flex-1 basis-48 bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)] outline-none disabled:opacity-50"
              />
              <button type="submit" className="pixel-button" disabled={!live || !draft.trim()}>
                Send
              </button>
              <button type="button" className="pixel-button" onClick={() => setShowLog((s) => !s)}>
                Log
              </button>
              <button type="button" className="pixel-button" onClick={chat.hangUp} disabled={!live}>
                Hang up
              </button>
            </form>
          )
        ) : (
          <Choices active={typed} choices={menu} />
        )}
      </Frame>
    </>
  );
}
