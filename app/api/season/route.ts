/** POST /api/season — a mentor creates or saves THE shared season track.
 *  Body: SeasonWire (app/lib/seasonServer.ts). Refuses stale writes and any
 *  edit that would orphan existing proof. */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMentor, errorResponse } from "../../lib/serverAuth";
import { saveSeason } from "../../lib/seasonServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { uid, profile } = await requireMentor(req);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await saveSeason(uid, String(profile.name ?? "Mentor"), body));
  } catch (err) {
    return errorResponse(err, "season/save");
  }
}
