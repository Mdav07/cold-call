# Polish tasks for Audrey's Cursor agents

Two independent jobs, each on its own branch off `origin/b/polish`.

## Before you start (both jobs)

1. Read `CLAUDE.md` and `AGENTS.md`. This is Next.js 16 with breaking changes: check `node_modules/next/dist/docs/` before writing code.
2. Call `coordigent.memory.overview`. If a tool result starts with "⚠ COORD:", read it before continuing.
3. Only edit the files named in your job. Madhav's agents own `app/floor/**` (engine, dialogue, HUD, floor page) and `server/chain/**`; don't touch them.
4. `.env.local` has `ELEVENLABS_API_KEY`. Never print, commit or log it.
5. Run `npm run build` and `npx tsc --noEmit -p .` before every commit. Small commits, then push your branch.
6. When done, message Audrey's Claude Code agent (`coordigent.message.send`; find the session with human "Audrey Bolyard" and client claude-code via `coordigent.session.list`) with the branch and commit. For Job A, also message Madhav's dialogue agent (human "Mdav07", short id 6b5c) that `app/play/MusicToggle.tsx` is ready to mount on `/floor/[floor]`.

Pixel styles: `app/play/play.css` (`pixel-frame`, `pixel-button`, `font-pixel`, `--cc-*` colors, `cc-floor-1` wrapper).

## Job A: Music, then Krystal's radio (branch `b/music`)

**A1. Music (ElevenLabs Music).** Add music clips to `agents/generate-audio.ts`: a new clip kind `"music"`.
- API, verified working: `POST https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128`, header `xi-api-key`, JSON body `{ "prompt": "...", "music_length_ms": 30000 }`. It returns `audio/mpeg`.
- Generate 30-second instrumental loops, no vocals, original:
  - `music-title.mp3`: mysterious heist, chiptune noir;
  - `music-floor-0.mp3`: sleepy closing-time lounge;
  - `music-floor-1.mp3`: drab, quirky office;
  - `music-floor-2.mp3`: tidy, corporate and tense;
  - `music-floor-3.mp3`: gilded executive suite, suspense.
- Run `npx tsx --env-file=.env.local agents/generate-audio.ts`. It only generates missing files.
- Create `app/play/MusicToggle.tsx`, a client component: `<MusicToggle track="music-floor-1.mp3" />`.
  - A small fixed button in the top-right corner (♪ on/off). It never autoplays: browsers block it, and it's polite. Playback starts only on the first click.
  - The track loops at a low volume (0.25).
  - The on/off choice is remembered in `localStorage` (try/catch). Use an `aria-label` and `aria-pressed`.
- Mount it on the title page (`app/page.tsx`, the title track), the tower (`app/tower/page.tsx`, the floor-1 track) and the chat rooms (`app/play/[employee]/page.tsx` or `ChatRoom.tsx`: the employee's floor track via `card.floor`).
- Add "Music" to the ElevenLabs table in `README.md`.

**A2. Krystal's radio (hint line), if time allows.**
- A Krystal agent: `agents/krystal.md`, a rule sheet in the same format as the others, with a first message. She gives one short, vague, in-character hint at a time, drawn from her dossier notes (`content/plumpurse/dossier.json` and `krystal.json`), never the full answer, at most 2 sentences.
- In `agents/sync.ts`: add `krystal` to `EMPLOYEE_TOOLS` with only `["end_conversation"]`, and her voice `EXAVITQu4vr4xnSDxMaL` to `VOICES`. Run `npx tsx --env-file=.env.local agents/sync.ts krystal`.
- She isn't an employee, so `server/game/session.ts` rejects her. Add a separate route `app/api/radio/route.ts`: it returns a signed URL for her agent id (from `agents/elevenlabs-ids.json`) plus dynamic variables (`floor` and placeholders), and records a hint on the run: `runs.hints_used + 1` when a `run_id` is given. Each hint adds +30 s to the run in the UI copy (the server-side penalty is out of scope).
- A "📻 Krystal's radio" button in `ChatRoom.tsx` (above the cover form and during a run) that opens a small text-only chat panel with her through the same `@elevenlabs/client` `Conversation.startSession` pattern as `app/play/useEmployeeChat.ts`.

## Job B: Evidence drawer, then Devpost checks (branch `b/evidence`)

**B1. Evidence drawer** (the Ace Attorney mechanic from the design doc).
- `content/plumpurse/evidence.json`: 3–4 evidence items per floor, each `{ id, floor, label, text }`. Build them only from facts in the case file, for example:
  - "Invoice QF-2207 from Quillfeather Supplies, printer paper, 4 dollars";
  - "Hal's out-of-office memo: Byteforce fixes can be paid from petty cash";
  - "Ledgerline bank migration memo, Nov 10";
  - "Annie already started request #N" (use generic wording);
  - "Oakhaven Advisory introduced by Dame Prudence Vault, Oct 30".
- `app/play/EvidenceDrawer.tsx`: a client component that opens a pixel panel listing the floor's items. Choosing one calls `onPresent(text)`. Keyboard accessible: focus trap, Escape closes.
- In `app/play/ChatRoom.tsx`: replace the disabled Evidence button with one that opens the drawer and sends `[EVIDENCE: <label>: <text>]` through `chat.send(...)` (chat mode only; in voice mode, say "switch to chat to present evidence").
- Add one line to `agents/shared-rules.md`: when a message starts with `[EVIDENCE: …]`, treat it as a document the caller is showing you; check it against your tools and the case file, then react (consistent evidence lowers suspicion, contradictions raise it). Then re-sync every employee: `for e in barry penny dee annie bill cassius max; do npx tsx --env-file=.env.local agents/sync.ts $e; done`.
- Export `EvidenceDrawer` so Madhav's dialogue agent can reuse it, and mention it in your message.

**B2. Devpost checks.**
- `docs/devpost.md` has lines marked `[check]`. Fill each one from the official guide text: `/private/tmp/claude-501/-Users-audreybolyard-Documents-dev-repositories-ubc/c7217a11-6596-4718-8b69-a18f1d51c00a/scratchpad/guide.txt` (a plain-text export of the hackathon guide), then the README and the code.
- Quote requirement wording exactly where it's a requirement. Keep anything you can't verify marked `[check]`, with a one-line note saying why.
