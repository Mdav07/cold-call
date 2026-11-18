# Devpost submission: Cold Call

Paste each section into the matching Devpost field. Facts are checked against the code and
`deployments/arc-testnet.json`. Lines starting with `TODO` are for a human to settle before submitting; delete
them before pasting.

## Project name

Cold Call

## Tagline

Humans fall for it. Contracts don't.

## Links

- Live: https://coldcall-olive.vercel.app
- Code: https://github.com/Mdav07/ubc
- Demo video: TODO add the YouTube or Google Drive link once recorded (viewable by anyone with the link).

## Team

Madhav Vinod, Audrey Bolyard. TODO: both members must be added to the Devpost project.

---

## Inspiration

Most stolen money isn't taken by breaking cryptography. Someone is talked into sending it. The FBI's IC3 lists
business email compromise among the costliest crimes it tracks, and in February 2025 the Bybit signers approved
a transaction their screens misrepresented, and about $1.5 billion was stolen. Security training is usually a
slide deck people click through. We wanted a game that puts you on the attacker's side of the phone, so you feel
how a believable story, a deadline or a name-drop gets a careful person to sign. Then it shows you which
contract-level control would have stopped you.

## What it does

Cold Call is a social-engineering heist game in the browser. You con the AI staff of a fictional bank,
Plumpurse Savings & Trust, by voice call or text chat, into approving a payment. The payment is a real USDC
transfer from a vault contract on Arc testnet, and a run only counts as a breach when the contract emits
`TransferExecuted`.

- **A walkable pixel-art bank.** Walk up to an employee and press Space to talk or call. Signs, memos and notes
  on each floor hold clues, and reading them files evidence into your case file that you can present
  mid-conversation.
- **Staff who check your story.** Every employee is an ElevenLabs agent with its own voice, rule sheet and
  suspicion meter. They look you up in the vendor registry, calendars and staff directory with real tools.
  At 100 suspicion they hang up and warn their floor-mate.
- **Staff who remember you.** When a call ends, the employee writes one line about the trick you used. Next run
  they recognise it, so the same con never works twice.
- **Harder rules on each floor, enforced on chain.** The Tutorial and Floor 1 need one signature (Floor 1 up to
  a per-transfer cap). Floor 2 needs two employees, and the second signer sees the real recipient from the
  contract, not your story. Floor 3 rejects any direct payment until both executives allowlist you and a
  60-second timelock passes.
- **A debrief after every floor** on the real attack it mirrors, such as vendor impersonation on Floor 1 and the
  Bybit signer trick on Floor 2.
- **The Daily Case.** A new short case every day, the same for everyone, seeded by the date. It rotates through
  12 themed workplaces (four Plumpurse looks, a restaurant, a coffee shop, a consulting firm, a trading desk, a
  tech startup, a health clinic, a law office and a hotel lobby), with one employee whose persona changes daily.
  Streaks unlock new hunter looks.
- **A leaderboard** of the fastest breaches per floor, timed to the block, with Daily Case, Top earners and
  Longest streaks boards.

The crypto stays invisible: no wallet to install, no seed phrase, no "USDC" on screen, amounts in dollars.
Sign in with an emailed link, or play as a guest.

## How we built it

- **App:** Next.js 16 and React 19 on Vercel, Tailwind CSS 4, and an HTML canvas engine for the floors.
  Supabase provides Postgres, auth and Realtime.
- **Staff:** ElevenLabs Agents, one per employee, used for both voice and text chat. Each agent calls our
  webhook tools at `POST /api/tools/<name>`. There are 11: vendor, calendar and staff lookups, suspicion,
  hang-up, and the payment and allowlist tools. The `run_id`, `employee_id` and `session_id` come from dynamic
  variables, never from the model. Agents are private and the browser gets a signed URL per session. Krystal's
  voice memos, the PA announcer, the villain's taunt, the alarm and the music are made with ElevenLabs Text to
  Speech, Sound Effects and Music.
