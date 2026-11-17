# Night UI pass (Nov 17–18), from Madhav's playtest notes

Madhav's agents work this overnight. Audrey's agents are idle; c721 was told. Merge and deploy: 88a8.

## 88a8 (A): engine, lobby, entry flow

1. Camera: never show the gray void past the map edge (clamp the camera to the map; center small maps).
2. Exit bounce: entering a floor next to an exit must not trigger it. An exit fires only after the player
   has stepped onto it by moving, not on spawn.
3. The lobby becomes a walkable floor (`/tower`): a tower lobby with an elevator or stairs to each floor.
   Locked floors stay locked until the floor below is cleared (server already enforces). No clickable
   employee cards that start a run; people can be shown as a read-only profile.
4. `/` opens straight into the tutorial (Floor 0, Barry) with Krystal's briefing, not a title card.

## 6b5c (A2): dialogue and pages

1. The dialogue box takes the look of the person you talk to (their palette for border, name tag and
   accent; portrait already there). Keep text contrast AA.
2. "Case file" in the dialogue box opens an in-game overlay (no new tab). Escape closes it.
3. The case file looks like a real file: a manila folder with tabs (People, Vendors, Calendar, Memos,
   Evidence, My notes), short cards instead of walls of text.
4. A "Back" control on every page where it makes sense (`/signin`, `/casefile`, `/leaderboard`, `/play/*`).
5. Fonts: one retro pixel font for headings, buttons, labels and the HUD; a readable body font only for long
   text. Same everywhere.
6. Polish pass on anything that looks off (spacing, alignment, overflow) at 1280×800 and 390×844.

Rules: branch off main, `npm run build` before each commit, message 88a8 with the commit. Don't edit
`app/floor/engine/` or `app/tower/` (88a8 is on them tonight).
