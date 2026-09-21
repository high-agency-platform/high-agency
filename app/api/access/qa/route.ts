import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development" || process.env.FIREBASE_PROJECT_ID !== "demo-highagency" || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) return new NextResponse(null, { status: 404 });
  const { role } = await req.json();
  if (role === "invite") {
    const invite = (await adminDb().collection("qaConfig").doc("invite").get()).data()?.code;
    return NextResponse.json({ url: `/join?invite=${invite}` });
  }
  if (role !== "mentor" && role !== "operator") return new NextResponse(null, { status: 400 });
  const email = `${role}@example.test`;
  const link = new URL(await adminAuth().generateSignInWithEmailLink(email, { url: `${req.nextUrl.origin}/login/verify`, handleCodeInApp: true }));
  const url = new URL("/login/verify", req.nextUrl.origin);
  for (const key of ["apiKey", "oobCode", "mode"]) url.searchParams.set(key, link.searchParams.get(key) ?? "");
  return NextResponse.json({ email, url: url.pathname + url.search });
}
