"use client";

// Krystal's radio: a text-only hint line with her own ElevenLabs agent (POST /api/radio), each hint
// adding time to the run. Used inline on the /play chat screens and as a floating button on the floors.

import { Conversation } from "@elevenlabs/client";
import { useEffect, useRef, useState } from "react";

type RadioLine = { id: number; role: "agent" | "player" | "system"; text: string };

/** Text-only hint line with Krystal via POST /api/radio (same Conversation.startSession pattern as useEmployeeChat). */
export function KrystalRadio({
  floor,
  runId,
  variant = "inline",
}: {
  floor: number;
  runId: string | null;
  /** "floating": a small button pinned to the bottom-left of the floors, opening a panel above it. */
  variant?: "inline" | "floating";
}) {
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
    <div
      className={
        variant === "floating"
          ? "pointer-events-auto fixed bottom-3 left-3 z-30 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col items-start gap-2 sm:bottom-4 sm:left-4"
          : "flex flex-col gap-2"
      }
    >
      {!open ? (
        <button type="button" className="pixel-button self-start" onClick={() => void start()}>
          📻 {variant === "floating" ? "Radio Krystal" : "Krystal's radio"}
        </button>
      ) : (
        <div className="pixel-frame flex w-full flex-col gap-2 bg-[var(--cc-panel)] p-3 font-pixel">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-pixel text-[10px] text-[var(--cc-accent)]">📻 Krystal&apos;s radio</p>
            <button type="button" className="text-[10px] underline text-[var(--cc-muted)]" onClick={close}>
              Close
            </button>
          </div>
          <p className="text-[9px] leading-relaxed text-[var(--cc-muted)]">
            Each hint adds +30 s to the run
            {hintsUsed > 0 ? ` · ${hintsUsed} used` : ""}.
          </p>
          <div className="max-h-48 overflow-y-auto text-[11px] leading-loose" aria-live="polite">
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
                <li className="text-[9px] text-[var(--cc-muted)]">Krystal is on the line…</li>
              )}
            </ul>
          </div>
          {status === "connecting" && <p className="text-[9px] text-[var(--cc-muted)]">Tuning in…</p>}
          {error && <p className="text-[9px] leading-relaxed text-[var(--cc-danger)]">{error}</p>}
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
