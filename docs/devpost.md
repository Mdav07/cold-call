# Devpost submission: Cold Call

Each block below matches a Devpost field. Facts are checked against the code and `deployments/arc-testnet.json`.
Lines starting with `TODO` are for a human to settle; don't paste them.

## Project name

Cold Call

## Elevator pitch (tagline, 200 characters max)

Con AI bank employees by voice into paying out from real USDC vaults on Arc. Each floor adds a smart-contract
rule a good story can't beat.

## Try it out

- https://coldcall-olive.vercel.app
- https://github.com/Mdav07/ubc

## Video demo link

TODO: YouTube or Google Drive link, viewable by anyone with the link.

## Built with (tags)

typescript, next.js, react, tailwindcss, html5-canvas, solidity, foundry, viem, arc, usdc, circle,
elevenlabs, quicknode, supabase, postgresql, vercel

## Team

Madhav Vinod, Audrey Bolyard. TODO: confirm both are on the Devpost project.

## Tracks (select on Devpost)

- Main track: **Consumer Applications**
- Chain award: **Best use of Arc**
- Bounties (opt in to each): **ElevenLabs**, **QuickNode Streams**

---

## Project story (paste everything between the lines into "About the project")

---

## Inspiration

Most stolen money isn't taken by breaking cryptography. Someone is talked into sending it. The FBI ranks
business email compromise among the costliest crimes it tracks, and in February 2025 Bybit's signers approved a
transaction their screens misrepresented and about $1.5 billion was stolen. Security training is usually a slide
deck. We wanted a game that puts you on the attacker's side of the phone, so you feel how a believable story, a
deadline or a name-drop gets a careful person to sign, and then shows you the control that would have stopped
you.

## What it does

Cold Call is a social-engineering heist game in the browser. You call or text the AI staff of a fictional bank,
Plumpurse Savings & Trust, and talk them into approving a payment. Each approval is a real transaction from that
employee's wallet to a USDC vault on Arc testnet, and a run counts as a breach only when the vault pays out.

You walk a pixel-art tower, read clues on each floor, and file them as evidence you can present
mid-conversation. The staff fight back. They check your story against a vendor registry, calendars and a staff
directory. A suspicion meter rises with every slip, and at 100 they hang up and warn their colleague. They also
remember the tricks you used on them before, so the same con never works twice.

Each floor adds a rule enforced by the contract:

- **Tutorial:** one signature pays.
- **Floor 1, Accounts Payable:** one signature, up to a cap.
- **Floor 2, Trading Floor:** two signatures, and the second signer sees the real recipient from the contract,
  not your story.
- **Floor 3, Executive Penthouse:** a direct payment always bounces. Both executives must allowlist you first,
  and then a timelock runs.

After each floor a debrief names the real attack you just ran and the control that stops it. A Daily Case gives
everyone the same new case each day, rotating through 12 themed workplaces, with streaks and a leaderboard
timed to the block.

None of the crypto shows. There's no wallet to install and no seed phrase. Amounts are in dollars, and you sign
in with an email and password or play as a guest.

## How we built it

- **Game:** Next.js 16 and React 19 on Vercel, Tailwind CSS 4, and our own HTML canvas engine for the floors.
  Supabase handles Postgres, auth and Realtime.
- **Staff:** one ElevenLabs Agent per employee, used for both voice calls and text chat. The agents call 11
  webhook tools on our server for lookups, suspicion, hang-ups, and proposing or approving payments. Run and
  session IDs come from dynamic variables, never from the model. The same mechanism lets one Daily Case agent
  play a new character every day. Krystal's briefings, the alarm and the music are made with ElevenLabs Text to
  Speech, Sound Effects and Music.
- **Money:** `ColdCallVault`, our multi-approval USDC vault (Solidity, 33 Foundry tests), deployed once per
  floor on Arc testnet. Each employee is an owner wallet that pays gas in USDC. Players get a Circle
  developer-controlled wallet on their first play.
- **Referee:** a QuickNode Stream filters Arc testnet down to our 4 vaults and 12 events and posts each one to
  our webhook. That webhook is the only thing that can end a run as a breach, and it records the time from the
  block.
- **Guardrails:** the model never holds a key or picks the recipient. The server caps every amount, pays only
  the player's own wallet, and limits proposals, runs and voice minutes.

## Challenges we ran into

- **The second signer refused every honest payment.** The server capped the amount, but the on-chain view
  showed the player's original ask next to the smaller real amount, and Bill read that as fraud every time. Now
  the proposer's stated amount is the amount actually proposed.
- **Memory broke Floor 3.** The intended route is: get allowlisted, hang up, wait out the timelock, call back.
  But the employee's notes from earlier in the same run read as a "past trick", and the callback got a hang-up.
  Notes from the current run no longer count.
