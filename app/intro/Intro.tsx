"use client";

// The opening for a first-time player: Krystal's cutscene in a few click-through screens, then
// "Pick your hunter", then the lobby. All text in the pixel font, typed out like the dialogue box.
// The hunters are Audrey's (app/play/hunters.ts); the choice is saved with saveHunter, plus
// cc-player-sprite (sprite path) and cc-intro-seen in localStorage.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PORTRAITS } from "@/app/play/portraits";
import { useTypewriter } from "@/app/floor/dialogue/useTypewriter";
import { themeFor, themeVars } from "@/app/floor/dialogue/themes";
import { blip, confirm, tick, voicePitch } from "@/app/floor/hud/sound";
import krystal from "@/content/plumpurse/krystal.json";
import { DRAFT_INTRO, type IntroScript } from "./script";
import { HUNTERS, MAX_NAME, cleanName, saveHunter, spriteUrl } from "@/app/play/hunters";
import { SaveProgress } from "@/app/play/SaveProgress";

// Audrey's script lives in krystal.json under "cutscene"; the draft covers builds before it lands.
const SCRIPT: IntroScript = (krystal as { cutscene?: IntroScript }).cutscene ?? DRAFT_INTRO;

/** The same four looks as /hunter (app/play/hunters.ts). */
const PICKS = HUNTERS;

function save(sprite: string, name: string) {
  const clean = cleanName(name) || "Hunter";
  saveHunter({ sprite, name: clean });
  try {
    localStorage.setItem("cc-player-sprite", spriteUrl(sprite));
    localStorage.setItem("cc-intro-seen", "1");
  } catch {
    // private window or blocked storage: the game falls back to the default hunter
  }
  // Signed-in players also get the name on the leaderboard (as in /hunter); best effort.
  fetch("/api/hunter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: clean }),
  }).catch(() => {});
}

/** A walking sprite preview: the down-facing row of a 64x128 sheet (4 frames of 16x32), scaled. */
export function Walker({ sprite, scale = 4, walking = true }: { sprite: string; scale?: number; walking?: boolean }) {
  return (
    <div
      aria-hidden
      className={walking ? "cc-walk" : undefined}
      style={
        {
          width: 16 * scale,
          height: 32 * scale,
          backgroundImage: `url(${sprite})`,
          backgroundSize: `${64 * scale}px ${128 * scale}px`,
          backgroundPosition: "0 0",
          imageRendering: "pixelated",
          "--cc-walk-w": `${-64 * scale}px`,
        } as React.CSSProperties
      }
    />
  );
}

/** One beat of the cutscene, typed out with Krystal's (or the narrator's) voice blips. */
function Beat({ speaker, text, onTyped }: { speaker: "Krystal" | null; text: string; onTyped: (skip: () => void, done: boolean) => void }) {
  // Quotes are part of the typed line so the closer doesn't sit there while the sentence is still rolling.
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
          <div className="pixel-frame grid h-24 w-24 place-items-center overflow-hidden bg-[var(--cc-portrait)] sm:h-32 sm:w-32 [&>svg]:h-full [&>svg]:w-full" style={{ borderColor: t.border }}>
            <Face mood="neutral" />
          </div>
          <p className="flex items-center border-2 px-3 py-1 font-pixel text-[10px] leading-none text-[var(--cc-edge)]" style={{ background: t.tag, borderColor: t.border }}>
            Krystal Klear
          </p>
        </div>
      )}
      <p className={`max-w-2xl font-pixel leading-[1.9] text-[var(--cc-ink)] ${speaker ? "text-[15px] sm:text-xl" : "text-[14px] text-[#cfd8e3] sm:text-lg"}`} aria-live="polite">
        {visible}
        {!done && <span className="opacity-0">{line.slice(n)}</span>}
        {done && <span aria-hidden className="cc-next ml-3 align-middle text-sm text-[var(--cc-accent)]">▼</span>}
      </p>
    </div>
  );
}

