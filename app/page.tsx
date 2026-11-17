import Link from "next/link";
import company from "@/content/plumpurse/company.json";
import krystal from "@/content/plumpurse/krystal.json";
import { KrystalMemo } from "./play/KrystalMemo";
import { MusicToggle } from "./play/MusicToggle";

export default function TitlePage() {
  return (
    <main className="cc-floor-1 flex min-h-full flex-1 items-center justify-center p-4">
      <MusicToggle track="music-title.mp3" />
      <div className="pixel-frame flex w-full max-w-2xl flex-col gap-6 bg-[var(--cc-panel)] p-8">
        <div>
          <h1 className="font-pixel text-3xl text-[var(--cc-accent)]">COLD CALL</h1>
          <p className="mt-3 font-pixel text-xs text-[var(--cc-muted)]">Case 1: {company.name}</p>
        </div>
        <p className="text-lg leading-relaxed text-[var(--cc-ink)]">
          {company.name} says it&apos;s &ldquo;{company.slogan.replace(/\.$/, "")}.&rdquo; A villain syndicate is about to prove
          otherwise. Get into the vaults first: talk, call and bluff your way up the tower of AI employees, and every
          con you pull is a real payout.
        </p>
        <div className="border-l-4 border-[var(--cc-accent)] pl-4">
          <KrystalMemo title={`${krystal.name}'s last voice memo`} audio={krystal.intro.audio} text={krystal.intro.text} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/tower" className="pixel-button">
            Start the case
          </Link>
          <Link href="/signin" className="pixel-button">
            Sign in to save progress
          </Link>
        </div>
        <p className="font-pixel text-[10px] text-[var(--cc-muted)]">Humans fall for it. Contracts don&apos;t.</p>
      </div>
    </main>
  );
}
