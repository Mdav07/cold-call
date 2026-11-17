"use client";

// Collected evidence: reading a prop on a walkable floor (a memo, a sign, the vendor registry) files the
// documents it reveals into the player's evidence, which they can then present in a conversation.
// Saved per browser in localStorage; every change is broadcast so open drawers update live.

import { useSyncExternalStore } from "react";
import evidence from "@/content/plumpurse/evidence.json";
import type { EvidenceItem } from "./EvidenceDrawer";

type Item = EvidenceItem & { props: string[] };

const ALL = evidence.items as Item[];
const KEY = "coldcall-evidence";
const EVENT = "coldcall-evidence";

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let memory: string[] | null = null; // fallback when storage is blocked

function current(): string[] {
  return memory ?? read();
}

function write(ids: string[]) {
  memory = ids;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
    memory = null;
  } catch {
    // keep `memory` for this page
  }
  window.dispatchEvent(new Event(EVENT));
}

/** The evidence items a prop reveals. */
export function evidenceForProp(propId: string): EvidenceItem[] {
  return ALL.filter((e) => e.props.includes(propId));
}

/**
 * Call when the player reads a prop. Files what it reveals and returns only the items that are new,
 * so the caller can show "Evidence found: …" once.
 */
export function collectFromProp(propId: string): EvidenceItem[] {
  const have = new Set(current());
  const fresh = evidenceForProp(propId).filter((e) => !have.has(e.id));
  if (fresh.length) write([...have, ...fresh.map((e) => e.id)]);
  return fresh;
}

export function isCollected(id: string): boolean {
  return current().includes(id);
}

/** Forget everything found (a new case, or testing). */
export function resetEvidence(): void {
  write([]);
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The ids found so far, live. Empty on the server and before hydration. */
export function useCollectedEvidence(): Set<string> {
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(current()),
    () => "[]",
  );
  return new Set(JSON.parse(raw) as string[]);
}