export function Intro() {
  const router = useRouter();
  const beats = SCRIPT.scenes;
  const screens = beats.length + 1; // the scenes, then the job
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<"story" | "pick" | "save">("story");
  const typed = useRef<{ skip: () => void; done: boolean }>({ skip: () => {}, done: true });
  const onTyped = useCallback((skip: () => void, done: boolean) => {
    typed.current = { skip, done };
  }, []);
  const [picked, setPicked] = useState<string | null>(PICKS[0]?.id ?? null);
  const [name, setName] = useState("");
  const [leaving, setLeaving] = useState(false);
  const firstCard = useRef<HTMLButtonElement>(null);

  const advance = useCallback(() => {
    if (stage !== "story") return;
    if (i < beats.length && !typed.current.done) return typed.current.skip(); // finish the line first
    tick();
    if (i < screens - 1) setI(i + 1);
    else setStage("pick");
  }, [stage, i, beats.length, screens]);

  useEffect(() => {
    if (stage !== "story") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      // Don't steal typing from inputs; Skip has its own button.
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      if (e.key === "Enter" || e.key === " ") {
        // preventDefault stops a focused <button> from also synthesizing a click (double-advance).
        e.preventDefault();
        e.stopPropagation();
        advance();
      } else if (e.key === "Escape") setStage("pick");
    };
    // Capture so we win over the big stage control.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [stage, advance]);

  useEffect(() => {
    if (stage === "pick") firstCard.current?.focus();
  }, [stage]);

  const enter = () => {
    if (!picked || leaving) return;
    confirm();
    setLeaving(true);
    save(picked, name);
    setStage("save"); // offer sign-in to keep progress, then the lobby
  };
  const toTower = useCallback(() => router.push("/tower"), [router]);

  return (
    <main className="cc-floor-1 relative flex min-h-dvh flex-1 flex-col bg-[#15141a]">
      {stage === "save" ? (
        <section className="flex flex-1 items-center justify-center p-4">
          <SaveProgress handle={cleanName(name) || "Hunter"} onContinue={toTower} />
        </section>
      ) : stage === "story" ? (
        <>
          <div className="flex items-center justify-between p-3 sm:p-4">
            <p className="font-pixel text-[9px] tracking-widest text-[var(--cc-muted)]">COLD CALL</p>
            <button type="button" className="pixel-button !px-3 !py-1.5" onClick={() => setStage("pick")}>
              Skip ▶▶
            </button>
          </div>
          {/* Click / tap the stage to advance; Enter and Space are handled on window (above). */}
          <div
            role="button"
            tabIndex={0}
            onClick={advance}
            aria-label={i < screens - 1 ? "Next" : "Pick your hunter"}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center px-5 pb-6 outline-none"
          >
            {i < beats.length ? (
              <Beat key={i} speaker={beats[i].speaker} text={beats[i].text} onTyped={onTyped} />
            ) : (
              <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
                <p className="font-pixel text-[10px] tracking-widest text-[var(--cc-accent)]">THE JOB</p>
                <p className="font-pixel text-[15px] leading-[1.9] text-[var(--cc-ink)] sm:text-xl">{SCRIPT.goal}</p>
                <p className="font-pixel text-[12px] leading-[1.9] text-[var(--cc-muted)] sm:text-sm">{SCRIPT.next}</p>
                <span className="pixel-button">Pick your hunter ▶</span>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2 pb-6" aria-hidden>
            {Array.from({ length: screens }, (_, k) => (
              <span key={k} className={`h-2 w-2 ${k === i ? "bg-[var(--cc-accent)]" : "bg-[var(--cc-panel-2)]"}`} />
            ))}
          </div>
        </>
      ) : (
        <section aria-labelledby="pick-title" className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 p-4 sm:p-8">
          <div className="text-center">
            <h1 id="pick-title" className="font-pixel text-lg text-[var(--cc-accent)] sm:text-2xl">
              Pick your hunter
            </h1>
            <p className="mt-3 font-pixel text-[10px] leading-relaxed text-[var(--cc-muted)]">You can change your look later.</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {PICKS.map((h, k) => (
              <li key={h.id}>
                <button
                  ref={k === 0 ? firstCard : undefined}
                  type="button"
                  onClick={() => {
                    tick();
                    setPicked(h.id);
                  }}
                  aria-pressed={picked === h.id}
                  aria-label={`Hunter ${k + 1}: ${h.label}`}
                  className={`flex h-full w-full flex-col items-center gap-3 border-2 bg-[var(--cc-panel)] p-3 text-center shadow-[4px_4px_0_0_var(--cc-edge)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-accent)] sm:p-4 ${
                    picked === h.id ? "border-[var(--cc-accent)] bg-[var(--cc-panel-2)]" : "border-[var(--cc-edge)] hover:border-[var(--cc-accent)]"
                  }`}
                >
                  <div className="grid h-[136px] w-full place-items-end justify-center bg-[var(--cc-bg)] pb-1">
                    <Walker sprite={spriteUrl(h.id)} scale={4} walking={picked === h.id} />
                  </div>
                  <span className={`font-pixel text-[10px] ${picked === h.id ? "text-[var(--cc-accent)]" : "text-[var(--cc-ink)]"}`}>
                    {picked === h.id ? "▶ " : ""}
                    {h.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mx-auto flex w-full max-w-md flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              enter();
            }}
          >
            <label htmlFor="hunter-name" className="font-pixel text-[10px] text-[var(--cc-muted)]">
              Your hunter name (optional)
            </label>
            <div className="flex gap-2">
              <input
                id="hunter-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME}
                placeholder="Hunter"
                autoComplete="nickname"
                className="pixel-frame min-w-0 flex-1 bg-[var(--cc-panel-2)] px-3 py-2 font-pixel text-xs text-[var(--cc-ink)] outline-none"
              />
              <button type="submit" className="pixel-button shrink-0" disabled={!picked || leaving}>
                Enter the tower ▶
              </button>
            </div>
            {!picked && <p className="font-pixel text-[9px] text-[var(--cc-muted)]">Pick a look first.</p>}
          </form>
        </section>
      )}
    </main>
  );
}
