import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "../../../lib/firebaseAdmin";
import { claimSeasonAccess, normalizeEmail } from "../../../lib/accessGate";
import { errorResponse, HttpError } from "../../../lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new HttpError(401, "unauthenticated");
    const identity = await adminAuth().verifyIdToken(token).catch(() => { throw new HttpError(401, "invalid-token"); });
    const body = await req.json().catch(() => ({}));
    const claim = await claimSeasonAccess(identity.uid, normalizeEmail(identity.email), identity.email_verified === true, body.invite);
    return NextResponse.json({ status: "ok", ...claim });
  } catch (err) { return errorResponse(err, "access/claim"); }
}
