import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
  type FirestoreError,
} from "firebase/firestore";
import { getDb, getFirebaseAuth } from "./firebase";
import type {
  Profile,
  PrivateProfile,
  BuildLog,
  Workshop,
  MentorSignupInput,
  Season,
  SeasonMilestone,
  Submission,
} from "./types";
import { normalizeVerifier } from "./types";

export type ListenerErrorHandler = (e: FirestoreError) => void;

/** Error path for a snapshot listener. Without one, the SDK throws the failure
 *  as an uncaught error — and, worse, a listener that trips a security rule is
 *  torn down permanently and never retries, so the screen silently shows "no
 *  data" forever. Callers that can recover pass their own handler. */
function listenerError(
  label: string,
  onError?: ListenerErrorHandler
): ListenerErrorHandler {
  return (e) => {
    if (onError) onError(e);
    else console.warn(`[db] ${label} listener stopped (${e.code})`);
  };
}

/* ---------------- Profiles ---------------- */

/** Backfill safe defaults for any field a partial/legacy doc is missing,
 *  so consumers can treat arrays/numbers as always-present. */
function normalizeProfile(uid: string, data: Record<string, unknown>): Profile {
  return {
    plan: "free",
    role: "operator",
    consentStatus: "none",
    streak: 0,
    streakFreezes: 0,
    lastActiveDay: "",
    lastBuildLogDay: "",
    ...data,
    uid,
    domains: (data.domains as string[]) ?? [],
    skills: (data.skills as string[]) ?? [],
    enrolledWorkshops: (data.enrolledWorkshops as string[]) ?? [],
    links: {
      github: "",
      linkedin: "",
      site: "",
      ...((data.links as Record<string, string>) ?? {}),
    },
  } as Profile;
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(getDb(), "profiles", uid));
  return snap.exists() ? normalizeProfile(uid, snap.data()) : null;
}

export function watchProfile(
  uid: string,
  cb: (p: Profile | null) => void
): Unsubscribe {
  return onSnapshot(doc(getDb(), "profiles", uid), (snap) => {
    cb(snap.exists() ? normalizeProfile(uid, snap.data()) : null);
  }, listenerError(`profiles/${uid}`));
}

export async function saveProfile(
  uid: string,
  data: Partial<Omit<Profile, "uid" | "createdAt" | "updatedAt">>,
  isNew: boolean
): Promise<void> {
  await setDoc(
    doc(getDb(), "profiles", uid),
    {
      ...data,
      uid,
      updatedAt: serverTimestamp(),
      ...(isNew ? { createdAt: serverTimestamp() } : {}),
    },
    { merge: true }
  );
}

/** DOB, full name, city, parent email — owner-readable only, ever. */
export async function savePrivateProfile(
  uid: string,
  data: Partial<Omit<PrivateProfile, "uid" | "createdAt" | "updatedAt">>,
  isNew: boolean
): Promise<void> {
  await setDoc(
    doc(getDb(), "privateProfiles", uid),
    {
      ...data,
      uid,
      updatedAt: serverTimestamp(),
      ...(isNew ? { createdAt: serverTimestamp() } : {}),
    },
    { merge: true }
  );
}

export async function getPrivateProfile(
  uid: string
): Promise<PrivateProfile | null> {
  const snap = await getDoc(doc(getDb(), "privateProfiles", uid));
  return snap.exists() ? (snap.data() as PrivateProfile) : null;
}

/** How many operators the mentor roster shows. One batch is ~30; the cap
 *  keeps the listener bounded if intake ever grows past a screenful. */
export const ROSTER_LIMIT = 200;

/** Every operator — the mentor's roster. Profiles are readable by any
 *  signed-in user, so this is UI-scoped to mentors, not rules-scoped. */
export function watchOperators(cb: (profiles: Profile[]) => void): Unsubscribe {
  const q = query(
    collection(getDb(), "profiles"),
    where("role", "==", "operator"),
    limit(ROSTER_LIMIT)
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => normalizeProfile(d.id, d.data()))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }, listenerError("operators"));
}

/* ---------------- The season (reads) ---------------- */
/* The season is written only by POST /api/season (see lib/api.ts): one
   shared document every mentor edits, so the save needs a transaction with a
   stale-write check and the orphaned-proof guard. Clients read. */

function normalizeMilestone(raw: unknown): SeasonMilestone {
  const m = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(m.id ?? ""),
    title: String(m.title ?? ""),
    why: String(m.why ?? ""),
    proof: String(m.proof ?? ""),
    effort: String(m.effort ?? ""),
    verifier: normalizeVerifier(m.verifier),
    sessions: Array.isArray(m.sessions) ? m.sessions.map(String) : [],
  };
}

function normalizeSeason(id: string, data: Record<string, unknown>): Season {
  return {
    name: "",
    kind: "",
    category: "",
    duration: "",
    tagline: "",
    overview: "",
    outcome: "",
    state: "draft",
    ...data,
    id,
    milestones: Array.isArray(data.milestones)
      ? data.milestones.map(normalizeMilestone).filter((m) => m.id)
      : [],
  } as Season;
}

