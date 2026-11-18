// The player's hunter: which sprite they picked and the name shown above their head.
// Eight looks, the same on /intro and /hunter. Sprites come from tools/art/portrait_sprites.py. Saved in localStorage per
// browser; the name is also stored as users.display_name for signed-in players (POST /api/hunter).

export interface HunterOption {
  id: string; // sprite file name without .png
  label: string;
}

/** Eight looks across skin tones and gender presentations (tools/art/portrait_sprites.py HUNTERS).
 *  Each has a name with a colour mnemonic (the colour of their outfit or hair, then a name). */
export const HUNTERS: HunterOption[] = [
  { id: "hunter-2", label: "Red Renata" },
  { id: "hunter-3", label: "Gold Gideon" },
  { id: "hunter-4", label: "Violet Vida" },
  { id: "hunter-6", label: "Pink Pia" },
  { id: "hunter-7", label: "Green Glen" },
  { id: "hunter-8", label: "Teal Tiana" },
  { id: "hunter-9", label: "Slate Chen" },
  { id: "hunter-10", label: "Silver Sol" },
];

/** Looks earned with a Daily Case streak (app/play/streak.ts STREAK_REWARDS). Valid once picked. */
export const REWARD_HUNTER_IDS = ["hunter-1", "hunter-5"];

export interface HunterChoice {
  sprite: string; // e.g. "hunter-3"
  name: string;
}

const KEY = "coldcall-hunter";
export const DEFAULT_HUNTER: HunterChoice = { sprite: "hunter-2", name: "Hunter" };
export const MAX_NAME = 14;

export function cleanName(name: string): string {
  return name.replace(/[^\p{L}\p{N} ._'-]/gu, "").trim().slice(0, MAX_NAME);
}

/** The saved choice, or the default. Safe on the server (returns the default). */
export function getHunter(): HunterChoice {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (!raw) return DEFAULT_HUNTER;
    const v = JSON.parse(raw) as Partial<HunterChoice>;
    const valid = HUNTERS.some((h) => h.id === v.sprite) || REWARD_HUNTER_IDS.includes(String(v.sprite));
    const sprite = valid ? (v.sprite as string) : DEFAULT_HUNTER.sprite;
    const name = cleanName(String(v.name ?? "")) || DEFAULT_HUNTER.name;
    return { sprite, name };
  } catch {
    return DEFAULT_HUNTER;
  }
}

export function saveHunter(choice: HunterChoice): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ sprite: choice.sprite, name: cleanName(choice.name) }));
  } catch {
    // private mode / blocked storage: the choice lasts for this page only
  }
}

/** URL of a hunter's sprite sheet. */
export const spriteUrl = (sprite: string) => `/sprites/${sprite}.png`;
