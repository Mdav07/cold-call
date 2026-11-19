"use client";

// Which seasonal cases this browser has cleared (cc-season-cleared-<caseDate>), for the lobby door's
// CLEARED mark. Signed-in players' clears are also on their runs; this is the quick local view.

const key = (caseDate: string) => `cc-season-cleared-${caseDate}`;

export function markSeasonCleared(caseDate: string): void {
  try {
    localStorage.setItem(key(caseDate), "1");
  } catch {}
}

export function seasonClearedHere(caseDate: string): boolean {
  try {
    return localStorage.getItem(key(caseDate)) === "1";
  } catch {
    return false;
  }
}
