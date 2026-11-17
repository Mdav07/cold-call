// Rival crews (owner B): fictional in-world competitors from content/plumpurse/rivals.json.
// They share the board with real hunters so there is always a time to beat, and every rival row
// is tagged as a rival. Real rows still come only from chain-confirmed breaches.
import data from "@/content/plumpurse/rivals.json";

export type Crew = (typeof data.crews)[number];

export type Rival = {
  id: string;
  name: string;
  crew: Crew;
  channel: "voice" | "chat";
  boss: boolean;
  duration_ms: number;
};

export const RIVALS_INTRO = data.intro;
export const CREWS: Crew[] = data.crews;

/** "m:ss" to milliseconds. */
const toMs = (t: string) => {
  const [m, s] = t.split(":").map(Number);
  return (m * 60 + s) * 1000;
};

/** The rivals' times on one floor, slowest first: the order you beat them in. */
export function ladderFor(floor: number): Rival[] {
  const crews = new Map(data.crews.map((c) => [c.id, c]));
  return data.rivals
    .map((r) => {
      const t = (r.times as Record<string, string | undefined>)[String(floor)];
      const crew = crews.get(r.crew);
      if (!t || !crew) return null;
      return {
        id: r.id,
        name: r.name,
        crew,
        channel: r.channel === "voice" ? "voice" : "chat",
        boss: "boss" in r && r.boss === true,
        duration_ms: toMs(t),
      } satisfies Rival;
    })
    .filter((r): r is Rival => r !== null)
    .sort((a, b) => b.duration_ms - a.duration_ms);
}
