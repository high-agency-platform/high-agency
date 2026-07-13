/**
 * Parent approval endpoint — public, token-gated, no auth (parents aren't users).
 *
 *  GET  /api/consent/approve?token=…  — peek: render who's being approved
 *                                        WITHOUT consuming the token.
 *  POST /api/consent/approve { token } — consume: authoritatively flip the bound
 *                                        uid's consentStatus → "granted", once.
 *
 * All authority lives server-side (Admin SDK). The token binds to exactly one
 * uid and is single-use, so a parent can't spoof an arbitrary grant.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { peekConsentToken, grantConsentWithToken } from "../../../lib/consentServer";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const result = await peekConsentToken(token);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = body.token ?? "";
  const result = await grantConsentWithToken(token);
  const status = result.status === "granted" ? 200 : 409;
  return NextResponse.json(result, { status });
}
