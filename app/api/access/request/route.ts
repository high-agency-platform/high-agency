import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminAuth } from "../../../lib/firebaseAdmin";
import {
  callerIp,
  checkRateLimit,
  isValidEmail,
  lookupAccessMember,
  checkSeasonInvite,
  normalizeEmail,
} from "../../../lib/accessGate";
import { sendAccessEmail } from "../../../lib/accessEmail";
import { accessVerificationUrl } from "../../../lib/accessLink";

export const runtime = "nodejs";
export const maxDuration = 60;
/** Reads live allowlist state and sends mail — never cached. */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; invite?: unknown };
  const email = normalizeEmail(body.email);

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { status: "bad-email", message: "That doesn't look like a valid email." },
      { status: 400 }
    );
  }

  try {
    const limit = await checkRateLimit([`email:${email}`, `ip:${callerIp(req.headers)}`]);
    if (!limit.ok) return NextResponse.json({ status: "rate-limited", message: "Too many attempts. Try again in a few minutes." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    const member = await lookupAccessMember(email);
    const invited = await checkSeasonInvite(body.invite);
    if (!member && !invited) return NextResponse.json({ status: "not-approved" });

    const localOrigin = req.headers.get("origin") ?? req.nextUrl.origin;
    const origin = (process.env.NODE_ENV === "development" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(localOrigin) ? localOrigin : process.env.NEXT_PUBLIC_APP_URL ?? "https://high-agency.io").replace(
      /\/$/,
      ""
    );
    const continueUrl = `${origin}/login/verify${invited ? `?invite=${encodeURIComponent(String(body.invite))}` : ""}`;
    const generatedLink = await adminAuth().generateSignInWithEmailLink(email, {
      url: continueUrl,
      handleCodeInApp: true,
    });
    const signInUrl = accessVerificationUrl(generatedLink, continueUrl);

    const delivery = await sendAccessEmail({
      to: email,
      signInUrl,
      name: member?.name,
    });

    let qaUrl: string | undefined;
    if (process.env.NODE_ENV === "development" && process.env.FIREBASE_PROJECT_ID === "demo-highagency" && process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST) {
      const verify = new URL(signInUrl);
      qaUrl = verify.pathname + verify.search;
    }
    return NextResponse.json({ status: "sent", delivery, ...(qaUrl ? { qaUrl } : {}) });
  } catch (err) {
    // Never leak internals (misconfigured Admin creds, Resend errors, the
    // fact that an address does or doesn't exist in Firebase Auth).
    console.error("[access/request] failed", err instanceof Error ? err.name : "unknown");
    return NextResponse.json(
      { status: "error", message: "Couldn't send the link. Try again shortly." },
      { status: 500 }
    );
  }
}
