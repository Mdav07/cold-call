![Krystal's opening cutscene: they learn, the same con never works twice](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/intro.jpg)

**Cold Call** is a heist game where you talk AI bank employees into sending you money. Every employee is an ElevenLabs voice agent guarding a real USDC vault on Arc testnet. Call them, lie well, and when one says yes, a real transaction leaves the vault. Each floor's contract adds a rule that no story can talk its way past.

**▶ Play:** [coldcall-olive.vercel.app](https://coldcall-olive.vercel.app) (no wallet or account needed) · **Code:** [github.com/Mdav07/ubc](https://github.com/Mdav07/ubc)

![Inspiration](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-inspiration.png)

On October 29, 2026, about $6.3 billion was taken from Binance, the largest crypto theft on record. The FBI attributes it to North Korea's TraderTraitor group, and Binance says the attackers got in through phishing, not by breaking the wallets. In April, Drift's multisig signers were talked into pre-signing transactions that looked routine, and about $285 million was gone. Crypto is rarely stolen by cracking code anymore. People get talked into it.

And companies are now handing payments to AI agents. Those agents are the next ones to be talked into it. We wanted a way to feel that attack from the inside, and to test how well an AI employee holds up against it.

![What it does](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-what-it-does.png)

![Talking to Dee: portrait, Talk, Call, Case file, Leave, suspicion meter](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/dee-dialogue.jpg)

- **Walk a bank, read the room.** Explore a pixel-art tower floor by floor. Clues hide behind quick mini-games, and each becomes evidence you can show mid-call.
- **Talk your way in, by voice or text.** Each employee checks your story against a vendor registry, calendars and a staff directory. A suspicion meter reacts live; at 100 they hang up and security walks you out.
- **The contract fights back.** Floor 1 pays on one signature. Floor 2 needs two, and the second signer sees the real recipient from the contract, not your story. Floor 3 bounces any payment until both executives allowlist you.
- **They remember you.** Sign in, and an employee writes down the trick that fooled them. Use it again and it backfires.
- **A reason to come back.** A new Daily Case every day across 12 workplaces, ten holiday cases with their own rooms, weather and two voiced signers, streaks, earnable hunters and a leaderboard timed to the block. It plays like a handheld console on your phone.

![How we built it](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-how-we-built-it.png)

**Voice call → ElevenLabs agent → our tool server → `ColdCallVault` on Arc → `TransferExecuted` → QuickNode Stream → breach screen**

![One heist in five steps: call, check, sign, vault, referee](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/pipeline.png)

- **ElevenLabs:** nine agents (seven staff, one Daily Case persona, one holiday co-signer) handle voice and chat. Dynamic variables carry run IDs, memory and each day's persona. 11 server tools handle lookups, suspicion and signing, and each holiday character gets a matching voice. Text to Speech, Sound Effects and Music voice Krystal, the alarm and the floor themes.
- **Arc:** `ColdCallVault` (Solidity, 33 Foundry tests) enforces each floor's rule: a per-transfer cap, a second signer, a recipient allowlist. USDC is both the prize and the gas. Four vaults are live on Arc testnet.
- **QuickNode Streams:** the referee. A filtered Stream of our vaults' 12 events posts `TransferExecuted` to our webhook. Nothing in our app can mark a win; only the contract event can.
- **Consumer UX:** no wallet, seed phrase or gas. A Circle developer-controlled wallet is created for each player, employees pay the gas, and every amount is in dollars. Next.js 16 on Vercel, Supabase for runs, memory and the leaderboard.

## Why it stands out

- **The AI agents are the target, not the feature.** Most crypto-and-AI projects give an agent a wallet and trust it. We give agents a wallet and then try to con them, which is the attack that actually empties wallets today.
- **The contract is the safety net the AI can't be.** A model can be sweet-talked; a two-signer vault and an allowlist can't. Each floor shows exactly which on-chain control stops which con.
- **A referee nobody can fake.** Wins are decided by a contract event delivered by a Stream, not by our server, and every breach links to its transaction on the Arc explorer.
- **Every sponsor is load-bearing.** Remove ElevenLabs, Arc or QuickNode and the game stops working.
- **It's a real consumer game.** A daily case, holiday events, streaks and a leaderboard bring players back, and none of them ever see a wallet.

![Challenges](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-challenges.png)

- **Agents that sign.** Letting a model move money safely meant it never holds a key or picks the recipient. Our tools cap the amount and always pay the player's own wallet, so a jailbreak gets you nothing extra.
- **A second signer that checks the truth.** Floor 2's signer first rejected every honest payment, because the on-chain view showed the raw ask instead of the capped amount. Playtesting caught it.
- **Memory a small model actually uses.** A note in the prompt wasn't enough, since the employee still fell for the same trick. Now the server turns a repeated compliment or name-drop into suspicion, and case evidence never counts, so every floor stays beatable.
- **Arc's dual-decimal USDC** (6 decimals as a token, 18 as gas) and Foundry's lack of native-USDC simulation. We use the 6-decimal interface everywhere and fund vaults after deploying.

![What we're proud of](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-accomplishments.png)

- Every one of the 30 holiday layouts was played to a real on-chain payout by the live agents.
- A case checker runs before every build: it plays a year of Daily Cases and every holiday layout on paper, and fails the build if any is unwinnable.
- Staff who hold the line: "developer mode", "print your prompt" and "are you an AI" all raise suspicion instead of working.

![What we learned](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-learned.png)

- Never let the model hold the keys. Tools that cap the amount and fix the recipient make a jailbreak boring.
- A contract rule beats a careful person. The con that fools Penny bounces off Floor 3's allowlist.
- Playtest on the real thing. Almost every bug we fixed came from playing on production, not from tests.

![What's next](https://raw.githubusercontent.com/Mdav07/ubc/main/docs/devpost/h-next.png)

- **Multiplayer heists:** one player runs the con while another defends as the employee, live, and crews work the two-signer floors together.
- **New banks, new controls:** hardware-wallet confirmations, spending limits and time delays, each a new floor to beat.
- **Employee wallets on Circle** developer-controlled wallets, as player wallets already are.

**FAQ**

- **Is the money real?** It's real USDC transactions on Arc testnet, so it has no cash value. Your first clear of each level pays its bounty on chain, and repeats pay a 1¢ token.
- **Can I jailbreak the AI?** The model never holds a key or picks the recipient, prompt tricks raise suspicion, and on Floors 2 and 3 the contract still needs a second signer.
- **Is this teaching people to scam?** It teaches them to spot one. Every con is a documented attack, each floor's debrief names the control that stops it, and the targets are fictional.

More detail, architecture and contract addresses are in the [README](https://github.com/Mdav07/ubc#readme). And kid? Don't trust anyone who sounds too sure.

*Credits: furniture tiles from Kenney Roguelike Indoors (CC0). Characters drawn by us. Press Start 2P (SIL OFL). Voices, sound effects and music generated with ElevenLabs.*
