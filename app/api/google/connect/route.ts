import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMember, errorResponse } from "../../../lib/serverAuth";
import { CALENDAR_STATE_COOKIE, calendarReturnTo, connectUrl, isCalendarConfigured, signState } from "../../../lib/googleCalendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireMember(req);
    if (!isCalendarConfigured()) return NextResponse.json({ error: "not-configured" }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as { returnTo?: string };
    const state = signState(uid, calendarReturnTo(body.returnTo));
    const response = NextResponse.json({ url: connectUrl(state, req.nextUrl.origin) });
    response.cookies.set(CALENDAR_STATE_COOKIE, state, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/google", maxAge: 600 });
    return response;
  } catch (err) {
    return errorResponse(err, "google/connect");
  }
}
