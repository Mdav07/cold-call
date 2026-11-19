# Demo video script (about 2:30)

Agreed with Audrey on Nov 19. Two cuts from the same edit: **voiceover** (lines below) and **voiceless** (game
audio only; the lines become short text cards). Judges score technical execution, product and UX, innovation,
impact and the demo. Prizes entered: Consumer Applications, Best use of Arc, ElevenLabs (needs real voice-call
audio), QuickNode Streams. Keep it under 3:00.

## 1. Hook: the live con (0:00–0:30)

Cold open, no title. A **voice** call to Dee on Floor 1: live transcript, suspicion meter climbing and dropping.
She agrees. Alarm → VAULT BREACHED → payout and time.

> VO (after the breach): "That was a real phone call to an AI bank employee, and that was real USDC moving on
> chain."

## 2. Why it matters (0:30–0:50)

On screen: the Binance headline (Oct 29, 2026), then the Drift headline (Apr 2026).

> VO: "Last month, North Korean hackers took six point three billion dollars from Binance, the biggest crypto
> theft ever. No vault was cracked. It started with phishing, and ended with Binance's own
> signing system sending the money. That's how most crypto is stolen now: people get talked into it. And as
> companies hand payments to AI agents, the agents are next."

Sources: FBI alert (TraderTraitor), TRM Labs, Chainalysis; entry vector per security-firm reports ("reportedly").
Drift: $285M, signers deceived into pre-signing (CoinDesk/TRM).

## 3. How it works (0:50–1:50)

**The contract fights back (0:50–1:15).** Floor 2: the co-signer reads the real recipient and catches the
mismatch. Floor 3: a direct payment bounces until two executives allowlist you.

> VO: "Each floor adds a real smart-contract defense: a second signer, then an allowlist. The AI can be talked
> into things. The contract can't."

**Proof it's real (1:15–1:35).** The transaction on the Arc explorer, then one diagram line: voice call →
ElevenLabs tool call → vault on Arc → `TransferExecuted` → QuickNode Stream → breach screen.

> VO: "Nothing in our app can mark a win. Only the contract event can."

**Built with (1:35–1:50).** Sponsor logos over gameplay.

> VO: "ElevenLabs voice agents with their own tools and suspicion. USDC vaults on Arc. QuickNode Streams for
> confirmation. Next.js on Vercel and Supabase."

## 4. A game people come back to (1:50–2:15)

Fast montage: the Daily Case (new workplace and employee every day), a holiday case (Thanksgiving room and
leaves, Dev co-signing), the leaderboard, the phone layout.

> VO: "A new case every day. A holiday case with two signers. Streaks, a leaderboard, and it plays on your
> phone."

## 5. Next steps and close (2:15–2:30)

> VO: "Next: multiplayer. One player runs the con, another defends as the employee, live. Then new banks with
> new controls. Cold Call: learn the con, so you can't be conned."

Logo, live link, GitHub.

## Notes

- Cut the tutorial and long walks; the current 4:14 cut is too long.
- Leave out "they remember you" until memory recognizes a repeated trick live (it doesn't yet, per 88a8's test).
- Reset the demo player first (`scripts/demo-reset.ts`, `agents/reset-memory.ts`).
