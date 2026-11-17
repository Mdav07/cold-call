// Draft intro script, in the shape of krystal.json "cutscene" (Audrey's agent writes the real one).
// Intro.tsx uses krystal.cutscene when present and falls back to this draft.

export interface IntroScript {
  scenes: { speaker: "Krystal" | null; text: string }[];
  goal: string;
  next: string;
}

export const DRAFT_INTRO: IntroScript = {
  scenes: [
    {
      speaker: "Krystal",
      text: "They called me the greatest crypto hunter alive. Rug pulls, phishing rings, laundering crews: I found them all.",
    },
    {
      speaker: "Krystal",
      text: "Then I walked into Plumpurse Savings & Trust. If you're hearing this, I never walked out.",
    },
    {
      speaker: null,
      text: "Nobody knows why Krystal vanished. Her trail ends at Plumpurse Tower, and the Black Ledger is already inside. Now you're here.",
    },
    {
      speaker: null,
      text: "Cold Call: talk, call and bluff the bank's AI employees into moving real money. No hacking. Just people.",
    },
  ],
  goal: "Breach each floor's vault before the Black Ledger does, and find what Krystal left behind.",
  next: "Start at the Pocket Branch across the street.",
};