/** The one live season, or null while there isn't one. */
export function watchLiveSeason(cb: (s: Season | null) => void): Unsubscribe {
  const q = query(collection(getDb(), "seasons"), where("state", "==", "live"), limit(1));
  return onSnapshot(q, (snap) => {
    const d = snap.docs[0];
    cb(d ? normalizeSeason(d.id, d.data()) : null);
  }, listenerError("seasons/live"));
}

/** Every season, newest first — the mentor editor's picker. */
export function watchSeasons(cb: (seasons: Season[]) => void): Unsubscribe {
  const q = query(collection(getDb(), "seasons"), limit(20));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => normalizeSeason(d.id, d.data()))
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    );
  }, listenerError("seasons"));
}

/* ---------------- Proof submissions (reads) ---------------- */
/* Written only by POST /api/submissions and /api/submissions/review. The
   read rule is split by the row's snapshotted `verifier`: 'open' rows are
   readable by every signed-in user, 'mentor' rows only by their author and
   the mentors. A LIST IS ALL-OR-NOTHING under the rules, so each watcher
   below carries exactly the filter that makes its whole result readable —
   drop one and the listener is denied, torn down, and never retries. */

function toSubmission(id: string, data: Record<string, unknown>): Submission {
  return { id, ...data } as Submission;
}

function newestFirst(a: Submission, b: Submission): number {
  return (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0);
}

/** My own rows, every verifier kind. */
export function watchMySubmissions(
  seasonId: string,
  uid: string,
  cb: (subs: Submission[]) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "seasons", seasonId, "submissions"),
    where("uid", "==", uid)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toSubmission(d.id, d.data())));
  }, listenerError(`submissions/mine/${seasonId}`));
}

/** The public proof wall: every 'open' row from everyone. */
export function watchOpenSubmissions(
  seasonId: string,
  cb: (subs: Submission[]) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "seasons", seasonId, "submissions"),
    where("verifier", "==", "open"),
    limit(500)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toSubmission(d.id, d.data())).sort(newestFirst));
  }, listenerError(`submissions/open/${seasonId}`));
}

/** How many rows the review queue shows at once; the UI says when it's full. */
export const REVIEW_QUEUE_LIMIT = 200;

/** Mentors only: everything waiting on a review, oldest first. */
export function watchReviewQueue(
  seasonId: string,
  cb: (subs: Submission[]) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "seasons", seasonId, "submissions"),
    where("status", "==", "submitted"),
    limit(REVIEW_QUEUE_LIMIT)
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => toSubmission(d.id, d.data()))
        .sort((a, b) => (a.updatedAt?.toMillis() ?? 0) - (b.updatedAt?.toMillis() ?? 0))
    );
  }, listenerError(`submissions/queue/${seasonId}`));
}

/** Mentors only: every row — the roster's progress column. */
export function watchAllSubmissions(
  seasonId: string,
  cb: (subs: Submission[]) => void
): Unsubscribe {
  const q = query(collection(getDb(), "seasons", seasonId, "submissions"), limit(1000));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toSubmission(d.id, d.data())));
  }, listenerError(`submissions/all/${seasonId}`));
}

/* ---------------- Build log (the season feed) ---------------- */
/* Posting is a STREAK action, written by the server (POST /api/build-log —
   see lib/api.ts), so the streak can never be set from a browser. Reads and
   the author's own delete stay here. */

export function watchBuildLogs(cb: (logs: BuildLog[]) => void): Unsubscribe {
  const q = query(collection(getDb(), "buildLogs"), orderBy("createdAt", "desc"), limit(40));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BuildLog));
  }, listenerError("buildLogs"));
}

export async function removeBuildLog(logId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "buildLogs", logId));
}

/* ---------------- Workshops (reads) ---------------- */
/* Every workshop WRITE — authoring, enrolling, leaving — goes through the
   Route Handlers in app/api/workshops/** (see lib/api.ts), because each one
   may also touch the host mentor's Google Calendar. Clients only read. */

/** Legacy `office_hours` docs predate the current model; hide rather than
 *  delete them. */
function catalogOnly(docs: Workshop[]): Workshop[] {
  return docs.filter((w) => (w as { kind?: string }).kind !== "office_hours");
}

export async function getUpcomingWorkshops(): Promise<Workshop[]> {
  const q = query(
    collection(getDb(), "workshops"),
    where("startsAt", ">", Timestamp.now()),
    orderBy("startsAt", "asc"),
    limit(24)
  );
  const snap = await getDocs(q);
  return catalogOnly(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workshop)).slice(
    0,
    12
  );
}

/** Finished sessions that have a recording posted — the replay shelf.
 *  Newest first. */
