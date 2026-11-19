"use client";

// The account half of the profile page: guests are nudged to sign in (and told what they'd keep);
// signed-in players see who they are, what they've earned, and how to manage or leave the account.

import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EarnedChip } from "@/app/play/earnings";

function supabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const BTN = "border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-2.5 py-1.5 font-pixel text-[9px] text-[var(--cc-ink)] hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]";

export function AccountBox() {
  const [email, setEmail] = useState<string | null | undefined>(undefined); // undefined while checking
  useEffect(() => {
    let live = true;
    supabase()
      .auth.getUser()
      .then(({ data }) => live && setEmail(data.user?.email ?? null))
      .catch(() => live && setEmail(null));
    return () => {
      live = false;
    };
  }, []);

  if (email === undefined) return null;
  if (!email)
    return (
      <section aria-label="Account" className="flex flex-col gap-2 border-2 border-dashed border-[var(--cc-edge)] p-3">
        <p className="text-sm text-[var(--cc-ink)]">
          Playing as a guest. Your clears stay in this browser, and your winnings aren&apos;t kept.
        </p>
        <Link href="/signin" className="pixel-button self-start">
          Sign in or create an account ▶
        </Link>
      </section>
    );
  return (
    <section aria-label="Account" className="flex flex-col gap-2 border-2 border-dashed border-[var(--cc-edge)] p-3">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-[var(--cc-ink)]">
        <span>
          Signed in as <strong>{email}</strong>
        </span>
        <EarnedChip label="EARNED" className="font-pixel text-[9px]" />
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/signin" className={BTN}>
          Password
        </Link>
        <button
          type="button"
          className={BTN}
          onClick={async () => {
            await supabase().auth.signOut();
            window.location.reload();
          }}
        >
          Sign out
        </button>
      </div>
    </section>
  );
}
