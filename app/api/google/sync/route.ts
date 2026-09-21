import { NextResponse, type NextRequest } from "next/server";
import { requireMember, errorResponse } from "../../../lib/serverAuth";
import { isCalendarConfigured } from "../../../lib/googleCalendar";
import { syncMemberCalendar } from "../../../lib/workshopServer";

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireMember(req);
    if (!isCalendarConfigured()) return NextResponse.json({ error: "not-configured" }, { status: 503 });
    const synced = await syncMemberCalendar(uid);
    return NextResponse.json(synced ? { ok: true } : { error: "sync-incomplete" }, { status: synced ? 200 : 502 });
  } catch (err) { return errorResponse(err, "google/sync"); }
}
