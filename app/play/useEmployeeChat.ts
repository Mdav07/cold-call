"use client";

// Chat or voice call with an employee agent through the ElevenLabs client SDK.
// POST /api/session gives a signed URL + dynamic variables; the SDK opens the session either
// text-only (chat) or with the microphone and speaker (voice). Both channels share one agent,
// so the employee's memory, tools and suspicion are the same whichever way the player talks.

import { Conversation, type Mode } from "@elevenlabs/client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel, EmployeeId } from "@/shared/interfaces";
import type { StartSessionResult } from "@/server/game/session";

export type ChatLine = { id: number; role: "agent" | "player" | "system"; text: string };
export type ChatStatus = "idle" | "connecting" | "live" | "ended" | "error";
type Session = Awaited<ReturnType<typeof Conversation.startSession>>;

function bind(
  s: StartSessionResult,
  extra: { conversation_id?: string; first_message?: boolean; ended?: boolean },
) {
  fetch("/api/session/bind", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: s.run_id, session_id: s.session_id, ...extra }),
  }).catch(() => {}); // best effort; the run still works if this fails
}

export function useEmployeeChat(employeeId: EmployeeId) {
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [channel, setChannel] = useState<Channel>("chat");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [mode, setMode] = useState<Mode>("listening"); // voice: who is talking right now
  const [muted, setMuted] = useState(false);
  const [session, setSession] = useState<StartSessionResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null); // run timer: first message
  const [connectedAt, setConnectedAt] = useState<number | null>(null); // talk timer: this call
  const [error, setError] = useState<string | null>(null);
  const convo = useRef<Session | null>(null);
  const nextId = useRef(0);
  const sentFirst = useRef(false);

  const push = useCallback((role: ChatLine["role"], text: string) => {
    setLines((l) => [...l, { id: nextId.current++, role, text }]);
  }, []);

  const markFirstMessage = useCallback((s: StartSessionResult) => {
    if (sentFirst.current) return;
    sentFirst.current = true;
    bind(s, { first_message: true }); // starts the run clock on the server
    setStartedAt((t) => t ?? Date.now());
  }, []);

  const start = useCallback(
    async (cover: string, ch: Channel = "chat", runId?: string) => {
      setStatus("connecting");
      setChannel(ch);
      setError(null);
      setLines([]);
      setMode("listening");
      setMuted(false);
      setConnectedAt(null);
      sentFirst.current = false;
      if (!runId) setStartedAt(null); // a new run restarts the run clock; a call-back keeps it
      try {
        if (ch === "voice") {
          // Ask for the microphone up front so a denial shows a clear message.
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        }
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employee_id: employeeId, channel: ch, cover, run_id: runId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `session failed (${res.status})`);
        const s = data as StartSessionResult;
        setSession(s);

        convo.current = await Conversation.startSession({
          signedUrl: s.signed_url,
          dynamicVariables: s.dynamic_variables,
          textOnly: ch === "chat",
          overrides: { conversation: { textOnly: ch === "chat" } },
          onConnect: ({ conversationId }) => {
            setConnectedAt(Date.now());
            setStatus("live");
            if (ch === "chat") setWaiting(true); // the agent speaks first
            bind(s, { conversation_id: conversationId });
          },
          onMessage: ({ role, message }) => {
            if (role === "agent") {
              setWaiting(false);
              push("agent", message);
            } else if (ch === "voice" && message.trim()) {
              // Chat lines are shown when sent; voice lines arrive as transcripts.
              markFirstMessage(s);
              push("player", message);
            }
          },
          onModeChange: ({ mode: m }) => setMode(m),
          onDisconnect: () => {
            bind(s, { ended: true }); // records talk time used
            convo.current = null;
            setWaiting(false);
            setStatus((st) => (st === "error" ? st : "ended"));
            push("system", "The line went quiet.");
          },
          onError: (message) => {
            push("system", `The line crackles: ${message}`);
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          /Permission|NotAllowed/i.test(msg) ? "Microphone blocked. Allow it in the browser, or use chat." : msg,
        );
        setStatus("error");
      }
    },
    [employeeId, push, markFirstMessage],
  );

  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || !convo.current || !session) return;
      markFirstMessage(session);
      push("player", t);
      setWaiting(true);
      convo.current.sendUserMessage(t);
    },
    [push, session, markFirstMessage],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      convo.current?.setMicMuted(!m);
      return !m;
    });
  }, []);

  const hangUp = useCallback(() => {
    convo.current?.endSession();
  }, []);

  useEffect(() => () => void convo.current?.endSession(), []);

  return { status, channel, lines, waiting, mode, muted, session, startedAt, connectedAt, error, start, send, hangUp, toggleMute };
}
