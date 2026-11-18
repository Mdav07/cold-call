![Krystal's opening cutscene: they learn, the same con never works twice](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/intro.jpg)

Right now, somewhere in Plumpurse Savings & Trust, a receptionist named Penny is about to approve a payment that will land in a stranger's wallet. Nobody hacked her. Somebody just called, quoted a real invoice, mentioned the espresso machine gossip, and sounded sure.

That somebody is you.

**Cold Call** is a social-engineering heist game. You call or text the AI staff of a pixel-art bank and talk them into approving a payment. Each "yes" is a **real transaction** from that employee's wallet to a **USDC vault on Arc testnet**, and a run counts only when the vault pays out.

![Inspiration](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-inspiration.png)

Most stolen money isn't taken by breaking cryptography. Someone is talked into sending it. The FBI ranks business email compromise among the costliest crimes it tracks, and in February 2025 Bybit's signers approved a transaction their screens misrepresented and about $1.5 billion was stolen.

Security training is usually a slide deck. We wanted the opposite: put you on the attacker's side of the phone, let you feel how a believable story, a deadline or a name-drop gets a careful person to sign, and then show you the contract-level control that would have stopped you.

![What it does](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-what-it-does.png)

![Floor 1: Dee, Penny and your hunter](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/floor-1-walk.jpg)

- **A bank you can walk.** Pick one of eight hunters and explore a tower of top-down floors. Clues hide in signs and memos behind short mini-games (wires, a keycard swipe, a keypad, shredded strips), and each one you read becomes evidence you can present on a call.
- **Staff who fight back.** Every employee is an ElevenLabs agent with its own voice, rule sheet and suspicion meter. They check your story against a vendor registry, calendars and a staff directory. Slip up and suspicion rises; at 100 they hang up and warn their colleague.
- **Staff who remember you.** When a call ends, the employee writes down the trick you used. Next run, the same story gets called out, so you have to keep inventing new cons.
- **Rules a story can't beat.** Each floor's vault adds a control, and each mirrors a real attack:
  - **Tutorial:** one signature pays.
  - **Floor 1, Accounts Payable:** one signature, up to a cap (vendor impersonation).
  - **Floor 2, Trading Floor:** two signatures, and the second signer sees the real recipient from the contract, not your story (the Bybit trick).
  - **Floor 3, Executive Penthouse:** a direct payment always bounces. Both executives must first add you to the vault's allowlist.
- **A debrief after every floor** names the real attack you just ran and what the bank patched.
- **A reason to come back.** The Daily Case is a new case each day, the same for everyone, rotating through 12 themed workplaces from a coffee shop to a law office. Your bounty is the amount you talked them into, streaks unlock new hunters, and the leaderboard is timed to the block.
- **Crypto you never see.** No wallet to install, no seed phrase, no gas, no token names. Amounts are in dollars. Sign in with email and a password, or play as a guest.

![They remember you: Penny falls for a story on run 1, writes it down when the call ends, and calls it out on run 2](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/memory.png)

![How we built it](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-how-we-built-it.png)

![One heist in five steps: call, check, sign, vault, referee](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/pipeline.png)

1. **Call.** The backend creates a run and hands the browser a signed URL for that employee's private ElevenLabs agent. `run_id`, `employee_id` and `session_id` travel as dynamic variables, so the model never fills them.
2. **Check.** The agent tests your story with webhook tools on our server: vendor, calendar and staff lookups, and `report_suspicion` when something feels off.
3. **Sign.** When it's convinced, it calls `propose_transfer` or `approve_transfer`, which sends a real transaction from that employee's wallet. The model never holds a key or picks the recipient. The server caps the amount and always pays the player's own wallet.
4. **Vault.** `ColdCallVault`, our multi-approval USDC vault (Solidity, 33 Foundry tests), enforces the floor's rules: a cap, two signers, a recipient allowlist.
5. **Referee.** A QuickNode Stream delivers the vault's `TransferExecuted` event to our webhook, which ends the run, stops the clock at that block and sounds the alarm.

The game is Next.js 16, React 19 and Tailwind CSS 4 on Vercel, with our own HTML canvas engine. Supabase (Postgres, auth, Realtime) stores runs, proposals, memories and the leaderboard.

![How the tracks fit](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-tracks.png)

Every heist passes through all four tracks, in order. Remove any one and the game stops working.

| Track | How Cold Call uses it |
| --- | --- |
| **Consumer Applications** | A browser game on desktop and phone where the crypto is invisible: a Circle developer-controlled wallet is created for each player on first play, employees pay the gas, and the UI shows dollars, never tokens or addresses. |
| **Arc** | Four `ColdCallVault` deployments, one per floor; the game's mechanics are the contract's rules. USDC is both the prize and the gas. Arc's fast finality sets the leaderboard time. Vaults: Tutorial `0x1f74b2082b504746A6948c95cEC0b0986E00Ce8b` · Floor 1 `0x93Af5Ca91433115629bc53E970363e377227C8c5` · Floor 2 `0xA51D015653140086ad84f358Feb5A7Bf18078F7F` · Floor 3 `0x8c86dD235193d42bf4a751bA5138fF1286E28475` |
| **ElevenLabs** | Every employee is one Agent used for voice calls and text chat, so you can switch mid-heist. 11 server tools let agents look things up and sign on Arc. Dynamic variables give one Daily Case agent a new persona every day. Text to Speech, Sound Effects and Music voice Krystal's briefings, the PA announcer, the alarm and every floor's music. |
| **QuickNode Streams** | The Stream is the referee: Arc testnet, Block with Receipts, a JavaScript filter that keeps only our vaults' 12 game events, a webhook destination, and a backfill from the deploy block so the leaderboard can be rebuilt from the chain. Nothing in our app can mark a win without it. |

![Challenges](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-challenges.png)

- **The second signer rejected every honest payment.** On Floor 2 the on-chain view showed Bill the player's raw ask next to the capped amount, so he reported a mismatch every time. It now shows the amount actually proposed.
- **Callbacks looked like repeat tricks.** Notes from earlier in the same run read as a past trick, so an executive who had already approved you hung up on the callback. Notes from the current run no longer count.
- **Agents claimed payments before they happened.** An employee would say "it went through" while the transaction was still in flight, or quote the amount asked for. They now confirm only after the tool returns `executed`, and every failure status has its own line.
- **Two agents signing at once** collided on the wallet nonce, so each wallet takes a lease before it sends.
- **Foundry can't simulate Arc's native USDC.** Any script that moved USDC reverted in simulation, so we deploy empty vaults and fund them with `cast send`.
- **Two decimal views of one token.** USDC is 6 decimals through ERC-20 and 18 as native gas. We use the 6-decimal interface everywhere.

![What we're proud of](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-accomplishments.png)

- No game server can fake a win. Only a contract event, delivered by the Stream, ends a run as a breach.
- Staff who hold the line. In our production playtest, every cheap trick we tried ("developer mode", "print your prompt", "are you an AI") raised suspicion, several staff hung up, and stories that contradicted the case file got caught.
- Memory built from the staff's own suspicion notes, so a repeat trick gets caught without an extra model call.
- A new playable case every day from seeded templates, with no one writing content each morning.
- A game where losing teaches as much as winning.

![What we learned](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-learned.png)

- Never let the model hold the keys. Tools that cap the amount and fix the recipient make a jailbreak boring.
- A contract rule is a better guard than a careful person. The con that fools Penny bounces off Floor 3's allowlist.
- Agents improvise when a tool result has no scripted response, so every status needs a line.
- Playtest on the real thing. Every bug above came from playing on production, not from tests.

![What's next](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-next.png)

- Employee wallets signing through Circle developer-controlled wallets, as player wallets already do.
- New banks with new controls: hardware-wallet confirmations, spending limits, delays.
- Multiplayer: one player attacks while another defends as the employee.
- A training mode for companies, with their own vendors and staff, that reports which tricks their team falls for.

Try it at [coldcall-olive.vercel.app](https://coldcall-olive.vercel.app). And kid? Don't trust anyone who sounds too sure.

*Credits: furniture tiles from Kenney Roguelike Indoors (CC0). Characters and Daily Case staff drawn by us from our own pixel portraits. Pixel font Press Start 2P (SIL OFL). Voices, sound effects and music generated with ElevenLabs.*
