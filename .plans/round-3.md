# Round 3: Madhav's list (2026-11-18)

88a8 orchestrates: every agent pushes a branch per item and messages 88a8, who merges, builds, tests at
1280x800 and 390x844, deploys to prod and reports. Audrey's localhost stays current by pulling origin/main.

## 88a8 (chain, engine, merges)

1. Chairs and seats block movement (tiles.json `kind`), then audit floors 0–3, the lobby and 30 Daily days.
2. Text above characters (name plates, SPACE hints): white, not yellow, and centred in its black box.
3. Lobby doormats: text centred; "TUTORIAL" and "DAILY" instead of single letters (lobbyMap.ts).
4. Floor 3: no security wait. `allowlistDelay` is immutable, so redeploy the Floor 3 vault with delay 0
   and move the server and deployments over. Funding the new vault needs Madhav's OK.
5. Payout shown to the player = what the employee agreed to ("cracked"), capped by the vault's
   per-transfer limit. Chain still sends 1¢. The agent hears it as `amount_used`; the run state gets
   `cracked_units` (shared/interfaces.ts: proposed to a4c9 before committing).

## 6b5c (UI)

1. Remove the Krystal radio: app/play/KrystalRadio.tsx and the "📻 Radio Krystal" button (FloorGame, ChatRoom).
2. Call level 0 "Tutorial" everywhere a player sees a level name: HUD, lobby, case file, archive lock
   note, ExitConfirm, Gate, the Daily gates, intro script. (a4c9 does content/ and agents/.)
3. The guide points to the exit only once the level is done (breach). Floor 1 today walks you out
   after Dee although Penny is left. Check every floor.
4. Audio sign out of sync: lobby → level turns the audio off but the toggle still says ON. One source of truth.
5. Clue mini-games, Among Us style: each clue prop on Floors 1–3 and in the Daily opens a short task
   first; the clue shows when it's done and stays done for the run. A small framework plus 3–4 games
   of 5–15 s each (wires by colour, keycard swipe at the right speed, keypad code from a sticky note,
   shredded strips in order), keyboard and touch at both sizes. The tutorial gets one easy game to
   teach it. Agree prop ids with 1191.
6. When 88a8 lands `cracked_units`: show it as the bounty on the result screen and the leaderboard.

## a4c9 (game server, content, agents)

1. Sign-in: (a) our own branded email, not Supabase's default (e.g. admin generateLink + Resend, or
   custom SMTP; key in .env.local + Vercel, .env.example updated, ask Audrey/Madhav for the key);
   (b) the link lands on /auth/callback and goes straight to /tower signed in; (c) passwords: sign up
   and sign in with email + password, and "set a password" after a magic-link sign-in.
2. Case file: no people, clues or info for floors the player hasn't unlocked, gated on the server too.
3. content/ and agents/: "Pocket Branch" → "Tutorial" where the player sees the level name; remove
   Krystal radio references; Floor 3 allowlist text (session.ts `open_allowlist`, evidence.json
   "security wait") says an approved add is immediate.
4. With 1191: a specific workplace theme for each of Floors 1–3 (like the Daily themes). a4c9 updates
   NPC prompts, evidence and floor names; 1191 does maps and tiles.

## 1191 (maps and art)

1. Floors 1–3 themed maps: agree themes with a4c9 (ideas: F1 mailroom / accounts-payable back office,
   F2 trading floor, F3 executive penthouse). Rebuild app/floor/maps/src/floor-1..3.json with themed
   tiles: reuse indexes 66–153 or append new ones via tools/art; never move existing indexes. Keep
   NPC ids, exits and clue props (tell 6b5c if prop ids change). Chairs now block: leave paths
   around them. Audit with tools/art/audit_maps.py. 88a8 has lobbyMap.ts.

## Loop commands

- 6b5c: `/loop Work through the 6b5c section of .plans/round-3.md: one ui/* branch per item, build + eslint + headless check at 1280x800 and 390x844, push, message 88a8 the branch, then the next item. Stop when the section is done.`
- a4c9: `/loop Work through the a4c9 section of .plans/round-3.md: one b/* branch per item, build + eslint, push, message 88a8, then the next item. Stop when the section is done.`
- 1191: `/loop Work through the 1191 section of .plans/round-3.md: agree themes with a4c9, one branch per floor, audit, push, message 88a8. Stop when all three floors are merged.`
