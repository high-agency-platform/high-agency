/** Email-link transport. Never log sign-in credentials. */
import { Resend } from "resend";
import { createHash } from "node:crypto";
import type { EmailDelivery } from "./consentEmail";

export type { EmailDelivery };

/** Falls back to the consent sender so a single verified domain serves both
 *  flows — one less thing to configure before production. */
const FROM =
  process.env.ACCESS_EMAIL_FROM ??
  process.env.CONSENT_EMAIL_FROM ??
  "High Agency <onboarding@resend.dev>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function signInHtml(signInUrl: string, name?: string): string {
  const greeting = name ? `${escapeHtml(name)}, you're in.` : "You're in.";
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#211d18;line-height:1.55">
    <h1 style="font-size:22px;margin:0 0 16px">${greeting}</h1>
    <p style="margin:0 0 14px">
      Welcome to <strong>High Agency Season 1</strong> — a live
      cohort program where you work a mentor-written track, ship real proof, and learn
      from people who've done it. Use the button below to sign in.
    </p>
    <p style="margin:0 0 28px">
      <a href="${signInUrl}"
         style="display:inline-block;background:#ff5a1e;color:#fff;text-decoration:none;
                font-weight:600;padding:13px 26px;border-radius:12px">
        Sign in to High Agency
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#6b645b">
      If the button doesn't work, paste this link into your browser:
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:#6b645b;word-break:break-all">
      ${signInUrl}
    </p>
    <p style="margin:0;font-size:13px;color:#6b645b">
      This link is single-use and expires shortly. If you didn't ask to sign in,
      you can ignore this email — nothing happens until the link is opened.
    </p>
  </div>`;
}

export async function sendAccessEmail(params: {
  to: string;
  signInUrl: string;
  name?: string;
}): Promise<EmailDelivery> {
  const { to, signInUrl, name } = params;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) return "logged";
    throw new Error("Email delivery is not configured");
  }

  const resend = new Resend(apiKey);
  const message = {
    from: FROM,
    to,
    subject: "Your High Agency sign-in link",
    html: signInHtml(signInUrl, name),
  };
  const idempotencyKey = `access-${createHash("sha256").update(JSON.stringify(message)).digest("hex")}`;
  const deadline = Date.now() + 45_000;
  for (let attempt = 0; attempt < 12; attempt++) {
    const { error, headers } = await resend.emails.send(message, { idempotencyKey });
    if (!error) return "sent";
    // Daily/monthly quotas and invalid recipients cannot be fixed by retrying.
    if (error.name !== "rate_limit_exceeded" || attempt === 11) throw new Error(`Resend failed: ${error.name}`);
    const retryAfter = headers?.["retry-after"];
    const seconds = Number(retryAfter);
    const requestedMs = retryAfter ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()) : 0;
    const backoff = Math.min(4000, 250 * 2 ** attempt);
    const delay = Math.max(Number.isFinite(requestedMs) ? requestedMs : 0, backoff) + Math.random() * backoff;
    if (Date.now() + delay >= deadline) throw new Error("Resend failed: rate_limit_exceeded");
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error("Resend failed: rate_limit_exceeded");
}
