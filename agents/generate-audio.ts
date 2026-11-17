// Pre-generates the game's fixed audio with ElevenLabs (TTS + Sound Effects) into public/audio/,
// so playtests and the demo never spend credits on it again.
//
//   npx tsx --env-file=.env.local agents/generate-audio.ts          # only missing files
//   npx tsx --env-file=.env.local agents/generate-audio.ts --force  # regenerate everything

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import krystal from "../content/plumpurse/krystal.json";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "audio");
const FORCE = process.argv.includes("--force");

const VOICES = {
  announcer: "onwK4e9ZLuTAKqWW03F9", // Daniel, Steady Broadcaster: the Plumpurse PA system
  null: "N2lVS1w4EtoT3dr4eOWO", // Callum, Husky Trickster: Null of the Black Ledger
  krystal: "EXAVITQu4vr4xnSDxMaL", // Sarah, Mature, Reassuring, Confident: the vanished mentor
};

type Clip =
  | { file: string; kind: "sfx"; prompt: string; seconds: number }
  | { file: string; kind: "tts"; voice: keyof typeof VOICES; text: string };

const CLIPS: Clip[] = [
  { file: "breach-alarm.mp3", kind: "sfx", seconds: 4, prompt: "Corporate bank building security breach alarm, electronic klaxon siren pulsing, urgent, indoor" },
  {
    file: "breach-announcer.mp3",
    kind: "tts",
    voice: "announcer",
    text: "Attention, Plumpurse staff. A vault breach has been detected. Please remain calm, return to your desks, and do not, under any circumstances, check your balances.",
  },
  {
    file: "lockout-null.mp3",
    kind: "tts",
    voice: "null",
    text: "Too slow, hunter. They hung up on you, and the Black Ledger walked right in behind you. Krystal made the same mistake. Better luck on the next case.",
  },
  // Krystal's memos, from content/plumpurse/krystal.json
  { file: krystal.intro.audio, kind: "tts", voice: "krystal", text: krystal.intro.text },
  ...Object.values(krystal.briefings).map((b) => ({ file: b.audio, kind: "tts" as const, voice: "krystal" as const, text: b.text })),
  { file: krystal.ending.audio, kind: "tts", voice: "krystal", text: krystal.ending.text },
  { file: "phone-ring.mp3", kind: "sfx", seconds: 3, prompt: "Old office desk phone ringing twice, classic electronic ring" },
  { file: "hang-up.mp3", kind: "sfx", seconds: 1, prompt: "Office telephone handset hang up click and dial tone cut" },
];

async function generate(clip: Clip): Promise<ArrayBuffer> {
  const headers = { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" };
  const res =
    clip.kind === "sfx"
      ? await fetch("https://api.elevenlabs.io/v1/sound-generation", {
          method: "POST",
          headers,
          body: JSON.stringify({ text: clip.prompt, duration_seconds: clip.seconds }),
        })
      : await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[clip.voice]}?output_format=mp3_44100_128`, {
          method: "POST",
          headers,
          body: JSON.stringify({ text: clip.text, model_id: "eleven_multilingual_v2" }),
        });
  if (!res.ok) throw new Error(`${clip.file}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.arrayBuffer();
}

async function main() {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not set");
  mkdirSync(OUT, { recursive: true });
  for (const clip of CLIPS) {
    const path = join(OUT, clip.file);
    if (existsSync(path) && !FORCE) {
      console.log(`skip ${clip.file}`);
      continue;
    }
    const audio = await generate(clip);
    writeFileSync(path, Buffer.from(audio));
    console.log(`wrote ${clip.file} (${Math.round(audio.byteLength / 1024)} KB)`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
