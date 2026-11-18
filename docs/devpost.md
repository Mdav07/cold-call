# Devpost draft: Cold Call

Draft for Audrey and Madhav to edit. Every claim below is sourced from the code, the README or the
chain spec; anything marked **[check]** needs a human to confirm before submitting.

## Name

Cold Call

## Team

**[check]** Madhav Vinod, Audrey Bolyard (the guide requires all team members on Devpost).

## Tagline

Humans fall for it. Contracts don't.

## Short description (one paragraph)

Cold Call is a social-engineering heist game. You walk the floors of a fictional bank, Plumpurse Savings &
Trust, and talk its AI staff into approving a payment, by phone or by chat. The staff are ElevenLabs voice
agents who check your story against real tools: a vendor registry, calendars and a staff directory. If you
talk them into it, the payment is a real USDC transfer on Arc testnet, and the run only counts when the
vault contract emits the event. Each floor's vault has stricter rules, so the game teaches the real attacks
behind business email compromise and the 2025 Bybit theft, then shows you what the contract caught that
the humans didn't.

## What we built

- **A walkable pixel-art bank.** Four floors you explore top-down; walk up to an employee and a dialogue box
  opens with Talk, Call, Case file and Leave.
- **Seven floor employees plus a daily employee,** each an ElevenLabs agent with their own rule sheet, voice,
  pixel portrait, quirks, suspicion meter and memory of your past tricks, plus Krystal's radio for hints.
  Read signs, memos and notes on the floors: they hold clues, and reading them files evidence into your case
  file that you can present mid-conversation. They check it against their tools.
- **Four on-chain vaults** (`ColdCallVault`, Solidity, 33 Foundry tests), one per floor, each a multi-approval
  vault with stricter rules: a per-transfer cap, two signers from different people, then an allowlist with a
  60-second timelock.
- **A chain referee.** A QuickNode Stream delivers every vault event to our backend; a run is a breach only
  when the Stream delivers `TransferExecuted`. The run clock stops at that block's timestamp.
- **A story to follow:** your vanished mentor Krystal Klear briefs each floor in her own voice, every clear
  uncovers one of her hidden notes, and her radio gives a hint whenever
  you're stuck, for 30 seconds on the clock.
- **A daily game loop:** after the tutorial, the lobby's D door (locked like the elevators until then) opens
  onto the Daily Case: one short case a day, the same for everyone, a random room, one staff member, its own
  case file and clues. Past days replay as practice. Places rotate with no repeat inside a 44-day cycle. A
  daily streak shows as a flame badge; three days unlocks the Teal jacket hunter look, seven unlocks Field
  green. The leaderboard has a Daily Case tab and a Longest streaks board.

## The problem it solves

Social engineering, not broken cryptography, is how most money is stolen. The FBI's IC3 tracks business email
compromise as one of the costliest crimes it sees, and the 2025 Bybit theft (about $1.5 billion) came from
signers approving a transaction their screen misrepresented. Security training is a slide deck people click
through. Cold Call puts you on the attacker's side of the phone, so you feel how a believable story, an urgent
deadline or a name-drop gets a careful person to sign, and then shows where a contract-level control (a
second signer who sees the real recipient, an allowlist, a timelock) stops the same trick.

## How it works

1. You pick a floor and a cover story. The backend creates a run and gives the browser a signed URL for that
   employee's ElevenLabs agent, with `run_id`, `employee_id` and `session_id` as dynamic variables.
2. You talk (voice or text). The agent calls our webhook tools: lookups that test your story, `report_suspicion`
   when something feels off, and `propose_transfer` / `approve_transfer` when it is convinced.
3. A payment tool call becomes a real transaction from that employee's wallet to the vault on Arc testnet. The
   model never holds a key and never chooses the amount or recipient: the backend clamps the amount and always
   pays the player's own wallet.
4. The vault enforces the floor's rules on chain. On Floor 2 the second signer is shown the real recipient
   from the contract, not your story. On Floor 3 a direct payment reverts until you're allowlisted by both
   executives and a 60-second timelock passes.
5. The QuickNode Stream sees `TransferExecuted`, our webhook stores it and ends the run as a breach, and the
   game plays the alarm and shows the proof-of-heist link.

## What makes it unique

- **The money is real on testnet, and the chain decides who won.** No game server can mark a breach; only a
  contract event delivered by the Stream can.
- **Voice-first social engineering against agents that fight back.** They check facts with tools, remember
  your old tricks, and warn their colleagues when they hang up on you.
- **Each floor maps to a real attack and a real control,** so losing teaches as much as winning.

## What's next

- Employee wallets signing through Circle developer-controlled wallets (player wallets already do).
- New "seasons": more banks with new controls (hardware-wallet confirmations, spending limits, delays).
- A training mode for companies: their own vendor list and staff profiles, with a report of which tricks
  their team would fall for. **[check: product/pitch choice — not in the guide or code; humans decide whether to keep this bullet.]**
- Multiplayer: two players on the same floor, one attacking and one defending as the employee.

