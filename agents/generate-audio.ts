// Pre-generates the game's fixed audio with ElevenLabs (TTS + Sound Effects + Music) into public/audio/,
// so playtests and the demo never spend credits on it again.
//
//   npx tsx --env-file=.env.local agents/generate-audio.ts          # only missing files
//   npx tsx --env-file=.env.local agents/generate-audio.ts --force  # regenerate everything

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import krystal from "../content/plumpurse/krystal.json";
import seasons from "../content/seasonal/seasons.json";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "audio");
const FORCE = process.argv.includes("--force");

const VOICES = {
  announcer: "onwK4e9ZLuTAKqWW03F9", // Daniel, Steady Broadcaster: the Plumpurse PA system
  null: "N2lVS1w4EtoT3dr4eOWO", // Callum, Husky Trickster: Null of the Black Ledger
  krystal: "EXAVITQu4vr4xnSDxMaL", // Sarah, Mature, Reassuring, Confident: the vanished mentor
  helper: "TX3LPaxmHKxFdv7VOQHJ", // Liam: young, energetic; the seasonal case's scripted helper (Dev the sous-chef)
};

type Clip =
  | { file: string; kind: "sfx"; prompt: string; seconds: number }
  | { file: string; kind: "tts"; voice: keyof typeof VOICES; text: string }
  | { file: string; kind: "music"; prompt: string; music_length_ms: number };

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
  // Ending cutscene: one clip per on-screen beat so /ending can pause between screens.
  ...((krystal.ending as { cutscene?: { scenes?: { text: string; audio?: string }[]; tease?: string; teaseAudio?: string } }).cutscene?.scenes ?? [])
    .filter((s): s is { text: string; audio: string } => !!s.audio)
    .map((s) => ({ file: s.audio, kind: "tts" as const, voice: "krystal" as const, text: s.text })),
  ...(() => {
    const c = (krystal.ending as { cutscene?: { tease?: string; teaseAudio?: string } }).cutscene;
    return c?.teaseAudio && c.tease ? [{ file: c.teaseAudio, kind: "tts" as const, voice: "krystal" as const, text: c.tease }] : [];
  })(),
  // Seasonal helpers' lines (content/seasonal/seasons.json), so the scripted second person speaks too.
  ...seasons.seasons.flatMap((s) => {
    const h = (s as { helper?: { dialogue?: { line: string; audio?: string }[] } }).helper;
    return (h?.dialogue ?? []).flatMap((l) => (l.audio ? [{ file: l.audio, kind: "tts" as const, voice: "helper" as const, text: l.line }] : []));
  }),
  { file: "phone-ring.mp3", kind: "sfx", seconds: 3, prompt: "Old office desk phone ringing twice, classic electronic ring" },
  { file: "hang-up.mp3", kind: "sfx", seconds: 1, prompt: "Office telephone handset hang up click and dial tone cut" },
  // Background loops for the title screen and each floor (instrumental only, seamless).
  {
    file: "music-title.mp3",
    kind: "music",
    music_length_ms: 30000,
    prompt:
      "Original instrumental 30-second seamless loop, no vocals: mysterious heist theme, chiptune noir, low pulse, tense curiosity, 8-bit noir atmosphere",
  },
  {
    file: "music-floor-0.mp3",
    kind: "music",
    music_length_ms: 30000,
    prompt:
      "Original instrumental 30-second seamless loop, no vocals: sleepy closing-time lounge, soft bass, muted keys, end-of-day bank branch mood",
  },
  {
    file: "music-floor-1.mp3",
    kind: "music",
    music_length_ms: 30000,
    prompt:
      "Original instrumental 30-second seamless loop, no vocals: drab quirky office underscore, light percussion, slightly offbeat, fluorescent hum vibe",
  },
  {
    file: "music-floor-2.mp3",
    kind: "music",
    music_length_ms: 30000,
    prompt:
      "Original instrumental 30-second seamless loop, no vocals: tidy corporate and tense, clean synth pads, restrained rhythm, management-floor pressure",
  },
  {
    file: "music-floor-3.mp3",
    kind: "music",
    music_length_ms: 30000,
    prompt:
      "Original instrumental 30-second seamless loop, no vocals: gilded executive suite suspense, elegant low strings and soft brass, luxury with threat underneath",
  },
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
      : clip.kind === "music"
        ? await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
            method: "POST",
            headers,
            body: JSON.stringify({ prompt: clip.prompt, music_length_ms: clip.music_length_ms }),
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
