"use client";

import { useSyncExternalStore } from "react";
import { useClearedHere } from "@/app/floor/guestProgress";

const noop = () => () => {};
import { LockedFloor } from "@/app/floor/[floor]/LockedFloor";

export const LOCKED_TITLE = "Today's case is locked";
export const LOCKED_BODY = "Clear the Tutorial first. Then a new case opens here every day.";

/** The daily gate for guests: this browser must have cleared the tutorial (cc-cleared-floor-0). */
export function DailyGuestGate() {
  const cleared = useClearedHere();
  // This browser's clears are only known after hydration: show nothing until then, so a guest who has
  // cleared the Tutorial doesn't see the locked screen flash first.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (!hydrated || cleared[0]) return null;
  return <LockedFloor floor={4} below="the Tutorial" title={LOCKED_TITLE} body={LOCKED_BODY} />;
}