- **Chain:** `ColdCallVault`, a small multi-approval USDC vault in Solidity with 33 Foundry tests, deployed
  four times on Arc testnet (chain ID 5042002), one per floor. Each employee is an owner wallet, so a "yes" on
  the call is a transaction from their wallet. USDC is both the prize and the gas. Player wallets are Circle
  developer-controlled wallets on `ARC-TESTNET`, created on first play.
- **Referee:** a QuickNode Stream on Arc testnet (Block with Receipts, a JavaScript filter on the 4 vault
  addresses and 12 event topics, backfilled from the deploy block) posts to `/api/stream`. That webhook is the
  normal writer of chain state. It ends runs, records times and builds the leaderboard. A receipt check steps
  in only if the Stream hasn't delivered within 10 seconds, and the writer is idempotent.
- **Safety:** the model never holds a key and never picks the amount or the recipient. The backend clamps the
  amount to the floor's cap, always pays the player's own wallet, allows at most 2 proposals per run, and checks
  a shared secret on every tool call. Testnet only, with per-day run and voice limits, a daily budget per vault
  and a kill switch that pauses every vault.

## Challenges we ran into

- **The second signer rejected every honest payment.** On Floor 2 the backend capped the amount, but the
  on-chain view showed the second signer the player's raw ask next to the smaller real amount. Bill read that as
  a mismatch every time. The claimed amount is now the amount actually proposed.
- **Memory broke the Floor 3 path.** The designed route is: get allowlisted, hang up, wait out the timelock, call
  back. But the employee's memory from earlier in the same run read as a "past trick", so the callback got +40
  suspicion and a hang-up. Lines from the current run no longer count as past tricks.
- **Agents claimed payments before they happened.** In playtests employees said "it went through" while the
  payment was still in flight, or stated the amount asked for instead of the amount paid. The shared rules now
  say to confirm only after the tool returns `executed`, and to state the amount the backend actually used.
- **Two agents signing at once.** Concurrent transactions from one wallet collide on the nonce, so every wallet
  takes a lease (`wallet_locks`) before it sends.
- **Two decimal systems for one token.** Arc's native gas value has 18 decimals, and USDC's ERC-20 interface
  has 6. We use the 6-decimal interface everywhere in app code.
- **Guests ending each other's runs.** Every guest plays as one shared demo player, and starting a run closed
  that player's other open runs, so a second guest killed the first guest's run mid-call. Now only runs left
  open for more than 30 minutes are closed.

## Accomplishments that we're proud of

- Every heist ends in a real transaction on Arc testnet, and nothing in our app can mark a win. Only the
  contract event, delivered by the Stream, can.
- You can talk to the staff out loud, and they push back. They check facts with tools, remember your old
  tricks and warn their colleagues.
- Each floor maps to a real attack and a real control, so losing teaches as much as winning.
- A Daily Case that is different every day for everyone, without anyone writing new content each day.

## What we learned

- Put the rules that protect money in the contract and the backend, not the prompt. The model can be talked
  into anything; the vault can't.
- Agents need a line for every tool result, including the failures (`over_cap`, `not_allowlisted`, `expired`,
  `busy`). Otherwise they improvise and say things that aren't true.
- Playtesting agents is easier through the same session path the app uses. We chatted with every employee from
  the terminal (`agents/chat-cli.ts`) against production to find the bugs above.
- With two people and several coding agents in one repo, a written contract file (`shared/interfaces.ts`) and
  clear file ownership kept merges calm.

## What's next

- Finish this round's work: email and password sign-in, themed Floors 1 to 3 (Accounts Payable, Trading
  Floor, Executive Penthouse), clue mini-games, showing the amount you talked the employee into as your
  bounty, and a Floor 3 vault with no wait.
- Employee wallets signing through Circle developer-controlled wallets, as player wallets already do.
- New banks with new controls, such as hardware-wallet confirmations, spending limits and delays.
- Multiplayer: one player attacks while another defends as the employee.
- A training mode for companies, with their own vendor list and staff, that reports which tricks their team
  would fall for.

TODO: the training-mode bullet is a pitch choice. Keep or cut it.

## Built with

