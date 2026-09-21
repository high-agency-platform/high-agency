/** GET /api/google/status — is calendar set up, and is this member connected. */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMember, errorResponse } from "../../../lib/serverAuth";
import { connectionStatus, isCalendarConfigured } from "../../../lib/googleCalendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireMember(req);
    const configured = isCalendarConfigured();
    const status = configured ? await connectionStatus(uid) : { connected: false, email: "", syncError: false };
    return NextResponse.json({ configured, ...status });
  } catch (err) {
    return errorResponse(err, "google/status");
  }
}
