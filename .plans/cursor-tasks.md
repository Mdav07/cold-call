# Tasks for Audrey's Cursor agent

Two independent jobs. Do them one at a time, each on its own branch off `origin/main`.

## Before you start (both jobs)

1. Read `CLAUDE.md` and `AGENTS.md`. This is Next.js 16 with breaking changes: check `node_modules/next/dist/docs/` before writing code.
2. Call `coordigent.memory.overview` (the Coordigent MCP server). If a tool result starts with "⚠ COORD:", read it before continuing.
3. Only edit the folder named in your job. Other agents own the rest of the repo (see the ownership table in `CLAUDE.md`).
4. Run `npm run build` before every commit. Small commits, then push your branch.
5. When done, message Audrey's Claude Code agent through Coordigent (`coordigent.message.send`, to the session whose human is "Audrey Bolyard" and client is claude-code; find it with `coordigent.session.list`) with the branch name and commit.

The game's pixel styles live in `app/play/play.css` and load globally from the root layout: `pixel-frame`, `pixel-button`, `font-pixel` and the `--cc-*` colors, inside a `cc-floor-1` wrapper. Look at `app/tower/page.tsx` for an example page.

## Job 1: Case file screen (branch `b/casefile`)

Build `app/casefile/page.tsx`, plus components under `app/casefile/` only.

- Data comes from `content/plumpurse/*.json`. Import the JSON directly, like `app/tower/page.tsx` does.
- Tabs:
  - **Krystal's notes** (`dossier.json`): the intro, each employee's margin notes, and the gossip list.
  - **Staff** (`directory.json`).
  - **Vendors** (`vendors.json`).
  - **Memos** (`memos.json`), newest first.
  - **Jargon** (`jargon.json`).
  - **My notes**: a textarea saved to `localStorage`, wrapped in try/catch.
- Include a "Back to the tower" link to `/tower`.
- Never show crypto words (USDC, wallet, chain) in the UI. Amounts are dollars.

## Job 2: Pixel portraits (branch `b/portraits`)

Create character portraits as React components in `app/play/portraits/` only. Don't edit `ChatRoom.tsx`; Audrey's agent wires them in.

- One file per character: Penny, Dee, Annie, Bill, Cassius, Max, Barry, Krystal.
- Each is an inline SVG on a 32×32 pixel grid (`shape-rendering="crispEdges"`, `viewBox="0 0 32 32"`), displayed at 176px.
- Three expressions, selected by a `mood` prop: `"neutral" | "suspicious" | "convinced"`.
- Give each character one visual signature (see their rule sheets in `agents/*.md`):
  - Penny: big hair and a cat-shaped pin
  - Dee: hoodie and headphones
  - Annie: clipboard
  - Bill: glasses and a tie
  - Cassius: dark suit, eyes to the side
  - Max: slicked hair and a gold watch
  - Barry: droopy, sleepy eyes
  - Krystal: aviator goggles on her head and a hardware wallet on a lanyard
- Export `PORTRAITS: Record<string, (props: { mood: "neutral" | "suspicious" | "convinced" }) => React.JSX.Element>` from `app/play/portraits/index.tsx`, keyed by employee id (`penny`, `dee`, …, `krystal`).
- Each SVG gets `role="img"` and an `aria-label` like "Penny Pincher, suspicious".
