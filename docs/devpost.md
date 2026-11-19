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
3. `phones.jpg`: the handheld-console layout on a phone
4. `briefing.jpg`: Floor 3 briefing with max bounty, difficulty and vault rule
5. `minigame.jpg`: a clue behind a mini-game
6. `casefile.jpg`: the case file
7. `seasonal.jpg`: a holiday case (Thanksgiving), two people to convince
8. `daily.jpg`: today's Daily Case
9. `daily-themes-gallery.jpg`: the twelve Daily Case workplaces
10. `holiday-rooms-gallery.jpg`: three rooms per holiday (Thanksgiving shown)
11. `leaderboard.jpg`: fastest breaches and top earners
12. `profile.jpg`: hunters to earn
13. `memory.png`: they remember you
14. `tracks.png`: the four tracks
15. `intro.jpg`: Krystal's opening

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
| Floor 2 and the holiday cases | `0xA51D015653140086ad84f358Feb5A7Bf18078F7F` |
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

## Demo video script (about 2:30)

The full script, with voice-over lines and sources, is `docs/demo-script.md` (agreed with Audrey on Nov 19). Two
cuts from one edit: voice-over, and voiceless with short text cards. Keep it under 3:00.

1. **Hook (0:00–0:30).** Cold open on a voice call to Dee: live transcript, suspicion meter. She agrees; alarm,
   VAULT BREACHED, payout and time. "That was a real phone call to an AI bank employee, and that was real money
   moving on chain."
2. **Why it matters (0:30–0:50).** The Binance headline (about $6.3 billion, Oct 29, 2026, FBI: North Korea's
   TraderTraitor), then Drift (about $280 million, Apr 2026, signers talked into pre-signing). People get
   talked into it, and AI agents that handle payments are next.
3. **How it works (0:50–1:50).** Floor 2: the co-signer reads the real recipient. Floor 3: a direct payment
   bounces until two executives allowlist you. The transaction on the Arc explorer, then voice call →
   ElevenLabs tool call → vault on Arc → `TransferExecuted` → QuickNode Stream → breach screen. "Nothing in our
   app can mark a win. Only the contract event can." Sponsor logos over gameplay.
4. **A game people come back to (1:50–2:15).** The Daily Case, a holiday case (Thanksgiving, Dev co-signing),
   the leaderboard, the phone layout.
5. **Next steps and close (2:15–2:30).** A security-training mode for companies to red-team their own AI
   agents, and multiplayer heists. Logo, live link, GitHub.

Reset the demo player before recording (`scripts/demo-reset.ts`, `agents/reset-memory.ts`).
