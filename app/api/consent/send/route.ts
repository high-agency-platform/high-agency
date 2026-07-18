/**
 * POST /api/consent/send — mint a consent token and email the parent.
 *
 * Auth: caller must present a Firebase ID token (Authorization: Bearer <token>).
 *  - A minor calls this for THEMSELVES right after onboarding.
 *  - A mentor may call it with { uid } to resend for any pending operator
 *    (the admin-panel "Resend" fallback when a parent lost the first email).
 *
 * Only operates on profiles whose consentStatus is "pending" (i.e. a minor
 * awaiting consent). The actual email address comes from the owner-only
 * privateProfiles doc, read here via the Admin SDK.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";
import { createConsentToken } from "../../../lib/consentServer";
import { sendConsentEmail } from "../../../lib/consentEmail";

export const runtime = "nodejs";

/** Minimum gap between consent emails for a given operator. Enforced here on
 *  the server (the client countdown is only a hint) so a lost first email can
 *  be re-sent, but the endpoint can't be used to spam a parent's inbox. */
const RESEND_COOLDOWN_MS = 60_000;

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  const idToken = bearerToken(req);
  if (!idToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let callerUid: string;
  try {
    callerUid = (await adminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: "invalid-token" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { uid?: string };
  const db = adminDb();

  // Resolve the target: self by default; a mentor may target another uid.
  let targetUid = callerUid;
  if (body.uid && body.uid !== callerUid) {
    const callerSnap = await db.collection("profiles").doc(callerUid).get();
    if (callerSnap.data()?.role !== "mentor") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    targetUid = body.uid;
  }

  const profileSnap = await db.collection("profiles").doc(targetUid).get();
  const profile = profileSnap.data();
  if (!profile) {
    return NextResponse.json({ error: "no-profile" }, { status: 404 });
  }
  if (profile.consentStatus !== "pending") {
    // Adults / already-granted operators are never emailed.
    return NextResponse.json({ error: "not-pending" }, { status: 409 });
  }

  // Rate-limit resends per operator. `consentEmailSentAt` is server-written on
  // every successful send below, so this bounds both self-resends and mentor
  // resends targeting the same operator.
  const lastSent = profile.consentEmailSentAt;
  const lastSentMs =
    lastSent && typeof lastSent.toMillis === "function" ? lastSent.toMillis() : 0;
  const elapsed = Date.now() - lastSentMs;
  if (lastSentMs && elapsed < RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    return NextResponse.json(
      { error: "rate-limited", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const privateSnap = await db.collection("privateProfiles").doc(targetUid).get();
  const parentEmail = (privateSnap.data()?.parentEmail ?? "").trim();
  if (!parentEmail) {
    return NextResponse.json({ error: "no-parent-email" }, { status: 422 });
  }

  const childName = String(profile.name ?? "your child");
  const rawToken = await createConsentToken(targetUid, childName, parentEmail);

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const approveUrl = `${origin}/consent/${rawToken}`;

  const delivery = await sendConsentEmail({ to: parentEmail, childName, approveUrl });

  // Record send time so a mentor sees context in the consent queue.
  await db
    .collection("profiles")
    .doc(targetUid)
    .update({ consentEmailSentAt: FieldValue.serverTimestamp() });

  return NextResponse.json({ ok: true, delivery });
}
