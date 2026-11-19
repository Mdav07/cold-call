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

## Image gallery (upload in this order)

Screenshots of the live site, in `docs/devpost/` (desktop at 1280x800, phones at 390x844):

1. `floor-1-walk.jpg`: Floor 1 with guide arrows
2. `dee-dialogue.jpg`: talking to Dee, suspicion meter
3. `briefing.jpg`: Floor 3 briefing with max bounty, difficulty and vault rule
4. `phones.jpg`: the handheld-console layout on a phone
5. `minigame.jpg`: a clue behind a mini-game
6. `casefile.jpg`: the case file
7. `seasonal.jpg`: the Thanksgiving case, two people to convince
8. `daily.jpg`: today's Daily Case
9. `leaderboard.jpg`: fastest breaches and top earners
10. `profile.jpg`: hunters to earn

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

## Project story ("About the project")

The text on Devpost is kept in [`devpost/story.md`](devpost/story.md). Edit that file and paste it whole, so the
repo and Devpost stay the same.

## Additional info (hackathon form, judges only)

Saved on Devpost on Nov 18. Prizes selected: Consumer Applications Track Winner, Consumer Applications Best use
of Arc, QuickNode Streams, ElevenLabs. The team, GitHub link and contract addresses are filled in.

**Project description** (the form asks: short description, what you built, the problem, how it works, what's
unique, what's next, technologies). This section adds no new facts; it restates the project story in that order.
The text on Devpost is the source; update both together.

**Technical summary:** the stack, the tool-call → vault → Stream path, per-floor rules (caps, multi-approval,
the Floor 3 allowlist), memory and the Daily Case agent through dynamic variables, and the 1¢ token vs. the
recorded cracked amount.

## Contract addresses (Arc testnet, chain ID 5042002)

If Devpost asks for them separately:

| Vault | Address |
| --- | --- |
| Tutorial and Daily Case | `0x1f74b2082b504746A6948c95cEC0b0986E00Ce8b` |
| Floor 1 | `0x93Af5Ca91433115629bc53E970363e377227C8c5` |
| Floor 2 and the seasonal case | `0xA51D015653140086ad84f358Feb5A7Bf18078F7F` |
| Floor 3 | `0x8c86dD235193d42bf4a751bA5138fF1286E28475` |

The earlier Floor 3 vault, `0x2DD6d208b41875b97aA3eDCec1F8DbE3941AE670`, is retired.

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
   direct payment bounces until both executives allowlist you. The Bybit debrief card.
6. **They remember you (2:10–2:20).** Repeat a story on a new run and the employee calls it out.
7. **Come back tomorrow (2:20–2:30).** The Daily Case, the streak badge, the leaderboard, and a few seconds of
   the same game on a phone (the handheld-console layout). Tagline and link.

TODO: reset the demo player before recording (`scripts/demo-reset.ts`, `agents/reset-memory.ts`).
