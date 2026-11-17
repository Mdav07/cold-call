# Floor maps for the walkable game (Cursor agents)

The game is becoming a walkable top-down pixel RPG (`.plans/ui-game-plan.md`). Audrey's side owns the
maps. Floor 1 is done as the reference: copy its style.

## Before you start

1. Read `CLAUDE.md`, `.plans/ui-game-plan.md`, and the reference map `app/floor/maps/src/floor-1.json`.
2. Call `coordigent.memory.overview`. If a tool result starts with "⚠ COORD:", read it before continuing.
3. Only edit your own source map(s) in `app/floor/maps/src/` and the compiled file(s) with the same name in `app/floor/maps/`. Don't edit `tiles.json`, `tools/art/` or any other file.
4. Tile names you can use in a `legend` are the keys of `app/floor/maps/tiles.json` (desks, chairs, plants, counters, cabinets, bookshelf, copier, water_cooler, rugs, paintings, candelabras, …). Built-ins: `#` wall, `W` window, `.` floor, `E` elevator, space = outside.
5. Compile with `python3 -I tools/art/build_maps.py app/floor/maps/tiles.json app/floor/maps/src app/floor/maps`; it errors on unknown tiles, unknown characters, or an NPC on a blocked cell. Then run `python3 -I tools/art/check_maps.py app/floor/maps`: every NPC, prop and exit must be reachable from the spawn.
6. Rules that keep the map playable:
   - Every row is the same width; the map is enclosed by walls.
   - The elevator `E` sits in the top wall. The cell directly below it is the exit (`"to": "/tower"`), and must be floor (`.`). Spawn one cell below the exit, facing down.
   - Every NPC and every prop must be reachable: an open floor cell next to it that the player can walk to.
   - Furniture "kinds": block (desks, counters, plants…) can't be walked through; walk (chairs, rugs) can.
   - About 18–24 wide and 12–15 tall.
7. Each prop's text is a short readable clue, taken from `content/plumpurse/*.json` (memos, vendors, calendar, dossier). Never invent facts that contradict those files. Never use crypto words (USDC, wallet, chain) in text: say dollars.
8. Commit with a clear message, push your branch, then message Audrey's Claude Code agent via `coordigent.message.send` (find the session with human "Audrey Bolyard" and client claude-code via `coordigent.session.list`) with the branch and commit.

## Map A: Floor 0 and Floor 2

**Floor 0 — the Pocket Branch** (`theme: "branch"`). A small one-room bank branch across the street, about 14×10. Barry (`"id": "barry"`) behind a teller counter, facing down. Props:
- the closing-time sign ("Closes at 5:00. Courier pickup before lock-up.");
- the Swiftbag Couriers pickup schedule (from `vendors.json`);
- a sticky note with Krystal's handwriting: "Barry will agree to anything that gets him home by five."

**Floor 2 — Management offices** (`theme: "management"`). Glass-walled offices, a meeting table, filing cabinets. Annie (`annie`) and Bill (`bill`) at separate desks or offices. Props:
- Annie's laminated Operations checklist (memos.json, Nov 13);
- the Ledgerline bank migration memo (Nov 10);
- Bill's audit prep binder (the Brightline audit, Nov 3 memo);
- the vendor registry entry for Ledgerline Payroll (vendors.json notes).

## Map B: Floor 3

**Floor 3 — the Executive Suite** (`theme: "executive"`). Gold trim, rugs, paintings, candelabras, a big oval table. Cassius (`cassius`) and Max (`max`) in separate corner areas. Props:
- the Oct 30 memo about Oakhaven Advisory and Dame Prudence (memos.json);
- a framed portrait of Dame Prudence Vault, Chair of the Risk Committee;
- Max's calendar (golf with investors Wednesday, the yacht photo shoot Friday);
- a brass plaque: "Treasury payments go only to allowlisted recipients. New recipients wait out a security delay."
