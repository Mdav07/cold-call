"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export function SignInForm({ linkError }: { linkError: boolean }) {
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(linkError ? "That link expired or was already used. Send a new one." : null);

  return (
    <form
      className="pixel-frame flex w-full max-w-md flex-col gap-4 bg-[var(--cc-panel)] p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setMessage(null);
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/play/penny`,
            data: { handle: handle.trim().slice(0, 24) },
          },
        });
        if (error) {
          setState("error");
          setMessage(error.message);
        } else {
          setState("sent");
        }
      }}
    >
      <h1 className="font-pixel text-sm text-[var(--cc-accent)]">Cold Call</h1>
      {state === "sent" ? (
        <p className="text-[var(--cc-ink)]">
          Check your email. Krystal&apos;s case file is waiting behind that link.
        </p>
      ) : (
        <>
          <label className="font-pixel text-xs" htmlFor="handle">
            Hunter handle
          </label>
          <input
            id="handle"
            required
            maxLength={24}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="shown on the leaderboard"
            className="pixel-frame bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)] outline-none"
          />
          <label className="font-pixel text-xs" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pixel-frame bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)] outline-none"
          />
          <button type="submit" className="pixel-button self-start" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Send magic link"}
          </button>
          <p className="text-xs text-[var(--cc-muted)]">No password, no seed phrase. We email you a sign-in link.</p>
        </>
      )}
      {message && <p className="text-sm text-[var(--cc-danger)]">{message}</p>}
    </form>
  );
}
