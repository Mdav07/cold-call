# Daily Case (Nov 18), Madhav's request

A new short level every day, the same for everyone (seeded by the UTC date). One character, its own short case
file like the Pocket Branch's, a popup from the lobby once a day, and a "Daily" leaderboard tab with today's
fastest times. Merge and deploy: 88a8. Testnet only; never commit secrets.

## How it fits the game

- The Daily Case is **floor 4** in the run tables (`runs.floor = 4`, `runs.daily_date = the case date`). It is
  separate from Floors 0–3: it never unlocks or locks a floor.
- One employee id, **`daily`**, whose persona changes every day. One ElevenLabs agent ("daily") gets the day's
  persona through dynamic variables.
- Money: the Pocket Branch (tutorial) vault, signed by Barry's key, single signer. Cap 0.10 USDC; after the
  first clear of the day, the usual token payout.
- Open to anyone who has cleared the tutorial (signed in: a Floor 0 breach; guest: `cc-cleared-floor-0`).

## Shared contract (88a8 writes it first; both sides use it)

`shared/dailyCase.ts` (pure TS, no server imports, safe in the browser):

```ts
export interface DailyCase {
  date: string;                 // YYYY-MM-DD (UTC)
  title: string;                // e.g. "The Night Desk"
  place: string;                // one line, e.g. "Plumpurse Harbor Annex, after hours"
  brief: [string, string];      // Krystal's two short briefing screens
  employee: {
    name: string; firstName: string; title: string;
    sprite: string;             // "/sprites/<file>.png"
    personality: string;        // one line, for the agent and the case file
    softSpot: string;           // what lowers their guard (the way in)
    redLine: string;            // what they will never do
  };
  vendors: { name: string; code: string; what: string }[]; // today's registry (3)
  allowedVendor: string;        // the one vendor they can pay today
  clues: { id: string; label: string; text: string }[];    // 4 notes to place as props in the room
  capUsdc: number;              // 0.1
}
export function dailyCase(date?: string): DailyCase;   // default: today (UTC)
export function todayUtc(): string;
```

Templates live in `content/daily/templates.json` (88a8).

## 88a8 (A): generator, agent, runs, gating, vault, leaderboard data

1. `shared/dailyCase.ts` + `content/daily/templates.json`: seeded pools for name, role, place, personality,
   soft spot, red line, vendors and clue texts. The clues must make the case winnable: one reveals the
   allowed vendor and its code, one the soft spot, one the red line, one flavour.
2. `"daily"` in `EmployeeId` (shared/interfaces.ts, additive) and `FloorId` gains 4.
3. Migration: `runs.floor` allows 4, new `runs.daily_date date`.
4. Session: `employee_id: "daily"` starts a floor-4 run (stores `daily_date`), passes the persona as dynamic
   variables (`daily_name`, `daily_title`, `daily_place`, `daily_personality`, `daily_soft_spot`,
   `daily_red_line`, `daily_vendors`, `daily_allowed_vendor`). Gate: tutorial cleared. No player memory.
5. ElevenLabs: `agents/daily.md` (shared rules + the persona variables), synced as the "daily" agent.
6. Tools: `daily` → floor 4 → tutorial vault, Barry's signer, cap 0.10. `check_vendor_list` answers with today's
   vendors.
7. Leaderboard data: `server/game/dailyBoard.ts` → `dailyBoard(date, limit)`:
   `{ name, ms, channel }[]` for today's breaches, fastest first, plus `dailyCleared(userId, date)`.

## 6b5c (A2): everything the player sees

1. Lobby popup (`app/tower/DailyPopup.tsx`, 88a8 mounts it from Lobby.tsx): once per day
   (`cc-daily-seen-<date>`), only after the tutorial is cleared. Shows the title, place, character and
   "Play today's case" → `/daily`, plus "Later".
2. `/daily` (`app/daily/`): the room. Build a small seeded room (`app/daily/room.ts`, `buildDailyRoom(c)` →
   `FloorMap` with `floor: 4`) from the shared tileset, one NPC (`id: "daily"`, the case's sprite), the four
   clues as props, an exit to `/tower`. Reuse `FloorGame` (talk, outcome, elevator) wherever possible.
3. The daily case file: like the Pocket Branch file, built from the `DailyCase` (one person card, today's
   vendors, the clues found).
4. Briefing: Krystal's two screens from `brief`.
5. Dialogue box look for `daily` (portrait: the sprite's face, a neutral palette).
6. Leaderboard "Daily" tab: today's fastest from `dailyBoard`, and the case title.

Rules: branch off main, `npm run build` before each commit, message 88a8 with each commit. Don't edit
`server/`, `agents/`, `shared/` (88a8). 88a8 doesn't edit `app/daily/` or the popup.
