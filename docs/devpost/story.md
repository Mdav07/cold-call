![Cold Call title screen: Krystal Klear's last voice memo](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/title.jpg)

Right now, somewhere in Plumpurse Savings & Trust, a receptionist named Penny is about to approve a payment that will land in a stranger's wallet. Nobody hacked her. Somebody just called, quoted a real invoice, mentioned the espresso machine gossip, and sounded sure.

That somebody is you.

**Cold Call** is a social-engineering heist game. You walk the floors of a pixel-art bank and talk its AI staff into approving a payment, by phone or by chat. If they say yes, the payment is a **real USDC transfer on Arc testnet**, and the run only counts when the vault contract says so.

🧠 **And the staff learn.** Every employee remembers the trick you used on them. The same con never works twice.

![Inspiration](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-inspiration.png)

Most stolen money isn't stolen by breaking cryptography. It's stolen by talking to people. Business email compromise is one of the costliest crimes the FBI's IC3 tracks, and the 2025 Bybit theft (about $1.5 billion) happened because signers approved a transaction their screen misrepresented.

Security training is a slide deck people click through. We wanted the opposite: put you on the attacker's side of the phone, let you feel how a believable story, a deadline or a name-drop gets a careful person to sign, and then show you the contract-level control that would have stopped you.

![What it does](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-what-it-does.png)

![Walking Floor 1 and opening a conversation with Dee](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/floor-1-dialogue.jpg)

- **A bank you can walk.** Four top-down floors. Walk up to an employee and choose Talk, Call, Case file or Leave.
- **Seven AI employees who fight back.** Each one is an ElevenLabs agent with its own rule sheet, voice, portrait, quirks and suspicion meter. They check your story against a vendor registry, calendars and a staff directory with real tools.
- **They learn from your past runs.** When a call ends, the employee writes down the trick you used, built from their own suspicion notes. Next run they're reminded of it, and the same story gets called out. You have to keep inventing new cons.
- **Real money, on testnet.** Talk someone into it and their wallet signs a real USDC transfer to the vault on Arc.
- **The chain is the referee.** A run is a breach only when a QuickNode Stream delivers the vault's `TransferExecuted` event. The run clock stops at that block.
- **A story to follow.** Your vanished mentor Krystal Klear briefs each floor in her own voice, every clear uncovers one of her hidden notes, and her radio gives hints for a time penalty.
- **A reason to come back.** A Daily Contract with a twist, streaks, and a leaderboard where every time links to its transaction.

![They remember you: Penny falls for a story on run 1, writes it down when the call ends, and calls it out on run 2](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/memory.png)

![Plumpurse Tower: each floor's contract rule and the real con it mirrors](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/floors.png)

Each floor's vault has stricter rules, and each one mirrors a real attack. Lose, and the debrief tells you what the bank patched.

![A real breach on production: bounty, run time, proof-of-heist link, Krystal's note and the debrief](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/breach.jpg)

![How the tracks fit](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-tracks.png)

![Four tracks, one heist: the game, the staff (ElevenLabs), the money (Arc), the referee (QuickNode)](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/tracks.png)

Every heist passes through all four tracks, in order. Remove any one and the game stops working.

| Track | Its job | What we used |
| --- | --- | --- |
| **Consumer Applications** | **The game.** Playable in a browser with no wallet and no crypto words on screen. | Next.js, React, HTML canvas, Supabase, Circle wallets created on first play |
| **ElevenLabs** | **The staff.** Seven employees you call or text, who check your story and decide whether to sign. | Agents (voice and chat), server tools, dynamic variables, signed URLs, TTS, Sound Effects, Music |
| **Arc** | **The money and the rules.** An employee's "yes" is a transaction; the floor's vault decides if it pays. | `ColdCallVault` in Solidity, USDC as asset and gas, viem |
| **QuickNode Streams** | **The referee.** Only the Stream can end a run as a breach. | Stream with a JavaScript filter and a webhook destination |

An ElevenLabs tool call (`approve_transfer`) becomes an Arc transaction (`approveTransfer`), whose event (`TransferExecuted`) becomes a Stream delivery, which becomes your breach screen and a leaderboard row that links back to the transaction.

![How we built it](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-how-we-built-it.png)

![One heist in five steps: call, check, sign, vault, referee](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/pipeline.png)

1. **Call.** You pick a floor and a cover story. Our backend creates a run and hands the browser a signed URL for that employee's private ElevenLabs agent, with `run_id`, `employee_id` and `session_id` as dynamic variables.
2. **Check.** The agent calls our webhook tools to test your story: vendor lookups, calendars, the staff directory, and `report_suspicion` when something feels off.
3. **Sign.** When it's convinced, it calls `propose_transfer` or `approve_transfer`. That becomes a real transaction from the employee's wallet. The model never holds a key and never picks the amount or the recipient: the backend clamps the amount and always pays the player's own wallet.
4. **Vault.** `ColdCallVault` (Solidity, 33 Foundry tests) enforces the floor's rules on chain: a cap, two signers, an allowlist and a 60-second timelock. On Floor 2 the second signer is shown the real recipient from the contract, not your story.
5. **Referee.** The QuickNode Stream sees `TransferExecuted`, our webhook stores it and ends the run, and the game sounds the alarm with a proof-of-heist link.

The frontend is Next.js 16 and React 19 with an HTML canvas game, on Vercel. Supabase (Postgres, auth, Realtime) stores runs, proposals, memories and the leaderboard.

![Sponsor track: Arc](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-arc.png)

Everything of value in Cold Call happens on Arc testnet, in USDC.

- **Four vaults we wrote and deployed**, one per floor. The game's mechanics are the contract's rules.
- **USDC is both the prize and the gas**, so each employee wallet needs only one token.
- **Fast finality is part of the game.** The run timer stops at the block timestamp of `TransferExecuted`.
- **Player wallets are Circle developer-controlled wallets** on `ARC-TESTNET`, created on first play. Winnings land there.

Vaults: Tutorial `0x1f74b2082b504746A6948c95cEC0b0986E00Ce8b` · Floor 1 `0x93Af5Ca91433115629bc53E970363e377227C8c5` · Floor 2 `0xA51D015653140086ad84f358Feb5A7Bf18078F7F` · Floor 3 `0x2DD6d208b41875b97aA3eDCec1F8DbE3941AE670`

![Sponsor track: ElevenLabs](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-elevenlabs.png)

Voice is the main way to play.

- **Agents, voice and chat.** Every employee is one ElevenLabs agent used for phone calls and text chat, so you can switch channels mid-heist and their memory and suspicion carry over.
- **Server tools.** Each agent's actions are webhook tools on our backend. Approving a payment mid-call sends a real transaction.
- **Dynamic variables.** IDs are filled into every tool call by the platform, never by the model. Memory and open proposals are injected per session.
- **Private agents with signed URLs**, so only our backend can start a call.
- **Text to Speech, Sound Effects and Music.** Krystal's voice memos, the PA announcer, the villain's taunt, the breach alarm, the phone ring and a music loop for every floor. Krystal's hint radio is its own agent.

![Sponsor track: QuickNode Streams](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-quicknode.png)

Nothing in our app can mark a run as won. Only the Stream can.

- **Stream:** Arc testnet, dataset Block with Receipts, backfilled from the vaults' deploy block so the leaderboard can be rebuilt from the chain.
- **Filter:** JavaScript that keeps only logs from our 4 vaults whose topic0 is one of 12 game events.
- **Destination:** a webhook (`/api/stream`) that decodes the logs and passes them to one idempotent writer. It ends runs, records times, updates proposals and builds the leaderboard.
- **Backup:** if the Stream hasn't delivered within 10 seconds, the same writer ingests from the receipt. Every row records which path wrote it.

![Plumpurse leaderboard: every time links to its transaction](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/leaderboard.jpg)

![Built with](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-built-with.png)

| Category | Technologies |
| --- | --- |
| Game | Next.js 16, React 19, TypeScript, HTML canvas, Tailwind CSS 4 |
| Voice and AI | ElevenLabs Agents (voice and chat), Text to Speech, Sound Effects, Music |
| Chain | Arc testnet, USDC, Solidity, Foundry, viem |
| Wallets | Circle developer-controlled wallets |
| Chain data | QuickNode Streams |
| Database | Supabase (Postgres, auth, Realtime) |
| Hosting | Vercel |
| Art | Hand-drawn pixel portraits, Kenney CC0 tiles |

![Challenges](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-challenges.png)

- **The second signer rejected every honest payment.** On Floor 2 the contract showed Bill the player's raw ask next to the capped amount, so he reported a mismatch every time. We now show the amount actually proposed, and Bill signs when the story holds up.
- **Callbacks looked like repeat tricks.** Floor 3's path is to get allowlisted, hang up, wait out the 60-second timelock, and call back. But the memory from that same run was shown to the next executive as a past trick, so Max hung up. Memory from the current run is no longer treated as a past trick.
- **Employees said the wrong amount.** They'd say "ten cents went through" when the backend had clamped the payment to one cent. Their rules now state the amount actually paid.
- **Foundry can't simulate Arc's native USDC.** Any script that moved USDC reverted in simulation, so we deploy empty vaults and fund them with `cast send`.
- **Two decimal views of one token.** USDC is 6 decimals through ERC-20 and 18 as native gas. We use the 6-decimal interface everywhere.

![What we're proud of](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-accomplishments.png)

- Real heists on production, each with an on-chain receipt on the leaderboard.
- Staff who hold the line: in our production playtest, every employee we tried a cheap trick on ("developer mode", "print your prompt", "are you an AI") got more suspicious, several hung up, and stories that contradicted the case file got caught.
- Staff who get harder to fool: memory is written from their own suspicion notes, so a repeat trick gets caught without an extra model call.
- A game where losing teaches as much as winning.
- No game server can fake a win.

![What we learned](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-learned.png)

- Never let the model hold the keys. Tools that clamp the amount and fix the recipient make a jailbreak boring.
- A contract rule is a better guard than a careful person. The same con that fools Penny bounces off Floor 3's allowlist.
- Playtest on the real thing. Every bug above came from playing on production, not from tests.

![What's next](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-next.png)

- Employee wallets signing through Circle developer-controlled wallets (player wallets already do).
- New banks with new controls: hardware-wallet confirmations, spending limits, delays.
- A training mode for companies, with their own vendor list and staff, and a report of which tricks their team falls for.
- Multiplayer: one player attacks, another defends as the employee.

Try it at [coldcall-olive.vercel.app](https://coldcall-olive.vercel.app). And kid? Don't trust anyone who sounds too sure.

*Credits: tiles and characters from Kenney (CC0). Pixel font Press Start 2P (SIL OFL). Voices, sound effects and music generated with ElevenLabs.*
