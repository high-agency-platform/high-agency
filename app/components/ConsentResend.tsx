"use client";

import { useEffect, useState } from "react";
import { requestConsentEmail } from "../lib/db";

/** Keep in step with RESEND_COOLDOWN_MS in app/api/consent/send/route.ts. The
 *  server is authoritative; this only pre-disables the button so a too-early
 *  click doesn't round-trip just to bounce off a 429. */
const COOLDOWN_S = 60;

/**
 * "Resend approval" control for the pending-consent notice. An operator renders
 * it for themselves (omit `uid`); a mentor could target another operator's uid.
 * Rate-limiting is enforced server-side — this reflects the cooldown and syncs
 * to the server's `retryAfter` whenever a resend is refused.
 */
export function ConsentResend({ uid, sentAtMs }: { uid?: string; sentAtMs?: number }) {
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0); // seconds until resend allowed
  const [note, setNote] = useState<string | null>(null);

  // Seed the cooldown from the last known send (set in a mount effect, not the
  // initial state, to avoid an SSR/client hydration mismatch on the label).
  useEffect(() => {
    if (!sentAtMs) return;
    const rem = COOLDOWN_S - Math.floor((Date.now() - sentAtMs) / 1000);
    if (rem > 0) setLeft(rem);
  }, [sentAtMs]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [left]);

  async function resend() {
    if (busy || left > 0) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await requestConsentEmail(uid);
      if (r.ok) {
        setNote("Sent — check their inbox (and spam).");
        setLeft(COOLDOWN_S);
      } else if (r.error === "rate-limited") {
        setLeft(r.retryAfter ?? COOLDOWN_S);
      } else if (r.error === "no-parent-email") {
        setNote("No parent email on file.");
      } else {
        setNote("Couldn't resend — try again shortly.");
      }
    } catch {
      setNote("Couldn't resend — try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  const label = busy ? "Sending…" : left > 0 ? `Resend in ${left}s` : "Resend approval";

  return (
    <span className="notice__action">
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={resend}
        disabled={busy || left > 0}
      >
        {label}
      </button>
      {note && <small className="notice__note">{note}</small>}
    </span>
  );
}
