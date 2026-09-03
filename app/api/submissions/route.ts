/** POST /api/submissions — submit (or resubmit) proof for one milestone.
 *  Body: { seasonId, milestoneId, proofUrl, note }. The server decides from
 *  the milestone's verifier whether the row is born approved, and counts the
 *  day toward the streak. */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser, errorResponse } from "../../lib/serverAuth";
import { recordSubmission } from "../../lib/seasonServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await recordSubmission(uid, body));
  } catch (err) {
    return errorResponse(err, "submissions/create");
  }
}
