"use client";

import { useClearedHere } from "@/app/floor/guestProgress";
import { LockedFloor } from "@/app/floor/[floor]/LockedFloor";

export const LOCKED_TITLE = "Today's case is locked";
export const LOCKED_BODY = "Clear the tutorial at the Pocket Branch first. Then a new case opens here every day.";

/** The daily gate for guests: this browser must have cleared the tutorial (cc-cleared-floor-0). */
export function DailyGuestGate() {
  const cleared = useClearedHere();
  if (cleared[0]) return null;
  return <LockedFloor floor={4} below="the Pocket Branch" title={LOCKED_TITLE} body={LOCKED_BODY} />;
}
