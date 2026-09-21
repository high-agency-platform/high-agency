/**
 * Server-only. Everything that changes the season or the proof against it,
 * behind app/api/season and app/api/submissions/**. Clients only read both —
 * the rules say so — because:
 *
 *  - The season is ONE document every mentor edits. A save is a transaction
 *    with an optimistic-concurrency check (quote the updatedAt you read), and
 *    it refuses to drop a milestone that already has proof against it.
 *  - Whether a submission auto-approves depends on its milestone's verifier,
 *    which lives inside the season's milestone list — something the rules can
 *    neither index by id nor validate element-wise. And submitting is a
 *    STREAK action: the streak is written here, in the same transaction.
 *
 */
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { HttpError } from "./serverAuth";
import { bumpStreak } from "./streakServer";
import {
  SEASON_MAX_MILESTONES,
  SEASON_NAME_MAX,
  SEASON_KIND_MAX,
  SEASON_CATEGORY_MAX,
  SEASON_DURATION_MAX,
  SEASON_TAGLINE_MAX,
  SEASON_OVERVIEW_MAX,
  SEASON_OUTCOME_MAX,
  MILESTONE_TITLE_MAX,
  MILESTONE_WHY_MAX,
  MILESTONE_PROOF_MAX,
  MILESTONE_EFFORT_MAX,
  MILESTONE_SESSIONS_MAX,
  MILESTONE_SESSION_TITLE_MAX,
  SUBMISSION_URL_MAX,
  SUBMISSION_NOTE_MAX,
  REVIEW_NOTE_MAX,
  normalizeVerifier,
  milestoneReleased,
  milestoneId,
  submissionKey,
  type SeasonMilestone,
  type SeasonState,
  type SubmissionStatus,
} from "./types";

export interface MilestoneWire {
  released?: boolean;
  /** Absent on a brand-new row; the server mints one. Present rows keep theirs. */
  id?: string;
  title: string;
  why: string;
  proof: string;
  effort: string;
  verifier: string;
  sessions: string[];
}

export interface SeasonWire {
  /** Omit to create. */
  seasonId?: string;
  /** The updatedAt (ms) the editor read. Required on update. */
  expectedUpdatedAt?: number | null;
  name: string;
  kind: string;
  category: string;
  duration: string;
  tagline: string;
  overview: string;
  outcome: string;
  state: SeasonState;
  milestones: MilestoneWire[];
}

export interface SubmitWire {
  seasonId: string;
  milestoneId: string;
  proofUrl: string;
  note: string;
}

export interface ReviewWire {
  seasonId: string;
  submissionId: string;
  decision: "approve" | "return";
  note?: string;
}

const STATES: SeasonState[] = ["draft", "live", "archived"];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function urlish(v: unknown, max: number): string {
  const s = str(v, max);
  return s === "" || /^https?:\/\//i.test(s) ? s : "";
}

/** Bound every milestone; mint ids only where missing; refuse duplicates.
 *  Untitled rows are dropped, the way the old track editor dropped them. */
function cleanMilestones(raw: unknown): SeasonMilestone[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > SEASON_MAX_MILESTONES) throw new HttpError(400, "too-many-milestones");
  const out: SeasonMilestone[] = [];
  const seen = new Set<string>();
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const title = str(r.title, MILESTONE_TITLE_MAX);
    if (!title) continue;
    const id =
      typeof r.id === "string" && /^[a-z0-9-]{1,40}$/i.test(r.id) ? r.id : milestoneId();
    if (seen.has(id)) throw new HttpError(400, "duplicate-milestone-id");
    seen.add(id);
    const sessions = Array.isArray(r.sessions)
      ? r.sessions
          .map((s) => str(s, MILESTONE_SESSION_TITLE_MAX))
          .filter(Boolean)
          .slice(0, MILESTONE_SESSIONS_MAX)
      : [];
    out.push({
      id,
      title,
      why: str(r.why, MILESTONE_WHY_MAX),
      proof: str(r.proof, MILESTONE_PROOF_MAX),
      effort: str(r.effort, MILESTONE_EFFORT_MAX),
      verifier: normalizeVerifier(r.verifier),
      released: milestoneReleased(r, out.length),
      sessions,
    });
  }
  return out;
}

