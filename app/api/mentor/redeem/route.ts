/**
 * POST /api/mentor/redeem — consume a mentor invite for the signed-in caller.
 *
 * Auth: Firebase ID token (Authorization: Bearer <token>). The invite is only
 * ever redeemed for the verified caller's uid — the body cannot target anyone
 * else. Body: { code, profile? } where profile is the MentorSignupInput from
 * the join form (required for fresh signups; ignored when an existing operator
 * account is being promoted).
 *
 * This is the one client-reachable path that mints `role: "mentor"` — the
 * grant itself happens server-side via the Admin SDK inside a single-use
 * transaction (app/lib/mentorInviteServer.ts), so Firestore rules can keep
 * denying every client write of the role.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminAuth } from "../../../lib/firebaseAdmin";
import { redeemMentorInvite } from "../../../lib/mentorInviteServer";
import type { MentorSignupInput } from "../../../lib/types";

export const runtime = "nodejs";

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/** HTTP status per redeem outcome; the body carries the specific status. */
const FAILURE_HTTP: Record<string, number> = {
  invalid: 404,
  used: 409,
  expired: 410,
  "profile-required": 422,
};

export async function POST(req: NextRequest) {
  const idToken = bearerToken(req);
  if (!idToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: "invalid-token" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    profile?: MentorSignupInput;
  };
  const code = typeof body.code === "string" ? body.code.trim() : "";

  const result = await redeemMentorInvite(code, uid, body.profile ?? null);

  const failure = FAILURE_HTTP[result.status];
  if (failure) {
    return NextResponse.json({ error: result.status }, { status: failure });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
