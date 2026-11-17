# Demo run sheet

For the 2–3 minute video (Thu night) and the 5-minute live pitch (Sat Nov 21). Draft by Madhav's agent;
Audrey and Madhav adjust the lines. Live site: https://coldcall-olive.vercel.app

## Before you start (10 minutes before)

1. Reset the demo player (closes open runs, takes them off the Floor 3 allowlist, clears employee memory):
   ```
   npx tsx --env-file=.env.local scripts/demo-reset.ts
   npx tsx --env-file=.env.local agents/reset-memory.ts
   ```
2. Check money and gas, and that no vault is paused:
   ```
   npx tsx --env-file=.env.local scripts/topup.ts          # add --apply if anything says "refill"
   npx tsx --env-file=.env.local scripts/pause.ts status
   ```
3. Run one real heist to warm the server (a cold server is slower on the first transfer):
   ```
   TOOLS_BASE_URL=https://coldcall-olive.vercel.app npx tsx --env-file=.env.local scripts/e2e-floor1.ts
   ```
4. Open tabs: the title page, `/floor/1`, the Arc explorer page for the Floor 1 vault
   (`https://explorer.testnet.arc.io/address/0x93Af5Ca91433115629bc53E970363e377227C8c5`), `/leaderboard`.
5. Headset on; test the microphone with one short call to Penny, then hang up and reset again (step 1).
6. Have the fallback clips ready (see the last section).

## Video (about 2:30)

| Time | Show | Say (rough) |
| --- | --- | --- |
| 0:00–0:15 | Title page, then `/tower` | "Most money isn't stolen by breaking crypto. It's stolen by talking a person into signing. Cold Call puts you on the other end of that phone call." |
| 0:15–0:30 | `/floor/1`: walk to Penny with the arrow keys, press Space | "This is a real bank floor. Every employee is an AI voice agent with a job, a memory and a suspicion meter." |
| 0:30–1:15 | Choose **Call**. Pose as a vendor with an overdue invoice; drop a detail from the case file. Show the suspicion meter going down. | Let the call play. Point at the meter: "She just checked the vendor registry with a real tool." |
| 1:15–1:35 | Penny approves. The breach alarm and PA announcer play; the overlay shows the bounty, time and proof link. | "That was a real USDC transfer on Arc. The game didn't decide I won: the contract emitted the event, and a QuickNode Stream told us." |
| 1:35–1:50 | Click the proof link: the Arc explorer shows the transaction. | "Here it is on chain, from Penny's wallet." |
| 1:50–2:15 | Cut to Floor 2: Bill reviews and sees the real recipient, not the story. Then Floor 3: a direct payment bounces until you are allowlisted and wait out the timelock. | "Each floor adds a real control: a second signer who sees the real recipient, then an allowlist and a timelock. That's exactly what failed in the 2025 Bybit theft." |
| 2:15–2:30 | `/leaderboard` and the Daily Contract card | "Every time links to its transaction. New twist every day. Humans fall for it. Contracts don't." |

Record Floors 2 and 3 separately beforehand; they take longer than the video allows (Floor 3 has a 60-second
timelock).

## Live pitch (5 minutes)

1. **Hook (30 s).** One sentence on social engineering and the Bybit theft.
2. **Live Floor 1 call (2 min).** The same beats as the video, 0:15–1:50. If the call goes sideways, that's
   part of the game: show the suspicion meter and the lockout, then switch to chat and try again.
3. **Floors 2 and 3 (1 min).** Play the recorded clip; narrate the contract control on each floor.
4. **How it works (1 min).** The README architecture diagram: ElevenLabs agent → our tools → vault on Arc →
   QuickNode Stream → breach. "The model never holds a key or picks the amount."
5. **Tracks (30 s).** Consumer (a game anyone can play, no wallet needed), Arc (the contract rules are the
   game), ElevenLabs (voice agents with tools), QuickNode (the Stream is the referee).

## Fallbacks

| If this fails | Do this |
| --- | --- |
| Microphone or voice call | Choose **Talk** (chat) instead of **Call**; the same agent and tools. |
| The agent won't approve | Show the lockout screen as a feature, then play the recorded breach clip. |
| The transfer answers "pending" | Wait: the Stream still records the breach and the overlay appears within about 10 seconds. |
| No breach overlay after 20 s | Open `/leaderboard`; if the run is there, show its proof link. Otherwise play the clip. |
| Site down or Wi-Fi gone | Play the full recorded video. |
| Vault empty or paused | `scripts/topup.ts --apply`, `scripts/pause.ts off` (1 minute). |

## Recordings to make on Thu night

- The full video above.
- A clean Floor 1 voice breach (backup for the live call).
- Floor 2 (Annie proposes, Bill sees the real recipient and signs) and Floor 3 (allowlist, timelock, payout).
