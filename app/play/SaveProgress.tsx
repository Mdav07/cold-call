"use client";

// Shown right after a player picks their hunter: sign in by email to keep clears, streaks and
// leaderboard times, or carry on as a guest. Players who are already signed in skip straight past it.

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";

function supabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export function SaveProgress({
  handle,
  next = "/tower",
  onContinue,
}: {
  /** The hunter name, used as the leaderboard handle. */
  handle: string;
  /** Where the sign-in link lands. */
  next?: string;
  /** Play as a guest (or, when already signed in, carry on). */
  onContinue: () => void;
}) {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!live) return;
        if (data.session) onContinue();
        else setChecking(false);
      })
      .catch(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, [onContinue]);

  if (checking) return null;

  return (
    <section
      aria-labelledby="save-progress-title"
      className="pixel-frame mx-auto flex w-full max-w-md flex-col gap-4 bg-[var(--cc-panel)] p-6"
    >
      <h2 id="save-progress-title" className="font-pixel text-sm text-[var(--cc-accent)]">
        Save your progress?
      </h2>
      {state === "sent" ? (
        <>
          <p className="text-[var(--cc-ink)]">
            Check your email. The link signs you in as <strong>{handle}</strong> and brings you back to the tower.
          </p>
          <button type="button" className="pixel-button self-start" onClick={onContinue}>
            Play now ▶
          </button>
        </>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setState("sending");
            setMessage(null);
            const { error } = await supabase().auth.signInWithOtp({
              email,
              options: {
                emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                data: { handle: handle.slice(0, 24) },
              },
            });
            if (error) {
              setState("error");
              setMessage(error.message);
            } else setState("sent");
          }}
        >
          <p className="text-sm text-[var(--cc-ink)]">
            Sign in to keep your clears, streak and leaderboard times as <strong>{handle}</strong> on any device. As a guest, your progress stays in this browser and winnings aren&apos;t kept.
          </p>
          <label htmlFor="save-email" className="font-pixel text-[10px] text-[var(--cc-muted)]">
            Email
          </label>
          <input
            id="save-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pixel-frame bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)] outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="pixel-button" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
            <button type="button" className="pixel-button" onClick={onContinue}>
              Play as guest ▶
            </button>
          </div>
          <p className="text-xs text-[var(--cc-muted)]">No password. We email you a link.</p>
          {message && <p className="text-sm text-[var(--cc-danger)]">{message}</p>}
        </form>
      )}
    </section>
  );
}
