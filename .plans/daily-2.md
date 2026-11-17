# Daily Case, round 2 (Madhav's playtest notes)

Notes: a new case each day; enter it from the lobby itself, not only the top bar; the room must be random,
not a copy of the tutorial; the breach result (and the money) only after the agent has finished talking;
the breach screen in Krystal's briefing style with much less text; a daily streak; the last few days in the
top bar, replayable without counting for the streak or the board; lobby position resets after the case
file, and bugs like it.

## Contract

- `POST /api/session` takes optional `daily_date` (YYYY-MM-DD, today or up to 6 days back) with
  `employee_id: "daily"`. Today = a real run. An earlier day = practice: `runs.practice = true`, token payout
  only, never on the board, never counts for the streak.
- `GET /api/session/state` (now accepts `daily`) returns `run.daily_date`, `run.practice`, and for daily runs
  `daily_streak: { current, best }` (after this run, for the player).
- `shared/dailyCase.ts`: `recentDailyDates(n = 7)` → today first; `DAILY_ARCHIVE_DAYS = 7`.

## 88a8

1. Generator: more variety in the pools; check a new case each UTC day (the page renders per request).
2. Lobby: a Daily Case door in the lobby map with its sign, exit → `/daily` (locked until the tutorial).
3. Lobby top bar: DAILY CASE opens a small list: today + the last 6 days → `/daily?date=…`.
4. Server: `daily_date` on session start, `runs.practice`, tools use the run's case date, practice payout =
   token, board and streak exclude practice. `dailyStreak(userId)`.
5. Bugs: state route rejected `daily`; FloorScene resets the player to spawn when a hidden page comes back
   (lobby → case file → back). Sweep for similar ones.

## 6b5c

1. Random room: `app/daily/room.ts` builds the room from the date seed: random size and shape, furniture,
   where the employee and the four clues are; every clue and the employee reachable (BFS); one of the skins.
   Not the Pocket Branch layout.
2. Result timing (every floor): show the breach/lockout screen only after the agent's last reply has
   finished (typed out, and spoken on calls), or the conversation ended. Same for anything showing the payment.
3. Result look: Krystal's briefing style (her portrait, the same panel and pixel font), short: bounty, time,
   one line from Krystal; for the Daily, the streak (`daily_streak`) and "practice, doesn't count" for old
   days. Debrief detail behind a "More" button.
4. `/daily?date=YYYY-MM-DD` plays that day's case (practice for earlier days, with a badge); pass
   `daily_date` to `/api/session`. Bad or too-old dates → today.

Rules as before: build before each commit, message 88a8 with each commit, push to a branch `ui/daily-2`.
