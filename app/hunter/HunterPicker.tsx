"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { UNLOCKS, useProgress } from "@/app/play/unlocks";
import { StreakBadge } from "@/app/play/StreakBadge";
import { cleanName, DEFAULT_HUNTER, getHunter, HUNTERS, MAX_NAME, saveHunter, spriteUrl, type HunterChoice } from "@/app/play/hunters";
import { AccountBox } from "./AccountBox";

/** One hunter's sprite: the idle front frame of the 16x32 sheet, scaled up crisply. */
function SpriteFace({ sprite, size = 4 }: { sprite: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block"
      style={{
        width: 16 * size,
        height: 32 * size,
        backgroundImage: `url(${spriteUrl(sprite)})`,
        backgroundSize: `${64 * size}px ${128 * size}px`,
        backgroundPosition: "0 0",
        imageRendering: "pixelated",
      }}
    />
  );
}

// The saved choice, read from localStorage after hydration (null on the server).
const noop = () => () => {};
const snapshot = () => JSON.stringify(getHunter());

export function HunterPicker() {
  const saved = useSyncExternalStore(noop, snapshot, () => null);
  // Remount the form once the saved choice is known, so it starts from it.
  return <PickerForm key={saved ?? "server"} initial={saved ? (JSON.parse(saved) as HunterChoice) : null} />;
}

function PickerForm({ initial }: { initial: HunterChoice | null }) {
  const router = useRouter();
  const [sprite, setSprite] = useState(initial?.sprite ?? DEFAULT_HUNTER.sprite);
  const [name, setName] = useState(initial && initial.name !== "Hunter" ? initial.name : "");
  const [saving, setSaving] = useState(false);
  const progress = useProgress();

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const clean = cleanName(name) || "Hunter";
    saveHunter({ sprite, name: clean });
    // Signed-in players also get it as their leaderboard name; anonymous players just keep it locally.
    fetch("/api/hunter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: clean }),
    }).catch(() => {});
    // Sign-in lives on AccountBox / /signin — don't re-ask after every profile save.
    router.push("/tower");
  };

  return (
    <form
      className="pixel-frame flex w-full max-w-xl flex-col gap-5 bg-[var(--cc-panel)] p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <header className="-mx-6 -mt-6 border-b-4 border-[var(--cc-edge)] bg-[var(--cc-accent)] px-6 pb-3 pt-4 text-[var(--cc-edge)]">
        <h1 className="font-pixel text-lg">Profile</h1>
        <p className="mt-2 font-pixel text-[9px] leading-relaxed">Your account, your look and your name. Your name floats over your head on every floor.</p>
      </header>

      <AccountBox />

      <fieldset>
        <legend className="mb-3 font-pixel text-xs text-[var(--cc-ink)]">Look</legend>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {HUNTERS.map((h) => (
            <label
              key={h.id}
              className={`pixel-frame flex cursor-pointer flex-col items-center gap-1 bg-[var(--cc-panel-2)] p-2 ${
                sprite === h.id ? "outline outline-2 outline-[var(--cc-accent)]" : ""
              }`}
            >
              <input
                type="radio"
                name="look"
                value={h.id}
                checked={sprite === h.id}
                onChange={() => setSprite(h.id)}
                className="sr-only"
              />
              <SpriteFace sprite={h.id} size={2} />
              <span className="w-full text-center text-[11px] leading-tight text-[var(--cc-muted)] [overflow-wrap:anywhere] [hyphens:auto]">{h.label}</span>
            </label>
          ))}
          {UNLOCKS.map((r) => {
            const open = !!progress && r.earned(progress);
            return (
              <label
                key={r.sprite}
                title={open ? `Earned: ${r.long ?? r.how}` : `Locked: ${r.long ?? r.how}`}
                className={`pixel-frame flex flex-col items-center gap-1 bg-[var(--cc-panel-2)] p-2 ${
                  open ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                } ${sprite === r.sprite ? "outline outline-2 outline-[var(--cc-accent)]" : ""}`}
              >
                <input
                  type="radio"
                  name="look"
                  value={r.sprite}
                  checked={sprite === r.sprite}
                  disabled={!open}
                  onChange={() => setSprite(r.sprite)}
                  className="sr-only"
                />
                <span className={open ? "" : "grayscale"}>
                  <SpriteFace sprite={r.sprite} size={2} />
                </span>
                <span className="text-center text-[11px] leading-tight text-[var(--cc-muted)]">
                  {open ? r.label : `🔒 ${r.how}`}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* How to earn the locked looks: the Daily Case streak. */}
      <div className="border-t-2 border-dashed border-[var(--cc-edge)] pt-4">
        <StreakBadge variant="full" />
      </div>

      <div className="flex items-end gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <label className="font-pixel text-xs text-[var(--cc-ink)]" htmlFor="hunter-name">
            Name
          </label>
          <input
            id="hunter-name"
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hunter"
            autoComplete="nickname"
            className="pixel-frame bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)] outline-none"
          />
        </div>
        <div className="flex flex-col items-center" aria-label="Preview">
          <span className="font-pixel text-[9px] text-[var(--cc-ink)]">{cleanName(name) || "Hunter"}</span>
          <SpriteFace sprite={sprite} size={3} />
        </div>
      </div>

      <button type="submit" className="pixel-button self-start" disabled={saving}>
        {saving ? "Saving…" : "Save and enter the tower"}
      </button>
    </form>
  );
}
