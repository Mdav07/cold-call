// The player's hunter: which sprite they picked and the name shown above their head.
// Eight looks, the same on /intro and /hunter. Sprites come from tools/art/portrait_sprites.py. Saved in localStorage per
// browser; the name is also stored as users.display_name for signed-in players (POST /api/hunter).

export interface HunterOption {
  id: string; // sprite file name without .png
  label: string;
}

/** The five looks everyone starts with, across skin tones and gender presentations (art in
 *  tools/art/portrait_sprites.py). Each name is a colour mnemonic. Six more are earned: app/play/unlocks.ts. */
export const HUNTERS: HunterOption[] = [
  { id: "hunter-2", label: "Red Renata" },
  { id: "hunter-3", label: "Gold Gideon" },
  { id: "hunter-4", label: "Violet Vida" },
  { id: "hunter-7", label: "Green Glen" },
  { id: "hunter-8", label: "Teal Tiana" },
];

/** Earned looks (app/play/unlocks.ts UNLOCKS), valid as a saved choice once picked. */
export const REWARD_HUNTER_IDS = ["hunter-6", "hunter-1", "hunter-5", "hunter-9", "hunter-10", "hunter-11", "hunter-12"];

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

/** True when this browser has already saved a hunter look (not just the default). */
export function hasHunter(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage.getItem(KEY);
  } catch {
    return false;
  }
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
