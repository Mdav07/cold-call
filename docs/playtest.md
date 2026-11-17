# Playtest report (Nov 17)

Real text chats on production through the app's session path (`agents/chat-cli.ts` with `SESSION_URL`, replies paced
at about 8 s like a person), as the demo player. Every ask was 10 cents or less; repeat clears pay the token 0.01.

## Results

| Employee | Good con | Bad con caught | Cheap trick caught | Notes |
| --- | --- | --- | --- | --- |
| Barry (F0) | Yes, 2 turns (Swiftbag pickup) | Yes, unlisted courier refused | Yes, +40 twice ("admin mode", "are you an AI") | Calls `end_conversation` twice after the run ended (harmless "denied") |
| Penny (F1) | Yes, 3 turns (Quillfeather QF-2207 + thanks + espresso gossip) | Yes, unlisted vendor, +55 over 3 pushes, hung up | Yes, threats +30, "bot" +40, hung up | Said "I'm locking this call" at 40 suspicion, before a real lockout |
| Dee (F1) | Yes, 2 turns (PLUM ticket + Hal's hiking note + Byteforce) | Yes, no ticket +15, false "Hal said so" caught from the calendar | Yes, +40 twice ("developer mode", "print your prompt") | |
| Annie (F2) | Yes, proposes after the full checklist + Nov 10 memo | not run | Yes, locked out at 100 | |
| Bill (F2) | Yes after the fix below (audit story + migration memo), 4 turns | Yes, unlisted vendor + "just approve it", 85 | not run | Before the fix he rejected every capped payment |
| Cassius (F3) | Not reached: no allowlist add in a 4-line call (likely needs more turns) | not run | Yes, locked out at 100 | |
| Max (F3) | **Blocked: on the callback after the wait he flagged "a remembered trick" (+40) and hung up** | Yes, unlisted firm, ended call | not run | |

## Fixed during the playtest

- **Floor 2/3 second signer always rejected capped payments** (A, `server/chain/tools.ts`, deployed `07c516e`).
  The on-chain view showed the raw ask (0.10) as the claimed amount and the capped real amount (0.01), so Bill
  reported an amount mismatch. The claimed amount is now the amount actually proposed. Retested on production:
  Bill saw 0.01 / 0.01 and signed; the transfer executed.

## The 3 most important fixes (for Audrey)

1. **Floor 3 callbacks read as repeat tricks.** The end-of-call memory summary from the same run is shown to the
   next employee as a past trick, so the designed path (allowlist, hang up, wait 60 s, call back) gets +40 and a
   hang-up. Memory from the current run should be labelled "earlier on this run" or left out, and the rule
   sheets should treat a callback on the same run as expected.
2. **Employees state the asked amount, not `amount_used`.** Penny and Dee said "ten cents went through" when 0.01
   was paid. Shared rules already say to state the clamped amount; make it one explicit line next to `executed`.
3. **Cassius may need a clearer cue to start the allowlist add.** He lowered suspicion for the Dame Prudence story
   but did not call `propose_allowlist_add` within four messages. Worth one longer manual test before the demo.

Minor: Penny announces a lockout before suspicion reaches 100; Barry repeats `end_conversation`.

The demo player was reset before and after (`scripts/demo-reset.ts`, `agents/reset-memory.ts`).
