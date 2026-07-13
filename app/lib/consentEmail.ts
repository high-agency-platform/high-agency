/**
 * Consent email transport. Server-only.
 *
 * Uses Resend when RESEND_API_KEY is set. When it isn't (local dev / preview
 * with no secret), we DON'T fail — we log the fully-formed approval link to the
 * server console so the flow is testable end-to-end against a "dev inbox"
 * (the terminal). Sai wires RESEND_API_KEY + CONSENT_EMAIL_FROM for real
 * delivery; nothing else changes.
 */
import { Resend } from "resend";

export type EmailDelivery = "sent" | "logged";

const FROM =
  process.env.CONSENT_EMAIL_FROM ?? "High Agency <onboarding@resend.dev>";

function consentHtml(childName: string, approveUrl: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#211d18;line-height:1.55">
    <h1 style="font-size:22px;margin:0 0 16px">Approve ${escapeHtml(childName)} to join High Agency</h1>
    <p style="margin:0 0 14px">
      ${escapeHtml(childName)} signed up for <strong>High Agency</strong>, a live cohort
      program where ambitious young people (13–18) build real projects together in small,
      mentored squads. Because they're under 18, we need a parent or guardian to approve
      before they can join a squad and take part in the community.
    </p>
    <p style="margin:0 0 24px">
      What they'll do: join a small accountability squad, work through real-world
      milestones (ship a project, get first users), and attend live expert workshops.
      There is no cost for the founding batch.
    </p>
    <p style="margin:0 0 28px">
      <a href="${approveUrl}"
         style="display:inline-block;background:#ff5a1e;color:#fff;text-decoration:none;
                font-weight:600;padding:13px 26px;border-radius:12px">
        Approve ${escapeHtml(childName)}
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#6b645b">
      If the button doesn't work, paste this link into your browser:
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:#6b645b;word-break:break-all">
      ${approveUrl}
    </p>
    <p style="margin:0;font-size:13px;color:#6b645b">
      This link is single-use and expires in 14 days. If you didn't expect this email,
      you can ignore it — no account is activated without your approval.
    </p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendConsentEmail(params: {
  to: string;
  childName: string;
  approveUrl: string;
}): Promise<EmailDelivery> {
  const { to, childName, approveUrl } = params;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev inbox: the flow is fully exercisable without a provider secret.
    console.log(
      `[consent] No RESEND_API_KEY set — would email ${to} to approve "${childName}".\n` +
        `[consent] Approval link: ${approveUrl}`
    );
    return "logged";
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Approve ${childName} to join High Agency`,
    html: consentHtml(childName, approveUrl),
  });
  if (error) {
    throw new Error(`Resend failed: ${error.message ?? String(error)}`);
  }
  return "sent";
}