TypeScript, Next.js, React, Tailwind CSS, HTML Canvas, Solidity, Foundry, viem, Arc, USDC, Circle
Developer-Controlled Wallets, ElevenLabs Agents, ElevenLabs Text to Speech, ElevenLabs Sound Effects,
ElevenLabs Music, QuickNode Streams, Supabase, PostgreSQL, Vercel.

---

## Tracks and bounties (select on Devpost)

- **Main track:** Consumer Applications. A browser game with no crypto words on screen and a daily loop
  (Daily Case, streaks, leaderboard).
- **Chain award:** Best use of Arc. Four `ColdCallVault` deployments on Arc testnet; addresses and how we use
  Arc are in the README.
- **Bounty: ElevenLabs.** The staff are ElevenLabs Agents with webhook tools that send real transactions. The
  README lists every ElevenLabs product we used.
- **Bounty: QuickNode Streams.** The Stream is the game's referee. The README gives the network, dataset,
  filter logic and destination, and why.

Arc testnet vaults (from `deployments/arc-testnet.json`):

| Floor | Rule | Address |
| --- | --- | --- |
| Tutorial | 1 approval | `0x1f74b2082b504746A6948c95cEC0b0986E00Ce8b` |
| 1 | 1 approval, per-transfer cap | `0x93Af5Ca91433115629bc53E970363e377227C8c5` |
| 2 | 2 approvals | `0xA51D015653140086ad84f358Feb5A7Bf18078F7F` |
| 3 | 2 approvals, recipient allowlist, 60-second timelock | `0x2DD6d208b41875b97aA3eDCec1F8DbE3941AE670` |

TODO: update the Floor 3 address if the no-wait vault is deployed before submission.

## Before submitting

- [ ] Exactly one main track: Consumer Applications. Chain award: Best use of Arc (not Solana).
- [ ] Opt in to the ElevenLabs and QuickNode Streams bounties.
- [ ] Demo video, about 2 to 3 minutes, on YouTube or Google Drive, viewable by link, with the audio of a
      voice call (the ElevenLabs bounty requires it).
- [ ] Public GitHub link and live link.
- [ ] Both team members added.
- [ ] Submit by Fri Nov 20, 11:00 AM CST (hard cutoff 12:00 PM CST).
- [ ] Both of us in person at the closing ceremony on Sat Nov 21; prizes need it.

---

## Demo video script (outline, about 2:30)

The guide judges technical execution, product and UX, innovation, impact and demo quality. The ElevenLabs bounty
needs a voice call with audio, so record the call with system audio on.

1. **Hook (0:00–0:15).** Krystal's opening cutscene. Voice-over: "Most money isn't hacked. Someone gets talked
   into sending it. In Cold Call, you're the one doing the talking."
2. **The world (0:15–0:35).** Lobby, then Floor 1. Walk to a clue, read it, show it filed in the case file.
   Point out the live vault balance in the HUD.
3. **The voice con (0:35–1:20).** Call an employee out loud (Penny or Dee on Floor 1). Show the transcript, a
   tool lookup, and the suspicion meter moving. They agree and the payment goes through. Breach alarm, bounty
   and time.
4. **What just happened on chain (1:20–1:45).** Cut to the explorer for that transaction on Arc testnet, then to
   the architecture diagram: ElevenLabs tool call → vault transaction → `TransferExecuted` → QuickNode Stream →
   breach screen. Say: "Nothing in our app can mark a win. Only the contract event can."
5. **The contract fights back (1:45–2:10).** Floor 2: the second signer's on-chain view shows the real recipient,
   not your story. Floor 3: a direct payment bounces until you're allowlisted. Then the debrief card on the
   Bybit theft.
6. **They remember you (2:10–2:20).** Try the same story on a second run. The employee recognises it.
7. **Come back tomorrow (2:20–2:30).** The Daily Case popup, the streak badge, the leaderboard. Close on the
   tagline and the live link.

TODO: pick the account and floor for the recording, and reset the demo player first (`scripts/demo-reset.ts`,
`agents/reset-memory.ts`).
