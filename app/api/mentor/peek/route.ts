/**
 * POST /api/mentor/peek — check a mentor invite code before sign-in.
 *
 * Unauthenticated by design: the join page validates the code as step 1, so a
 * mistyped or spent link fails fast instead of after account creation. Codes
 * are 24 random bytes and only their hash is stored, so this endpoint is not a
 * usable guessing oracle. Returns { status } only — never invite metadata
 * (the label can contain the invitee's email).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { peekMentorInvite } from "../../../lib/mentorInviteServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const status = await peekMentorInvite(code);
  return NextResponse.json({ status });
}