/** Create or update the season. One transaction: stale-write check, the
 *  orphaned-proof guard, and "only one live season" all happen together. */
export async function saveSeason(
  mentorUid: string,
  mentorName: string,
  input: Partial<SeasonWire>
): Promise<{ id: string; updatedAt: number }> {
  const name = str(input.name, SEASON_NAME_MAX);
  if (!name) throw new HttpError(400, "name-required");
  const state = STATES.includes(input.state as SeasonState) ? (input.state as SeasonState) : "draft";
  const milestones = cleanMilestones(input.milestones);
  const fields = {
    name,
    kind: str(input.kind, SEASON_KIND_MAX),
    category: str(input.category, SEASON_CATEGORY_MAX),
    duration: str(input.duration, SEASON_DURATION_MAX),
    tagline: str(input.tagline, SEASON_TAGLINE_MAX),
    overview: str(input.overview, SEASON_OVERVIEW_MAX),
    outcome: str(input.outcome, SEASON_OUTCOME_MAX),
    state,
    milestones,
  };

  const db = adminDb();
  const seasons = db.collection("seasons");
  const seasonId = typeof input.seasonId === "string" && input.seasonId ? input.seasonId : null;
  const now = Timestamp.now();

  const id = await db.runTransaction(async (tx) => {
    const ref = seasonId ? seasons.doc(seasonId) : seasons.doc();

    // ---- reads ----
    let stored: FirebaseFirestore.DocumentData | null = null;
    if (seasonId) {
      stored = (await tx.get(ref)).data() ?? null;
      if (!stored) throw new HttpError(404, "not-found");
      const storedAt = stored.updatedAt instanceof Timestamp ? stored.updatedAt.toMillis() : 0;
      const expected = typeof input.expectedUpdatedAt === "number" ? input.expectedUpdatedAt : null;
      if (storedAt && expected !== storedAt) throw new HttpError(409, "stale-write");
    }

    // A milestone that already has proof against it can't be removed —
    // its submissions would be orphaned with no error anywhere.
    const keep = new Set(milestones.map((m) => m.id));
    const removed = (Array.isArray(stored?.milestones) ? stored.milestones : [])
      .map((m: unknown) => String((m as { id?: unknown })?.id ?? ""))
      .filter((mid: string) => mid && (!keep.has(mid) || milestones.find(m => m.id === mid)?.released === false));
    const blocked: string[] = [];
    for (const mid of removed) {
      const q = await tx.get(ref.collection("submissions").where("milestoneId", "==", mid).limit(1));
      if (!q.empty) blocked.push(mid);
    }
    if (blocked.length > 0) throw new HttpError(409, "milestone-has-submissions", { blocked });

    let others: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (state === "live") {
      const live = await tx.get(seasons.where("state", "==", "live"));
      others = live.docs.filter((d) => d.id !== ref.id);
    }

    // ---- writes ----
    for (const d of others) tx.update(d.ref, { state: "archived", updatedAt: now });
    tx.set(
      ref,
      {
        ...fields,
        updatedAt: now,
        updatedByUid: mentorUid,
        updatedByName: mentorName,
        ...(stored ? {} : { createdAt: now }),
      },
      { merge: true }
    );
    return ref.id;
  });

  return { id, updatedAt: now.toMillis() };
}