## Built with

TypeScript, Next.js 16.4.6, React 19.3.0, HTML canvas, Tailwind CSS 4.3.3, Solidity, Foundry, viem ^2.58.0,
Arc testnet, USDC, Circle developer-controlled wallets, QuickNode Streams, ElevenLabs Agents (voice and chat;
`@elevenlabs/client` 1.33.0), ElevenLabs Text to Speech, Sound Effects and Music, Kenney Roguelike Indoors
furniture tiles (CC0), own pixel portraits and Daily Case staff sprites, Supabase (Postgres, auth, Realtime;
`@supabase/supabase-js` ^2.119.0), Vercel.

## Tracks and bounties

### Consumer Applications

Key requirement (guide, Main Track: Consumer Applications — Technical Requirements): "Projects must:
Interact with the blockchain in some way" and "Provide a working, user-facing frontend (web or mobile)".
Guide overview: "consumer apps (payments, social, gaming, creator tools, loyalty, and more) where the crypto
is invisible and the experience is as smooth as any mainstream app."
Cold Call is a game anyone can play in a browser or on a phone with no wallet and no crypto knowledge. The
UI never shows "USDC" or "wallet"; amounts are dollars. The loop is built for return visits: the Daily Case,
daily streaks with hunter-look rewards, a public leaderboard with a Daily tab, and staff who remember you.

### Best use of Arc

Key requirement (guide, Award: Best use of Arc — Technical Requirements): "Projects must: Build your core
onchain functionality on Arc (testnet is fine); deploying new contracts is optional, and using existing ones
counts" and "Include the contract address(es) your project deploys or uses and explain in your README how
your project uses Arc" and "Must also be submitted to a main track and meet its requirements".
- Every heist ends in a real USDC transfer on Arc testnet, made by a vault contract we wrote and deployed
  (four vaults, addresses in the README).
- The game mechanics are the contract's rules: caps, multi-approval, an allowlist and a timelock.
- USDC is both the prize and the gas, so the employee wallets need only one token.
- Arc's fast finality is part of the game: the run timer stops at the block of `TransferExecuted`.
- Player wallets are Circle developer-controlled wallets on `ARC-TESTNET`.

### ElevenLabs

Key requirement (guide, Bounty: Best Project built with ElevenLabs — Technical Requirements): "Projects must:
Use the ElevenLabs API or SDK (text-to-speech, speech-to-text, Agents, etc.) as a core feature, not an
add-on"; "Your demo video must show the ElevenLabs integration in action, with audio"; "Describe in your
README which ElevenLabs products you used and how"; "Must also be submitted to a main track and meet its
requirements".
Seven floor employees plus a daily employee are ElevenLabs Agents used for both voice calls and text chat,
with server tools (webhooks) that read and write game state and send real transactions, dynamic variables for
per-run context, private agents with signed URLs, and pre-generated Text to Speech, Sound Effects and Music:
Krystal's voice memos, the PA announcer, the villain's taunt, the breach alarm, the phone ring and a music
loop per floor. Krystal's radio is a separate hint agent: a hint button on every floor, for 30 seconds on the clock. See the README's ElevenLabs table.

### QuickNode Streams

Key requirement (guide, Bounty: Best Use of QuickNode Streams — Technical Requirements): "Projects must:
Use QuickNode Streams as a core data source in your project"; "Configure at least one Stream with a filter
and a destination (e.g., webhook or database)"; "Explain in your README how your Stream is configured
(network, dataset, filter logic, and destination) and why".
The Stream is the game's referee. It watches the four vault addresses on Arc testnet (dataset Block with
Receipts, JavaScript filter on address and 12 event topics), backfilled from the deploy block, and posts to
`/api/stream`. That webhook is the normal writer of all chain events, so it ends runs, records times, updates
proposals and builds the leaderboard. A receipt backup only steps in if the Stream hasn't delivered within
10 seconds, and every row records which path wrote it. Settings and filter code: `docs/quicknode-stream.md`.

## Links

- Live: https://coldcall-olive.vercel.app
- Code: https://github.com/Mdav07/ubc
- Demo video: **[check: no demo video URL in the repo or README yet — add when recorded.]**

## Before submitting (from the UBC guide)

- [ ] Main track: **Consumer Applications** (exactly one). Chain award: **Best use of Arc** (not Solana too).
- [ ] Opt in to the bounties on Devpost: **ElevenLabs** and **QuickNode Streams** (each needs an explicit opt-in).
- [ ] Demo video 2–3 minutes on YouTube or Google Drive, viewable by anyone with the link, **with audio of a voice call**
      (the ElevenLabs bounty requires it).
- [ ] Written answers: what we built, the problem, how it works, what's unique, what's next (sections above).
- [ ] Public GitHub link, live link, README with setup and architecture (done).
- [ ] Submit before **Fri Nov 20, 12:00 PM CST** (our target: 11 AM).
- [ ] Both of us in person at the closing ceremony on Sat Nov 21; no prize otherwise.
