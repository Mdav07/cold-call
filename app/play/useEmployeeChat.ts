"use client";

// Text chat with an employee agent over the ElevenLabs WebSocket protocol (the same flow as
// agents/chat-cli.ts): POST /api/session for a signed URL and dynamic variables, open the
// socket with a text-only override, then exchange user_message / agent_response events.
// Voice calls will use the ElevenLabs SDK on top of the same /api/session response.

import { useCallback, useEffect, useRef, useState } from "react";
import type { EmployeeId } from "@/shared/interfaces";
import type { StartSessionResult } from "@/server/game/session";

export type ChatLine = { id: number; role: "agent" | "player" | "system"; text: string };
export type ChatStatus = "idle" | "connecting" | "live" | "ended" | "error";

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
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [session, setSession] = useState<StartSessionResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null); // run timer: first message
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const nextId = useRef(0);
  const sentFirst = useRef(false);

  const push = useCallback((role: ChatLine["role"], text: string) => {
    setLines((l) => [...l, { id: nextId.current++, role, text }]);
  }, []);

  const start = useCallback(
    async (cover: string) => {
      setStatus("connecting");
      setError(null);
      sentFirst.current = false;
      setLines([]);
      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employee_id: employeeId, channel: "chat", cover }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `session failed (${res.status})`);
        const s = data as StartSessionResult;
        setSession(s);

        const socket = new WebSocket(s.signed_url);
        ws.current = socket;
        socket.onopen = () => {
          socket.send(
            JSON.stringify({
              type: "conversation_initiation_client_data",
              conversation_config_override: { conversation: { text_only: true } },
              dynamic_variables: s.dynamic_variables,
            }),
          );
          setStatus("live");
          setWaiting(true); // the agent speaks first
        };
        socket.onmessage = (ev) => {
          const msg = JSON.parse(String(ev.data));
          if (msg.type === "agent_response") {
            setWaiting(false);
            push("agent", msg.agent_response_event?.agent_response ?? "");
          } else if (msg.type === "ping") {
            socket.send(JSON.stringify({ type: "pong", event_id: msg.ping_event?.event_id }));
          } else if (msg.type === "conversation_initiation_metadata") {
            const conversation_id = msg.conversation_initiation_metadata_event?.conversation_id;
            if (conversation_id) bind(s, { conversation_id });
          } else if (msg.type === "error") {
            push("system", "The line crackles. Something went wrong.");
          }
        };
        socket.onclose = () => {
          bind(s, { ended: true }); // records talk time used
          setWaiting(false);
          setStatus((st) => (st === "error" ? st : "ended"));
          push("system", "The line went quiet.");
        };
        socket.onerror = () => {
          setError("Connection failed.");
          setStatus("error");
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    },
    [employeeId, push],
  );

  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || ws.current?.readyState !== WebSocket.OPEN) return;
      if (!sentFirst.current && session) {
        sentFirst.current = true;
        bind(session, { first_message: true }); // starts the run clock on the server
      }
      setStartedAt((s) => s ?? Date.now());
      push("player", t);
      setWaiting(true);
      ws.current.send(JSON.stringify({ type: "user_message", text: t }));
    },
    [push, session],
  );

  const hangUp = useCallback(() => ws.current?.close(), []);

  useEffect(() => () => ws.current?.close(), []);

  return { status, lines, waiting, session, startedAt, error, start, send, hangUp };
}