/** Submit (or resubmit) proof for one milestone, and count the day. */
export async function recordSubmission(
  uid: string,
  input: Partial<SubmitWire>
): Promise<{ status: SubmissionStatus; attempt: number; streak: number }> {
  const seasonId = str(input.seasonId, 80);
  const mid = str(input.milestoneId, 80);
  if (!seasonId || !mid) throw new HttpError(400, "bad-request");
  const proofUrl = urlish(input.proofUrl, SUBMISSION_URL_MAX);
  if (!proofUrl) throw new HttpError(400, "proof-required");
  const note = str(input.note, SUBMISSION_NOTE_MAX);

  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const profileRef = db.collection("profiles").doc(uid);
    const seasonRef = db.collection("seasons").doc(seasonId);
    const subRef = seasonRef.collection("submissions").doc(submissionKey(uid, mid));
    const [pSnap, sSnap, subSnap] = await Promise.all([
      tx.get(profileRef),
      tx.get(seasonRef),
      tx.get(subRef),
    ]);

    const profile = pSnap.data();
    if (!profile) throw new HttpError(403, "no-profile");

    const season = sSnap.data();
    if (!season) throw new HttpError(404, "not-found");
    if (season.state !== "live") throw new HttpError(409, "season-closed");
    const milestone = (Array.isArray(season.milestones) ? season.milestones : []).find(
      (m: unknown) => (m as { id?: unknown })?.id === mid
    ) as Record<string, unknown> | undefined;
    if (!milestone) throw new HttpError(404, "unknown-milestone");
    if (!milestoneReleased(milestone, season.milestones.indexOf(milestone))) throw new HttpError(403, "milestone-locked");

    // The whole reason this runs on the server: the verifier decides whether
    // the row is born approved, and it comes from the season doc, never the
    // request.
    const verifier = normalizeVerifier(milestone.verifier);
    const prev = subSnap.data();
    // Proof a mentor has signed off on can't be quietly swapped afterwards.
    if (prev && prev.status === "approved" && prev.verifier === "mentor") {
      throw new HttpError(409, "already-approved");
    }

    const status: SubmissionStatus = verifier === "open" ? "approved" : "submitted";
    const now = Timestamp.now();
    tx.set(subRef, {
      seasonId,
      milestoneId: mid,
      milestoneTitle: str(milestone.title, MILESTONE_TITLE_MAX),
      uid,
      name: String(profile.name ?? "?"),
      proofUrl,
      note,
      verifier,
      status,
      attempt: prev && typeof prev.attempt === "number" ? prev.attempt + 1 : 1,
      reviewedByUid: "",
      reviewedByName: "",
      reviewedAt: null,
      reviewNote: prev && typeof prev.reviewNote === "string" ? prev.reviewNote : "",
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    });
    const next = bumpStreak(tx, profileRef, profile);
    return { status, attempt: prev && typeof prev.attempt === "number" ? prev.attempt + 1 : 1, streak: next.streak };
  });
}

/** A mentor approves or returns a submission. Any mentor may review any
 *  submission — with one primary mentor and a few guests there is no
 *  ownership model, and adding one is the squad model back in disguise. */
export async function reviewSubmission(
  mentorUid: string,
  mentorName: string,
  input: Partial<ReviewWire>
): Promise<{ status: SubmissionStatus }> {
  const seasonId = str(input.seasonId, 80);
  const submissionId = str(input.submissionId, 200);
  if (!seasonId || !submissionId) throw new HttpError(400, "bad-request");
  const decision = input.decision === "approve" || input.decision === "return" ? input.decision : null;
  if (!decision) throw new HttpError(400, "bad-request");
  const note = str(input.note, REVIEW_NOTE_MAX);
  if (decision === "return" && !note) throw new HttpError(400, "note-required");

  const ref = adminDb()
    .collection("seasons")
    .doc(seasonId)
    .collection("submissions")
    .doc(submissionId);
  const data = (await ref.get()).data();
  if (!data) throw new HttpError(404, "not-found");
  if (data.verifier === "open" || data.status !== "submitted") {
    throw new HttpError(409, "not-reviewable");
  }

  const status: SubmissionStatus = decision === "approve" ? "approved" : "returned";
  const now = Timestamp.now();
  await ref.update({
    status,
    reviewedByUid: mentorUid,
    reviewedByName: mentorName,
    reviewedAt: now,
    reviewNote: note,
    updatedAt: now,
  });
  return { status };
}

export async function readReleasedSeason(uid: string) {
  const db = adminDb();
  if (!(await db.collection("profiles").doc(uid).get()).exists) throw new HttpError(403, "no-profile");
  const snap = await db.collection("seasons").where("state", "==", "live").limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;
  const data = doc.data();
  const all = cleanMilestones(data.milestones);
  const milestones = all.filter(milestoneReleased);
  return { id: doc.id, name: data.name, kind: data.kind, category: data.category, duration: data.duration,
    tagline: data.tagline, overview: data.overview, outcome: data.outcome, state: data.state,
    milestones, milestonePreviews: all.map((m, i) => ({ id: m.id, title: m.title, released: milestoneReleased(m, i) })),
    hasUpcoming: milestones.length < all.length };
}
