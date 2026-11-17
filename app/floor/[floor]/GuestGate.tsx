"use client";

import { openForGuest, useClearedHere } from "@/app/floor/guestProgress";
import { LockedFloor } from "./LockedFloor";

/** The floor gate for guests: this browser's own clears, not the shared demo player's. */
export function GuestGate({ floor, below }: { floor: number; below: string }) {
  const cleared = useClearedHere();
  if (openForGuest(cleared, floor)) return null;
  return <LockedFloor floor={floor} below={below} />;
}
