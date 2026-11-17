# Day UI pass (Nov 18), from Madhav's second playtest

Madhav's two agents do this. 88a8 also takes the open playtest fixes for Audrey (c721 told). Merge and deploy: 88a8.

## 88a8 (A): engine, lobby, guide, memory

1. Start in the lobby, not the tutorial. `/` → `/tower`. The street door to the Pocket Branch is the only open
   door for a new player, labelled, with a small arrow over it.
2. Guide: a small, unobtrusive trail of dots from the player toward the next goal (tutorial door, the next
   unlocked elevator, the person to talk to on a floor, the elevator out after a clear).
3. Elevator bounce: leaving a floor for the lobby can loop you back into an elevator. Fix it.
4. Walk a little slower.
5. Make things you can read/talk to more obvious (the yellow dot): a visible marker on every prop and person.
6. Playtest fix 1 (Audrey's): memory from the current run must not read as a past trick (Floor 3 callback).

## 6b5c (A2): Krystal's briefing

1. Krystal's briefing: at most two short screens you click through (Next, then Start). Much less text per
   screen, bigger text.
2. One font everywhere in Krystal's UI (some of her text uses a different font). Check the briefing, the
   radio/phone HUD, the outcome screen and the props dialogue.
3. Playtest fix 2 (Audrey's): employees must state the amount actually paid (`amount_used`), not the ask.
   One explicit line in `agents/shared-rules.md` next to `executed`; run `agents/sync.ts` if needed.
4. Playtest fix 3 (Audrey's): give Cassius a clearer cue to call `propose_allowlist_add` once the Dame
   Prudence / Oakhaven story checks out (`agents/cassius.md`).

Rules: branch off main, `npm run build` before each commit, message 88a8 with the commit. Don't edit
`app/floor/engine/`, `app/tower/` or `server/` (88a8 is on them).
