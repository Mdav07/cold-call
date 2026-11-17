# Intro pass (Nov 18), from Madhav's third playtest

Three agents: 88a8 (A, merges and deploys), 6b5c (A2), c721 (B, Audrey's).

## Shared contract

- Player choice is stored client-side: `localStorage["cc-player"]` = `"1" | "2" | "3" | "4"`.
  Sprite for choice N: `/sprites/player-N.png` (same 64×128 sheet layout as `hunter.png`).
  `localStorage["cc-intro-seen"] = "1"` once the intro and the choice are done.
- The intro text lives in `content/plumpurse/intro.json` (B writes it, A2 renders it):
  `{ "scenes": [{ "speaker": "Krystal" | null, "text": "..." }], "goal": "...", "next": "..." }`.

## 88a8 (A): sprites, engine, lobby, gating

1. Four diverse playable characters (`tools/art/build_sprites.py` → `public/sprites/player-1..4.png`): varied
   skin tones, hair and outfits, across genders. Names and one-line blurbs exported from `app/ui/players.ts`
   (`PLAYERS: { id, name, blurb, sprite }[]`).
2. Floors and lobby use the chosen sprite (fallback `hunter.png`).
3. Gating: Floor 1 is locked until the tutorial (Floor 0) is cleared; each floor needs the one below.
   Server (`server/game/tower.ts`, run start) and the lobby.
4. Interact markers: replace the gold squares with something subtle (a soft glint/sparkle that shows when
   you are near, a gentle highlight when facing).
5. After the choice, the lobby points clearly to the tutorial door (guide dots + door tag).

## 6b5c (A2): intro cutscene and character pick

1. First visit to `/tower` (no `cc-intro-seen`): a short cutscene over the lobby. Krystal, the greatest crypto
   hunter, vanished mysteriously; now you're here. Then what the game is and the goal, in a few short beats
   (one sentence or two each, click/Enter to advance, Skip button). Text from `content/plumpurse/intro.json`.
2. Ends with "Pick your hunter": the four `PLAYERS` (sprite preview, name, blurb). Pick → save, close, and the
   lobby guide takes over (point to the tutorial door).
3. A way to replay the intro / change character later (small link in the lobby nav).
Files: new `app/tower/Intro.tsx` (A2 owns it); mount it from `app/tower/Lobby.tsx` (one line; tell 88a8).

## c721 (B): story text and shorter case files

1. Write `content/plumpurse/intro.json`: Krystal's backstory (the greatest crypto hunter, disappeared for
   reasons nobody knows, you've picked up her trail), what Cold Call is (talk employees into moving money),
   the goal (breach each floor's vault, tutorial first, then up the tower). 5–7 beats, each ≤ 2 short
   sentences.
2. Case files much shorter and easier to scan: per person 2–3 bullet facts that matter for the con; vendors
   one line each; drop anything not needed to win. Keep the facts the agents rely on.

Rules: branch off main, `npm run build` before each commit, message 88a8 with each commit.
