"use client";

// Sign in three ways: an emailed link (our branded email via /api/auth/link, or Supabase's own when no
// email key is set), email + password, or create an account with a password. Signed in already: set or
// change a password, and go to the lobby. Every path ends on /tower.

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type Mode = "link" | "password" | "signup";

function supabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const LABEL = "font-pixel text-xs";
const INPUT = "pixel-frame bg-[var(--cc-panel-2)] px-3 py-2 text-[var(--cc-ink)] outline-none";

export function SignInForm({ linkError }: { linkError: boolean }) {
  const router = useRouter();
  const [me, setMe] = useState<string | null | undefined>(undefined); // undefined while checking
  const [mode, setMode] = useState<Mode>("link");
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(linkError ? "That link expired or was already used. Send a new one." : null);

  useEffect(() => {
    let live = true;
    supabase()
      .auth.getUser()
      .then(({ data }) => live && setMe(data.user?.email ?? null))
      .catch(() => live && setMe(null));
    return () => {
      live = false;
    };
  }, []);

  /** Our branded email if the server has a key; otherwise Supabase's own. Returns an error message or null. */
  const sendLink = async (kind: "magiclink" | "signup") => {
    const res = await fetch("/api/auth/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, handle: handle.trim() || undefined, kind, password: kind === "signup" ? password : undefined, next: "/tower" }),
    });
    const data = (await res.json().catch(() => ({}))) as { sent?: boolean; fallback?: boolean; error?: string };
    if (data.sent) return null;
    if (!data.fallback) return data.error ?? "Something went wrong. Try again.";
    const redirect = `${window.location.origin}/auth/callback?next=/tower`;
    const meta = { handle: handle.trim().slice(0, 24) || undefined };
    const { error } =
      kind === "signup"
        ? await supabase().auth.signUp({ email, password, options: { emailRedirectTo: redirect, data: meta } })
        : await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, data: meta } });
    return error?.message ?? null;
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "password") {
        const { error } = await supabase().auth.signInWithPassword({ email, password });
        if (error) {
          setMessage(/invalid/i.test(error.message) ? "Wrong email or password." : error.message);
          return;
        }
        router.push("/tower");
        router.refresh();
        return;
      }
      const error = await sendLink(mode === "signup" ? "signup" : "magiclink");
      if (error) {
        setMessage(error);
        return;
      }
      setSent(mode === "signup" ? "Check your email to confirm your account, then you're in." : "Check your email. The link signs you in and drops you in the lobby.");
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <header className="-mx-6 -mt-6 mb-1 border-b-4 border-[var(--cc-edge)] bg-[var(--cc-accent)] px-6 pb-3 pt-4 text-[var(--cc-edge)]">
      <h1 className="font-pixel text-xl">COLD CALL</h1>
      <p className="mt-2 font-pixel text-[9px] leading-relaxed">Sign in to keep your clears, streak, leaderboard times and winnings.</p>
    </header>
  );

  if (me === undefined) return null;
  if (me) return <SignedIn email={me} header={header} />;

  return (
    <form
      className="pixel-frame flex w-full max-w-md flex-col gap-4 bg-[var(--cc-panel)] p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {header}
      {sent ? (
        <p className="text-[var(--cc-ink)]">{sent}</p>
      ) : (
        <>
          <div role="tablist" aria-label="How to sign in" className="flex flex-wrap gap-2">
            {(
              [
                ["link", "Email link"],
                ["password", "Password"],
                ["signup", "Create account"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setMessage(null);
                }}
                className={`border-2 border-[var(--cc-edge)] px-2.5 py-1.5 font-pixel text-[9px] ${
                  mode === m ? "bg-[var(--cc-ink)] text-[var(--cc-edge)]" : "bg-[var(--cc-panel-2)] text-[var(--cc-ink)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode !== "password" && (
            <>
              <label className={LABEL} htmlFor="handle">
                Hunter handle
              </label>
              <input id="handle" maxLength={24} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="shown on the leaderboard" className={INPUT} />
            </>
          )}
          <label className={LABEL} htmlFor="email">
            Email
          </label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          {mode !== "link" && (
            <>
              <label className={LABEL} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT}
              />
            </>
          )}
          <button type="submit" className="pixel-button self-start" disabled={busy}>
            {busy ? "One moment…" : mode === "link" ? "Email me a sign-in link" : mode === "password" ? "Sign in" : "Create account"}
          </button>
          <p className="text-xs text-[var(--cc-muted)]">
            {mode === "link"
              ? "No password needed. We email you a link that signs you in."
              : mode === "password"
                ? "Signed up with a link before? Sign in with the link, then set a password here."
                : "8 characters or more. We email you a link to confirm the account."}
          </p>
        </>
      )}
      {message && <p className="text-sm text-[var(--cc-danger)]">{message}</p>}
    </form>
  );
}

/** Already signed in: set (or change) a password, or head to the lobby. */
function SignedIn({ email, header }: { email: string; header: ReactNode }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="pixel-frame flex w-full max-w-md flex-col gap-4 bg-[var(--cc-panel)] p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        setMessage(null);
        const { error } = await supabase().auth.updateUser({ password });
        if (error) {
          setState("idle");
          setMessage(error.message);
        } else {
          setState("saved");
          setPassword("");
        }
      }}
    >
      {header}
      <p className="text-[var(--cc-ink)]">
        Signed in as <strong>{email}</strong>.
      </p>
      <label className={LABEL} htmlFor="new-password">
        {state === "saved" ? "Password saved. Change it again?" : "Set a password (to sign in without a link)"}
      </label>
      <input id="new-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="pixel-button" disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save password"}
        </button>
        <button type="button" className="pixel-button" onClick={() => router.push("/tower")}>
          To the lobby ▶
        </button>
        <button
          type="button"
          className="pixel-button"
          onClick={async () => {
            await supabase().auth.signOut();
            window.location.reload();
          }}
        >
          Sign out
        </button>
      </div>
      {message && <p className="text-sm text-[var(--cc-danger)]">{message}</p>}
    </form>
  );
}