- **Agents claimed payments before they happened.** In playtests an employee said "it went through" while the
  transaction was still in flight. Each agent now confirms only after the tool returns `executed`, and has a
  line for every failure status.
- **Two agents signing at once** collided on the wallet nonce, so every wallet now takes a lease before it sends.
- **Two decimal systems for one token.** Arc's native gas value has 18 decimals and USDC's ERC-20 interface has
  6, so all app code uses the 6-decimal interface.
- **Guests ending each other's runs.** All guests share one demo player, so a second guest starting a run closed
  the first guest's run mid-call.

## Accomplishments that we're proud of

- Nothing in our app can mark a win. Only a contract event, delivered by the Stream, can.
- Talking out loud to an agent that checks your facts, holds a grudge and remembers you is a different
  experience from any chatbot.
- A con that works on Floor 1 fails on Floor 2 because of one contract rule, and the debrief makes that lesson
  land.
- The Daily Case is a new, playable case every day from seeded templates, with no one writing content each
  morning.

## What we learned

- Put the rules that protect money in the contract and the server, not the prompt. The model can be talked into
  anything; the vault can't.
- Agents improvise when a tool result has no scripted response, so every status needs a line.
- The fastest way to test agents was to chat with each one from the terminal, through the same session path the
  app uses, against the live backend.
- With two people and several coding agents in one repo, a shared interface file and clear file ownership kept
  merges calm.

## What's next

- Show the amount you talked the employee into as your bounty (the game already records it), switch Floor 3 to
  its new no-wait vault, and add short mini-games to the clues.
- Move employee signing to Circle developer-controlled wallets, as player wallets already are.
- New banks with new controls, such as hardware-wallet confirmations, spending limits and delays.
- Multiplayer: one player attacks while another defends as the employee.
- A training mode for companies, built on their own vendors and staff, that reports which tricks their team falls
  for.

---

TODO: the training-mode bullet is a pitch choice. Keep or cut it.

## Contract addresses (Arc testnet, chain ID 5042002)

If Devpost asks for them separately:

| Vault | Address |
| --- | --- |
| Tutorial and Daily Case | `0x1f74b2082b504746A6948c95cEC0b0986E00Ce8b` |
| Floor 1 | `0x93Af5Ca91433115629bc53E970363e377227C8c5` |
| Floor 2 | `0xA51D015653140086ad84f358Feb5A7Bf18078F7F` |
| Floor 3 | `0x2DD6d208b41875b97aA3eDCec1F8DbE3941AE670` |

TODO: switch the Floor 3 row to `0x8c86dD235193d42bf4a751bA5138fF1286E28475` if the no-wait vault goes live
before submission.

## Before submitting

- [ ] One main track (Consumer Applications), one chain award (Best use of Arc), and opt in to the ElevenLabs
      and QuickNode Streams bounties.
- [ ] Demo video, 2 to 3 minutes, viewable by link, with the audio of a voice call (the ElevenLabs bounty
      requires it).
- [ ] Public GitHub link and live link.
- [ ] Both team members on the project.
- [ ] Submit by Fri Nov 20, 11:00 AM CST (hard cutoff 12:00 PM CST).
- [ ] Both of us at the closing ceremony on Sat Nov 21; prizes require it.

---

## Demo video script (outline, about 2:30)

Judges score technical execution, product and UX, innovation, impact and the demo. Record the call with system
audio on.

1. **Hook (0:00–0:15).** Krystal's cutscene. Voice-over: "Most money isn't hacked. Someone gets talked into
   sending it. In Cold Call, you're the one doing the talking."
2. **The world (0:15–0:35).** Lobby, then Floor 1. Read a clue and show it filed in the case file.
3. **The voice con (0:35–1:20).** Call Penny or Dee out loud. Show the live transcript, a lookup and the
   suspicion meter. They agree; alarm, bounty and time.
4. **On chain (1:20–1:45).** The transaction on the Arc explorer, then the architecture diagram: tool call →
   vault transaction → `TransferExecuted` → QuickNode Stream → breach screen. "Nothing in our app can mark a
   win. Only the contract event can."
5. **The contract fights back (1:45–2:10).** Floor 2: the second signer sees the real recipient. Floor 3: a
   direct payment bounces until you're allowlisted. The Bybit debrief card.
6. **They remember you (2:10–2:20).** Repeat a story on a new run and the employee calls it out.
7. **Come back tomorrow (2:20–2:30).** The Daily Case, the streak badge, the leaderboard. Tagline and link.

TODO: reset the demo player before recording (`scripts/demo-reset.ts`, `agents/reset-memory.ts`).
