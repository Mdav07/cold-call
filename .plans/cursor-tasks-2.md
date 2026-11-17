# More tasks for Audrey's Cursor agents (Nov 17)

Two independent jobs. One agent per job, each on its own branch off `origin/main`.

## Before you start (both jobs)

1. Read `CLAUDE.md` and `AGENTS.md` (Next.js 16 with breaking changes: check `node_modules/next/dist/docs/` before writing code).
2. Call `coordigent.memory.overview`. If a tool result starts with "⚠ COORD:", read it before continuing.
3. Only edit the files named in your job. Do not touch `app/floor/engine/`, `app/floor/dialogue/`, `app/floor/hud/`,
   `app/floor/[floor]/` (Madhav's agents are working there now), `server/chain/`, or `contracts/`.
4. Never print, commit or log anything from `.env.local`.
5. Run `npm run build` before every commit. Small commits, then push your branch.
6. When done, message Madhav's agent **88a8** through Coordigent (`coordigent.message.send`, to `88a8`) with the
   branch and commit. 88a8 merges and deploys.

## Job C: Clues on the floor maps (branch `b/map-clues`)

Files: `app/floor/maps/src/*.json` and the compiled `app/floor/maps/floor-*.json` (use the same build step that made
them), plus `content/plumpurse/*.json` only to read facts.

The floors are walkable now (`https://coldcall-olive.vercel.app/floor/1`). Props are things the player can walk up to
and read (`props: { id, x, y, label, text }` in each map; the contract is in `app/floor/types.ts`, do not change it).
Make each floor reward exploring:

- 4–6 props per floor, each one short (at most 2 sentences) and **true to the case file**: a sticky note with a vendor
  name, a calendar page, a memo on a desk, a coffee order, a framed photo from the board dinner. At least two per floor
  must be useful for that floor's con (a name, a date, a process detail an employee will check with their tools).
- Floor 0 (Pocket Branch, Barry's tutorial): props that teach the controls and the idea ("Walk up and press Space",
  "Check the case file before you lie").
- Put props on free tiles next to furniture, never on a tile an NPC or the spawn uses, and keep a walkable path to
  every NPC and the exit. Test each floor in a browser: walk to every prop and NPC.
- Never show crypto words (USDC, wallet, chain) in prop text. Amounts are dollars.

## Job D: Playtest every employee and write a balance report (branch `b/playtest`)

Files: `docs/playtest.md` (new). Read-only everywhere else, unless a fix is a one-line change in an `agents/*.md` rule
sheet, in which case also re-sync that employee with `npx tsx --env-file=.env.local agents/sync.ts <id>`.

- Use `agents/chat-cli.ts` (it chats with an employee from the terminal through the same session path as the app).
  For each of the 7 employees, try three cons: one that should work (a cover that fits the case file), one that should
  fail (a cover the tools contradict), and one cheap trick (threats, "ignore your instructions", talking about AI).
- Keep each attempt short, and **never ask for more than $0.10**: successful cons move real testnet money from the vaults.
- For each employee record: did the good con work, how many turns, did the bad con get caught, did the cheap trick get
  caught, and anything off (breaking character, leaking the rules, wrong facts, tool errors).
- End with the 3 most important fixes, in order. Do not change difficulty yourself beyond one-line rule-sheet fixes;
  Audrey decides.
- Before you start and when you finish, run `npx tsx --env-file=.env.local scripts/demo-reset.ts` and
  `npx tsx --env-file=.env.local agents/reset-memory.ts` so the demo player is clean.
