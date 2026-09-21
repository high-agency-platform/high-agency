import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CALENDAR_STATE_COOKIE, completeConnect, isCalendarConfigured, verifyState } from "../../../lib/googleCalendar";
import { syncMemberCalendar } from "../../../lib/workshopServer";
import { adminDb } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("state") ?? "";
  const state = raw && raw === req.cookies.get(CALENDAR_STATE_COOKIE)?.value ? verifyState(raw) : null;
  const back = (path: string, status: string) => {
    const response = NextResponse.redirect(new URL(`${path}?calendar=${status}`, req.nextUrl.origin));
    response.cookies.set(CALENDAR_STATE_COOKIE, "", { path: "/api/google", maxAge: 0 });
    return response;
  };
  if (!state || !isCalendarConfigured()) return back("/dashboard", "error");
  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!code) return back(state.returnTo, "denied");
  try {
    const profile = (await adminDb().collection("profiles").doc(state.uid).get()).data();
    if (!profile || !["mentor", "operator"].includes(String(profile.role))) return back("/dashboard", "error");
    await completeConnect(state.uid, code, req.nextUrl.origin);
    const synced = await syncMemberCalendar(state.uid);
    return back(state.returnTo, synced ? "connected" : "sync-error");
  } catch {
    console.error("[google/callback] connection failed");
    return back(state.returnTo, "error");
  }
}
