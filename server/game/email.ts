// Branded sign-in email (Resend's HTTP API), instead of Supabase's default template.
// Needs RESEND_API_KEY and EMAIL_FROM (e.g. "Cold Call <hello@yourdomain>", a domain verified in Resend).
// Without them, brandedEmailEnabled() is false and sign-in falls back to Supabase's own email.

export function brandedEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The sign-in email: Cold Call's voice, one big button, the plain link underneath. */
export function signInEmail(link: string, handle: string | null, kind: "magiclink" | "signup") {
  const who = handle ? escape(handle) : "hunter";
  const action = kind === "signup" ? "Confirm your account" : "Sign in to Cold Call";
  const html = `<!doctype html><html><body style="margin:0;background:#15141a;font-family:Helvetica,Arial,sans-serif;color:#f2efe6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#2a2833;border:4px solid #f4c95d">
<tr><td style="background:#f4c95d;color:#15141a;padding:16px 20px;font-weight:bold;font-size:20px;letter-spacing:2px">COLD CALL</td></tr>
<tr><td style="padding:20px">
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${kind === "signup" ? `Confirm your account, ${who}, and your clears, streak and winnings stay yours on any device.` : `Here's your way back in, ${who}. Your clears, streak and winnings are waiting.`}</p>
<p style="margin:0 0 20px"><a href="${escape(link)}" style="display:inline-block;background:#f4c95d;color:#15141a;text-decoration:none;font-weight:bold;padding:12px 18px;border:2px solid #15141a">${action} ▶</a></p>
<p style="margin:0;font-size:12px;color:#a9a5b4;line-height:1.5">The link works once and expires soon. If you didn't ask for it, ignore this email.<br>${escape(link)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${action}: ${link}\n\nThe link works once and expires soon. If you didn't ask for it, ignore this email.`;
  return { subject: kind === "signup" ? "Confirm your Cold Call account" : "Your Cold Call sign-in link", html, text };
}

export async function sendEmail(to: string, msg: { subject: string; html: string; text: string }): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: msg.subject, html: msg.html, text: msg.text }),
  });
  if (!res.ok) throw new Error(`email failed (${res.status})`);
}
