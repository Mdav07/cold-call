"use client";

// Closing cutscene after Floor 3: Krystal's trail seemed to end in the tower, then turns toward
// Fatwallet Federal (Case 2, coming soon). Same click-through rhythm as /intro. Audio is the
// pre-generated memo in public/audio/krystal-ending.mp3.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PORTRAITS } from "@/app/play/portraits";
import { useTypewriter } from "@/app/floor/dialogue/useTypewriter";
import { themeFor, themeVars } from "@/app/floor/dialogue/themes";
import { blip, confirm, tick, voicePitch } from "@/app/floor/hud/sound";
import krystal from "@/content/plumpurse/krystal.json";
import { CoinLogo } from "@/app/play/CoinLogo";

type Scene = { speaker: "Krystal" | null; text: string };

type EndingScript = {
  scenes: Scene[];
  tease: string;
  next: string;
};

const FALLBACK: EndingScript = {
  scenes: [
    { speaker: null, text: "You cracked every vault in Plumpurse Tower. Krystal's trail led you here — and then it went quiet." },
    { speaker: "Krystal", text: "Good job, kid. Their next target is Fatwallet Federal. Get there first." },
  ],
  tease: "Case 2: Fatwallet Federal. Coming soon.",
  next: "Back to the lobby.",
};

const SCRIPT: EndingScript =
  (krystal as { ending?: { cutscene?: EndingScript } }).ending?.cutscene ?? FALLBACK;

const ENDING_AUDIO = (krystal as { ending?: { audio?: string } }).ending?.audio ?? "krystal-ending.mp3";

function markSeen() {
  try {
    localStorage.setItem("cc-ending-seen", "1");
  } catch {
    // private window: skip; the lobby redirect will try again next visit
  }
}

/** One beat, typed out with Krystal's (or the narrator's) voice blips — same feel as the intro. */
function Beat({ speaker, text, onTyped }: { speaker: "Krystal" | null; text: string; onTyped: (skip: () => void, done: boolean) => void }) {
  const line = speaker ? `“${text}”` : text;
  const { visible, done, skip } = useTypewriter(line, 45);
  const n = visible.length;
  useEffect(() => {
    if (!done && n % 2 === 0 && /\S/.test(line[n - 1] ?? "")) blip(speaker ? voicePitch("krystal") : 220);
  }, [n, done, line, speaker]);
  useEffect(() => onTyped(skip, done), [skip, done, onTyped]);
  const Face = PORTRAITS.krystal;
  const t = themeFor("krystal");
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center" style={themeVars(t)}>
      {speaker && Face && (
        <div className="flex flex-col items-center gap-2">
          <div
            className="pixel-frame grid h-24 w-24 place-items-center overflow-hidden bg-[var(--cc-portrait)] sm:h-32 sm:w-32 [&>svg]:h-full [&>svg]:w-full"
            style={{ borderColor: t.border }}
          >
            <Face mood="convinced" />
          </div>
          <p className="flex items-center border-2 px-3 py-1 font-pixel text-[10px] leading-none text-[var(--cc-edge)]" style={{ background: t.tag, borderColor: t.border }}>
            Krystal Klear
          </p>
        </div>
      )}
      <p className={`max-w-2xl font-pixel leading-[1.9] text-[var(--cc-ink)] ${speaker ? "text-[15px] sm:text-xl" : "text-[14px] text-[#cfd8e3] sm:text-lg"}`} aria-live="polite">
        {visible}
        {!done && <span className="opacity-0">{line.slice(n)}</span>}
        {done && (
          <span aria-hidden className="cc-next ml-3 align-middle text-sm text-[var(--cc-accent)]">
            ▼
          </span>
        )}
      </p>
    </div>
  );
}

export function Ending() {
  const router = useRouter();
  const beats = SCRIPT.scenes;
  const screens = beats.length + 1; // scenes, then the tease card
  const [i, setI] = useState(0);
  const typed = useRef<{ skip: () => void; done: boolean }>({ skip: () => {}, done: true });
  const onTyped = useCallback((skip: () => void, done: boolean) => {
    typed.current = { skip, done };
  }, []);
  const [leaving, setLeaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const clip = new Audio(`/audio/${ENDING_AUDIO}`);
    audioRef.current = clip;
    void clip.play().catch(() => {});
    return () => {
      clip.pause();
      audioRef.current = null;
    };
  }, []);

  const finish = useCallback(() => {
    if (leaving) return;
    confirm();
    markSeen();
    setLeaving(true);
    audioRef.current?.pause();
    router.push("/tower");
  }, [leaving, router]);

  const advance = useCallback(() => {
    if (i < beats.length && !typed.current.done) return typed.current.skip();
    tick();
    if (i < screens - 1) setI(i + 1);
    else finish();
  }, [i, beats.length, screens, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        advance();
      } else if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [advance, finish]);

  return (
    <main className="cc-floor-1 relative flex min-h-dvh flex-1 flex-col bg-[#15141a]">
      <div className="flex items-center justify-between p-3 sm:p-4">
        <p className="flex items-center gap-2 font-pixel text-[9px] tracking-widest text-[var(--cc-muted)]">
          <CoinLogo size={16} />
          COLD CALL · KRYSTAL&apos;S TRAIL
        </p>
        <button type="button" className="pixel-button !px-3 !py-1.5" onClick={finish} disabled={leaving}>
          Skip ▶▶
        </button>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={advance}
        aria-label={i < screens - 1 ? "Next" : "Back to the lobby"}
        className="flex flex-1 cursor-pointer flex-col items-center justify-center px-5 pb-6 outline-none"
      >
        {i < beats.length ? (
          <Beat key={i} speaker={beats[i].speaker} text={beats[i].text} onTyped={onTyped} />
        ) : (
          <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
            <p className="font-pixel text-[10px] tracking-widest text-[var(--cc-accent)]">THE TRAIL CONTINUES</p>
            <p className="font-pixel text-[15px] leading-[1.9] text-[var(--cc-ink)] sm:text-xl">{SCRIPT.tease}</p>
            <p className="font-pixel text-[12px] leading-[1.9] text-[var(--cc-muted)] sm:text-sm">{SCRIPT.next}</p>
            <span className="pixel-button">{leaving ? "…" : "Back to the lobby ▶"}</span>
          </div>
        )}
      </div>
      <div className="flex justify-center gap-2 pb-6" aria-hidden>
        {Array.from({ length: screens }, (_, k) => (
          <span key={k} className={`h-2 w-2 ${k === i ? "bg-[var(--cc-accent)]" : "bg-[var(--cc-panel-2)]"}`} />
        ))}
      </div>
    </main>
  );
}
