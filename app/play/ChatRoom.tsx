"use client";

import { useEffect, useRef, useState } from "react";
import type { EmployeeId } from "@/shared/interfaces";
import { useEmployeeChat } from "./useEmployeeChat";

export interface EmployeeCard {
  id: EmployeeId;
  name: string;
  title: string;
  floorName: string;
}

// TODO(supabase): drive this from Realtime on suspicion_events for the run.
const STUB_SUSPICION = 10;

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

function Portrait({ card, suspicion }: { card: EmployeeCard; suspicion: number }) {
  const mood = suspicion >= 60 ? "suspicious" : suspicion <= 5 ? "convinced" : "neutral";
  const initials = card.name.split(" ").map((w) => w[0]).join("");
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="pixel-frame grid h-44 w-44 place-items-center bg-[var(--cc-portrait)]"
        aria-label={`${card.name}, ${mood}`}
      >
        <span className="font-pixel text-4xl text-[var(--cc-ink)]">{initials}</span>
      </div>
      <div className="text-center">
        <p className="font-pixel text-sm text-[var(--cc-ink)]">{card.name}</p>
        <p className="text-sm text-[var(--cc-muted)]">{card.title}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-[var(--cc-muted)]">{mood}</p>
      </div>
    </div>
  );
}

function SuspicionMeter({ value }: { value: number }) {
  const tone = value >= 70 ? "bg-[var(--cc-danger)]" : value >= 40 ? "bg-[var(--cc-warn)]" : "bg-[var(--cc-ok)]";
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-[var(--cc-muted)]">
        <span className="font-pixel">Suspicion</span>
        <span>{value} / 100 · stub</span>
      </div>
      <div className="pixel-frame h-4 w-full bg-[var(--cc-panel-2)]">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ChatRoom({ card }: { card: EmployeeCard }) {
  const chat = useEmployeeChat(card.id);
  const [cover, setCover] = useState("Sam from Quillfeather Supplies, calling about an invoice");
  const [draft, setDraft] = useState("");
  const live = chat.status === "live";
  const now = useNow(live);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Braces matter: newer Chrome returns a Promise from scrollIntoView, and an effect may only
    // return a cleanup function.
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.lines, chat.waiting]);

  const runMs = chat.startedAt ? now - chat.startedAt : 0;
  const talkLeft =
    chat.session?.talk_seconds != null && chat.startedAt
      ? chat.session.talk_seconds * 1000 - runMs
      : null;
  const lastAgent = [...chat.lines].reverse().find((l) => l.role === "agent");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
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
          <Portrait card={card} suspicion={STUB_SUSPICION} />
          <SuspicionMeter value={STUB_SUSPICION} />
          <div className="w-full text-xs text-[var(--cc-muted)]">
            <p className="font-pixel mb-1">Proposal</p>
            <p>None yet. (Live status arrives with the chain events.)</p>
          </div>
          {chat.session?.stub && (
            <p className="w-full text-xs text-[var(--cc-warn)]">Stub mode: nothing is saved yet.</p>
          )}
        </aside>

        <section className="flex min-h-[60vh] flex-col gap-3">
          {chat.status === "idle" || chat.status === "error" ? (
            <form
              className="pixel-frame flex flex-col gap-3 bg-[var(--cc-panel)] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                chat.start(cover);
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
              <button type="submit" className="pixel-button self-start">
                Call {card.name.split(" ")[0]}
              </button>
              {chat.error && <p className="text-sm text-[var(--cc-danger)]">{chat.error}</p>}
            </form>
          ) : (
            <>
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
                  {chat.waiting && (
                    <li className="self-start text-sm text-[var(--cc-muted)]">
                      {card.name.split(" ")[0]} is typing…
                    </li>
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
            </>
          )}
        </section>
      </div>
    </div>
  );
}