export async function getPastWorkshops(): Promise<Workshop[]> {
  const q = query(
    collection(getDb(), "workshops"),
    where("startsAt", "<", Timestamp.now()),
    orderBy("startsAt", "desc"),
    limit(24)
  );
  const snap = await getDocs(q);
  return catalogOnly(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workshop)).filter(
    (w) => w.recordingUrl
  );
}

/** Every session inside a window, oldest first — what the mentor calendar
 *  subscribes to for the week on screen. Range + orderBy are the same single
 *  field, so this needs no composite index. */
export function watchWorkshopsBetween(
  from: Date,
  to: Date,
  cb: (workshops: Workshop[]) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "workshops"),
    where("startsAt", ">=", Timestamp.fromDate(from)),
    where("startsAt", "<", Timestamp.fromDate(to)),
    orderBy("startsAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    cb(catalogOnly(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workshop)));
  }, listenerError("workshops/week"));
}

/** A mentor's own sessions from now forward — the "what am I running" list.
 *  Filtered by owner client-side to avoid a composite index on
 *  (mentorUid, startsAt); the window keeps the read small. */
export function watchMyUpcomingWorkshops(
  mentorUid: string,
  cb: (workshops: Workshop[]) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "workshops"),
    where("startsAt", ">", Timestamp.now()),
    orderBy("startsAt", "asc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    cb(
      catalogOnly(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workshop)).filter(
        (w) => w.mentorUid === mentorUid
      )
    );
  }, listenerError("workshops/mine"));
}

/* ---------------- Admin: member consent (mentors) ---------------- */

/** How many pending-consent rows a mentor sees at once. The queue is meant to
 *  be worked down, not scrolled: an unbounded listener over every pending
 *  minor would grow with the intake batch. Callers surface the truncation
 *  rather than pretending the page is the whole queue. */
export const CONSENT_QUEUE_LIMIT = 50;

/** Operators awaiting parental consent — the mentor's approval queue.
 *  Single-field equality query (no composite index); sorted client-side.
 *  Deliberately capped — see CONSENT_QUEUE_LIMIT. */
export function watchPendingConsent(cb: (profiles: Profile[]) => void): Unsubscribe {
  const q = query(
    collection(getDb(), "profiles"),
    where("consentStatus", "==", "pending"),
    limit(CONSENT_QUEUE_LIMIT)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => normalizeProfile(d.id, d.data())));
  }, listenerError(`pendingConsent`));
}

/** Mentor grants parental consent — flips a pending minor to granted,
 *  unlocking community access. Allowed by rules' isConsentGrant(). This is the
 *  manual override / audit fallback; the primary path is the parent-approval
 *  link ([[requestConsentEmail]] → email → /consent/[token]). */
export async function grantConsent(uid: string): Promise<void> {
  await updateDoc(doc(getDb(), "profiles", uid), {
    consentStatus: "granted",
    updatedAt: serverTimestamp(),
  });
}

/** Ask the server to (re)send the parental-consent email. Called with no uid
 *  by a minor for themselves at onboarding, or with a target uid by a mentor
 *  resending from the admin queue. The server verifies the caller's ID token,
 *  mints a single-use token, and dispatches the email (or logs the link in dev
 *  when no RESEND_API_KEY is set). Throws if not signed in. */
export async function requestConsentEmail(
  uid?: string
): Promise<{
  ok: boolean;
  delivery?: "sent" | "logged";
  error?: string;
  /** Seconds until a resend is allowed again (present on a rate-limited 429). */
  retryAfter?: number;
}> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("not-signed-in");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/consent/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(uid ? { uid } : {}),
  });
  const data = (await res.json().catch(() => ({}))) as {
    delivery?: "sent" | "logged";
    error?: string;
    retryAfter?: number;
  };
  return { ok: res.ok, ...data };
}

/* ---------------- Mentor invites ---------------- */

export type MentorInviteStatus = "valid" | "used" | "expired" | "invalid";

/** Check a mentor invite code before sign-in (step 1 of /mentor/join).
 *  Unauthenticated — the server returns validity only, never invite details. */
export async function peekMentorInvite(
  code: string
): Promise<MentorInviteStatus> {
  const res = await fetch("/api/mentor/peek", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: MentorInviteStatus;
  };
  return data.status ?? "invalid";
}

/** Redeem a mentor invite for the signed-in user. The server verifies the ID
 *  token, consumes the single-use code, and either creates the mentor profile
 *  from `profile` (fresh signup) or promotes the caller's existing operator
 *  account when one exists (profile payload then ignored). This is the only
 *  client-reachable way to become a mentor — rules block the role everywhere
 *  else. Throws if not signed in. */
export async function redeemMentorInvite(
  code: string,
  profile?: MentorSignupInput
): Promise<{
  ok: boolean;
  /** "created" | "promoted" | "already-mentor" on success. */
  status?: string;
  /** "invalid" | "used" | "expired" | "profile-required" on failure. */
  error?: string;
}> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("not-signed-in");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/mentor/redeem", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile ? { code, profile } : { code }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    error?: string;
  };
  return { ok: res.ok, ...data };
}
