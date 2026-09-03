/** POST /api/submissions/review — a mentor approves or returns proof.
 *  Body: { seasonId, submissionId, decision: "approve" | "return", note? }.
 *  A return must carry a note: returned ≠ rejected, and it has to say what
 *  to fix. */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMentor, errorResponse } from "../../../lib/serverAuth";
import { reviewSubmission } from "../../../lib/seasonServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { uid, profile } = await requireMentor(req);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await reviewSubmission(uid, String(profile.name ?? "Mentor"), body));
  } catch (err) {
    return errorResponse(err, "submissions/review");
  }
}
