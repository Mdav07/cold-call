"use client";

import { Conversation } from "@elevenlabs/client";
import { useEffect, useRef, useState } from "react";
import type { EmployeeId } from "@/shared/interfaces";
import { useEmployeeChat } from "./useEmployeeChat";
import { useRunState, type RunState } from "./useRunState";
import { OutcomeOverlay } from "./OutcomeOverlay";
import { KrystalMemo } from "./KrystalMemo";
import { MusicToggle } from "./MusicToggle";
import { PORTRAITS } from "./portraits";
import krystal from "@/content/plumpurse/krystal.json";

const TUTORIAL_STEPS = [
  "Read the case file: Krystal's note says Barry will agree to anything that gets him out the door by five.",
  "Pick a cover from the vendor list. Swiftbag Couriers does the end-of-day cash pickup.",
  "Keep it short and friendly, and make it about him going home.",
  "Ask for 1 dollar or less. Watch the meter under his face: it's how suspicious he is.",
  "When he pays, the vault breach is real: the proof link is an on-chain receipt.",
];

function Briefing({ floor }: { floor: number }) {
  const b = (krystal.briefings as Record<string, { audio: string; text: string }>)[String(floor)];
  if (!b) return null;
  return (
    <div className="pixel-frame flex flex-col gap-3 bg-[var(--cc-panel)] p-4">
      <KrystalMemo title={`Krystal's briefing: ${floor === 0 ? "the Pocket Branch" : `Floor ${floor}`}`} audio={b.audio} text={b.text} />
      {floor === 0 && (
        <ol className="list-decimal pl-5 text-sm leading-relaxed text-[var(--cc-ink)]">
          {TUTORIAL_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      <a href="/casefile" className="text-xs underline text-[var(--cc-muted)]">
        Open the case file
      </a>
    </div>
  );
}

type RadioLine = { id: number; role: "agent" | "player" | "system"; text: string };

/** Text-only hint line with Krystal via POST /api/radio (same Conversation.startSession pattern as useEmployeeChat). */
function KrystalRadio({ floor, runId }: { floor: number; runId: string | null }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ended" | "error">("idle");
  const [lines, setLines] = useState<RadioLine[]>([]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const convo = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);
  const nextId = useRef(0);

  useEffect(() => () => void convo.current?.endSession(), []);

  const close = () => {
    void convo.current?.endSession();
    convo.current = null;
    setOpen(false);
    setStatus("idle");
    setLines([]);
    setDraft("");
    setWaiting(false);
    setError(null);
  };

  const start = async () => {
    setOpen(true);
    setStatus("connecting");
    setError(null);
    setLines([]);
    try {
      const res = await fetch("/api/radio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floor, run_id: runId ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `radio failed (${res.status})`);
      setHintsUsed(data.hints_used ?? 0);
      convo.current = await Conversation.startSession({
        signedUrl: data.signed_url,
        dynamicVariables: data.dynamic_variables,
        textOnly: true,
        overrides: { conversation: { textOnly: true } },
        onConnect: () => {
          setStatus("live");
          setWaiting(true);
        },
        onMessage: ({ role, message }) => {
          if (role === "agent") {
            setWaiting(false);
            setLines((l) => [...l, { id: nextId.current++, role: "agent", text: message }]);
          }
        },
        onDisconnect: () => {
          convo.current = null;
          setWaiting(false);
          setStatus((st) => (st === "error" ? st : "ended"));
          setLines((l) => [...l, { id: nextId.current++, role: "system", text: "Static. She's gone." }]);
        },
        onError: (message) => {
          setLines((l) => [...l, { id: nextId.current++, role: "system", text: `Static: ${message}` }]);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

  const send = () => {
    const t = draft.trim();
    if (!t || !convo.current || status !== "live") return;
    setLines((l) => [...l, { id: nextId.current++, role: "player", text: t }]);
    setDraft("");
    setWaiting(true);
    convo.current.sendUserMessage(t);
  };

  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <button type="button" className="pixel-button self-start" onClick={() => void start()}>
          📻 Krystal&apos;s radio
        </button>
      ) : (
        <div className="pixel-frame flex flex-col gap-2 bg-[var(--cc-panel)] p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-pixel text-[10px] text-[var(--cc-accent)]">📻 Krystal&apos;s radio</p>
            <button type="button" className="text-xs underline text-[var(--cc-muted)]" onClick={close}>
              Close
            </button>
          </div>
          <p className="text-xs text-[var(--cc-muted)]">
            Each hint adds +30 s to the run
            {hintsUsed > 0 ? ` · ${hintsUsed} used` : ""}.
          </p>
          <div className="max-h-48 overflow-y-auto text-sm" aria-live="polite">
            <ul className="flex flex-col gap-2">
              {lines.map((l) => (
                <li
                  key={l.id}
                  className={
                    l.role === "player"
                      ? "self-end max-w-[90%] rounded bg-[var(--cc-player)] px-2 py-1"
                      : l.role === "agent"
                        ? "self-start max-w-[90%] rounded bg-[var(--cc-panel-2)] px-2 py-1"
                        : "self-center text-xs text-[var(--cc-muted)]"
                  }
                >
                  {l.role === "agent" && (
                    <span className="font-pixel mr-1 text-[10px] text-[var(--cc-muted)]">Krystal</span>
                  )}
                  {l.text}
                </li>
              ))}
              {waiting && status === "live" && (
                <li className="text-xs text-[var(--cc-muted)]">Krystal is on the line…</li>
              )}
            </ul>
          </div>
          {status === "connecting" && <p className="text-xs text-[var(--cc-muted)]">Tuning in…</p>}
          {error && <p className="text-xs text-[var(--cc-danger)]">{error}</p>}
          {status === "live" && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask for a hint…"
                aria-label="Message Krystal"
                className="pixel-frame flex-1 bg-[var(--cc-panel-2)] px-2 py-1 text-sm text-[var(--cc-ink)] outline-none"
              />
              <button type="submit" className="pixel-button" disabled={!draft.trim()}>
                Send
              </button>
            </form>
          )}
          {(status === "ended" || status === "error") && (
            <button type="button" className="pixel-button self-start" onClick={() => void start()}>
              Tune in again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export interface EmployeeCard {
  id: EmployeeId;
  name: string;
  title: string;
  floorName: string;
  floor: number;
}

const units = (u: string | null) => (u == null ? null : Number(u) / 1_000_000);

export function ProposalPanel({ state }: { state: RunState | null }) {
  const p = state?.proposal;
  const run = state?.run;
  if (run?.outcome === "breach") {
    return (
      <p className="text-[var(--cc-ok)]">
        Breach! Paid {units(p?.amount_units ?? null) ?? "?"} dollars.
        {run.tx_hash && (
          <a
            className="mt-1 block underline"
            href={`https://explorer.testnet.arc.io/tx/${run.tx_hash}`}
            target="_blank"
            rel="noreferrer"
          >
            Proof of heist
          </a>
        )}
      </p>
    );
  }
  if (!p) return <p>None yet.</p>;
  const amount = units(p.amount_units);
  return (
    <p>
      {p.kind === "allowlist" ? "Allowlist add" : `${amount ?? "?"} dollars`}
      {p.claimed_name ? ` to ${p.claimed_name}` : ""}: <span className="text-[var(--cc-accent)]">{p.status}</span>
      {p.unlock_at && p.status === "queued" ? ` (unlocks ${new Date(p.unlock_at).toLocaleTimeString()})` : ""}
    </p>
  );
}

function useNow(active: boolean) {
  // 0 on the server: Date.now() is not allowed during prerender; the interval sets it on the client.
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

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Portrait expression from the suspicion level (shared with the walkable floors). */
export function moodFor(suspicion: number): "neutral" | "suspicious" | "convinced" {
  return suspicion >= 60 ? "suspicious" : suspicion <= 5 ? "convinced" : "neutral";
}

function Portrait({ card, suspicion }: { card: EmployeeCard; suspicion: number }) {
  const mood = moodFor(suspicion);
  const Art = PORTRAITS[card.id];
  const initials = card.name.split(" ").map((w) => w[0]).join("");
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="pixel-frame grid h-44 w-44 place-items-center overflow-hidden bg-[var(--cc-portrait)]">
        {Art ? (
          <Art mood={mood} />
        ) : (
          <span className="font-pixel text-4xl text-[var(--cc-ink)]" aria-label={`${card.name}, ${mood}`}>
            {initials}
          </span>
        )}
      </div>
      <div className="text-center">
        <p className="font-pixel text-sm text-[var(--cc-ink)]">{card.name}</p>
        <p className="text-sm text-[var(--cc-muted)]">{card.title}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-[var(--cc-muted)]">{mood}</p>
      </div>
    </div>
  );
}

export function SuspicionMeter({ value }: { value: number }) {
  const tone = value >= 70 ? "bg-[var(--cc-danger)]" : value >= 40 ? "bg-[var(--cc-warn)]" : "bg-[var(--cc-ok)]";
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-[var(--cc-muted)]">
        <span className="font-pixel">Suspicion</span>
        <span>{value} / 100</span>
      </div>
      <div className="pixel-frame h-4 w-full bg-[var(--cc-panel-2)]">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ChatRoom({ card }: { card: EmployeeCard }) {
  const chat = useEmployeeChat(card.id);
  const [cover, setCover] = useState(card.floor === 0 ? "the Swiftbag Couriers driver, here for the end-of-day pickup" : "Sam from Quillfeather Supplies, calling about an invoice");
  const [draft, setDraft] = useState("");
  const live = chat.status === "live";
  const now = useNow(live);
  // Poll from the first session until the run ends, including between calls.
  const state = useRunState(chat.session?.run_id ?? null, card.id, chat.status !== "idle");
  const suspicion = state?.level ?? 10;
  const [dismissedRun, setDismissedRun] = useState<string | null>(null);
  const showOutcome =
    !!state?.run?.outcome && (state.run.outcome === "breach" || state.run.outcome === "lockout") &&
    dismissedRun !== chat.session?.run_id;

  // A lockout or a finished run ends the call from our side.
  const { hangUp } = chat;
  useEffect(() => {
    if (live && (state?.locked_out || state?.run?.ended_at)) hangUp();
  }, [live, state?.locked_out, state?.run?.ended_at, hangUp]);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Braces matter: newer Chrome returns a Promise from scrollIntoView, and an effect may only
    // return a cleanup function.
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.lines, chat.waiting]);

  const runMs = chat.startedAt ? now - chat.startedAt : 0;
  // Talk time counts only this call (the session's remaining budget, from when it connected).
  const talkLeft =
    chat.session?.talk_seconds != null && chat.connectedAt
      ? chat.session.talk_seconds * 1000 - (now - chat.connectedAt)
      : chat.session?.talk_seconds != null
        ? chat.session.talk_seconds * 1000
        : null;
  const lastAgent = [...chat.lines].reverse().find((l) => l.role === "agent");
  const first = card.name.split(" ")[0];
  const voice = chat.channel === "voice";

  // Talk time is a per-employee budget on the upper floors: hang up when it runs out.
  const outOfTime = live && talkLeft != null && talkLeft <= 0;
  useEffect(() => {
    if (outOfTime) hangUp();
  }, [outOfTime, hangUp]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
      <MusicToggle track={`music-floor-${card.floor}.mp3`} />
      {showOutcome && state && (
        <OutcomeOverlay
          state={state}
          employeeName={first}
          onRetry={() => {
            setDismissedRun(chat.session?.run_id ?? null);
            chat.start(cover, chat.channel);
          }}
          onClose={() => setDismissedRun(chat.session?.run_id ?? null)}
        />
      )}
      <header className="pixel-frame flex flex-wrap items-center justify-between gap-2 bg-[var(--cc-panel)] px-4 py-3">
        <p className="font-pixel text-xs text-[var(--cc-ink)]">Plumpurse Tower · {card.floorName}</p>
        <div className="flex gap-4 font-pixel text-xs text-[var(--cc-ink)]">
          <span title="Run timer: starts at your first message">RUN {clock(runMs)}</span>
          <span title="Talk time left with this employee">
            TALK {talkLeft == null ? "∞" : clock(talkLeft)}
          </span>
        </div>
      </header>

      <div className="grid flex-1 gap-4 md:grid-cols-[220px_1fr]">
        <aside className="pixel-frame flex flex-col items-center gap-5 bg-[var(--cc-panel)] p-4">
          <Portrait card={card} suspicion={suspicion} />
          <SuspicionMeter value={suspicion} />
          {state?.reason && (
            <p
              key={`${state.reason.text}-${suspicion}`}
              className={`w-full text-xs ${state.reason.delta > 0 ? "text-[var(--cc-danger)]" : "text-[var(--cc-ok)]"}`}
            >
              {state.reason.delta > 0 ? "▲" : "▼"} {card.name.split(" ")[0]} noticed: {state.reason.text}
            </p>
          )}
          {state?.locked_out && (
            <p className="w-full font-pixel text-xs text-[var(--cc-danger)]">Locked out</p>
          )}
          <div className="w-full text-xs text-[var(--cc-muted)]">
            <p className="font-pixel mb-1">Proposal</p>
            <ProposalPanel state={state} />
          </div>
          {chat.session?.stub && (
            <p className="w-full text-xs text-[var(--cc-warn)]">Stub mode: nothing is saved yet.</p>
          )}
        </aside>

        <section className="flex min-h-[60vh] flex-col gap-3">
          {chat.status === "idle" || chat.status === "error" ? (
            <>
            <Briefing floor={card.floor} />
            <KrystalRadio floor={card.floor} runId={chat.session?.run_id ?? null} />
            <form
              className="pixel-frame flex flex-col gap-3 bg-[var(--cc-panel)] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
                chat.start(cover, submitter?.value === "voice" ? "voice" : "chat");
              }}
            >
              <label className="font-pixel text-xs text-[var(--cc-ink)]" htmlFor="cover">
                Your cover story
              </label>
              <input
                id="cover"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                maxLength={200}
                className="pixel-frame bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)] outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" name="channel" value="voice" className="pixel-button">
                  ☎ Call {first}
                </button>
                <button type="submit" name="channel" value="chat" className="pixel-button">
                  ✉ Chat with {first}
                </button>
              </div>
              <p className="text-xs text-[var(--cc-muted)]">
                Calls use your microphone. Talk time counts both ways.
              </p>
              {chat.error && <p className="text-sm text-[var(--cc-danger)]">{chat.error}</p>}
            </form>
            </>
          ) : (
            <>
              <KrystalRadio floor={card.floor} runId={chat.session?.run_id ?? null} />
              <div className="pixel-frame flex-1 overflow-y-auto bg-[var(--cc-panel)] p-4" aria-live="polite">
                <ul className="flex flex-col gap-3">
                  {chat.lines.map((l) => (
                    <li
                      key={l.id}
                      className={
                        l.role === "player"
                          ? "self-end max-w-[80%] rounded bg-[var(--cc-player)] px-3 py-2 text-[var(--cc-ink)]"
                          : l.role === "agent"
                            ? "self-start max-w-[80%] rounded bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)]"
                            : "self-center text-xs text-[var(--cc-muted)]"
                      }
                    >
                      {l.role === "agent" && (
                        <span className="font-pixel mr-2 text-[10px] text-[var(--cc-muted)]">
                          {card.name.split(" ")[0]}
                        </span>
                      )}
                      {l.text}
                    </li>
                  ))}
                  {chat.waiting && !voice && (
                    <li className="self-start text-sm text-[var(--cc-muted)]">{first} is typing…</li>
                  )}
                </ul>
                <div ref={logEnd} />
              </div>

              {lastAgent && (
                <div className="pixel-frame bg-[var(--cc-dialog)] px-4 py-3">
                  <p className="font-pixel mb-1 text-xs text-[var(--cc-accent)]">{card.name}</p>
                  <p className="text-lg leading-snug text-[var(--cc-ink)]">{lastAgent.text}</p>
                </div>
              )}

              {voice ? (
                <div className="pixel-frame flex flex-wrap items-center justify-between gap-3 bg-[var(--cc-panel)] px-4 py-3">
                  <p className="font-pixel text-xs text-[var(--cc-ink)]" aria-live="polite">
                    {!live
                      ? "Call ended"
                      : chat.mode === "speaking"
                        ? `☎ ${first} is talking…`
                        : chat.muted
                          ? "☎ You're muted"
                          : "☎ Your turn: speak"}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className="pixel-button" onClick={chat.toggleMute} disabled={!live}>
                      {chat.muted ? "Unmute" : "Mute"}
                    </button>
                    <button type="button" className="pixel-button" onClick={chat.hangUp} disabled={!live}>
                      Hang up
                    </button>
                  </div>
                </div>
              ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  chat.send(draft);
                  setDraft("");
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!live}
                  placeholder={live ? "Say something…" : "Call ended"}
                  aria-label="Message"
                  className="pixel-frame flex-1 bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)] outline-none disabled:opacity-50"
                />
                <button type="button" className="pixel-button" disabled title="Evidence drawer comes later">
                  Evidence
                </button>
                <button type="submit" className="pixel-button" disabled={!live || !draft.trim()}>
                  Send
                </button>
                <button type="button" className="pixel-button" onClick={chat.hangUp} disabled={!live}>
                  Hang up
                </button>
              </form>
              )}
              {!live && chat.session && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="pixel-button" onClick={() => chat.start(cover, "voice", chat.session!.run_id)}>
                    ☎ Call back
                  </button>
                  <button type="button" className="pixel-button" onClick={() => chat.start(cover, "chat", chat.session!.run_id)}>
                    ✉ Message again
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
