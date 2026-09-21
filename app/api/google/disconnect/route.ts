/** POST /api/google/disconnect — revoke and forget this member's token. */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMember, errorResponse } from "../../../lib/serverAuth";
import { disconnect, accessTokenFor, pruneMemberEvents } from "../../../lib/googleCalendar";

import { restoreMemberInvitations } from "../../../lib/workshopServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireMember(req);
    const token = await accessTokenFor(uid);
    if (token) await pruneMemberEvents(token, new Set());
    await disconnect(uid);
    if (!await restoreMemberInvitations(uid)) return NextResponse.json({ error: "invitation-sync-incomplete" }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "google/disconnect");
  }
}
