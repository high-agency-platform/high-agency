import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
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
  Workshop,
  MentorSignupInput,
  Season,
  SeasonMilestone,
  Submission,
} from "./types";
import { normalizeVerifier, workshopIsUpcoming, WORKSHOP_MAX_DURATION_MINS } from "./types";

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
  cb: (p: Profile | null) => void,
  onError?: ListenerErrorHandler
): Unsubscribe {
  return onSnapshot(doc(getDb(), "profiles", uid), (snap) => {
    cb(snap.exists() ? normalizeProfile(uid, snap.data()) : null);
  }, listenerError(`profiles/${uid}`, onError));
}

export async function saveProfile(
  uid: string,
  data: Partial<Omit<Profile, "uid" | "createdAt" | "updatedAt" | "staffTitle" | "hidden">>,
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

/** DOB, full name, city, and legacy parent contact — owner-readable only. */
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
        .filter((p) => !p.hidden)
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }, listenerError("operators"));
}

/** One member-only listener backs the sidebar and its profile cards. */
export function watchMembers(cb: (profiles: Profile[]) => void, onError: ListenerErrorHandler): Unsubscribe {
  return onSnapshot(collection(getDb(), "profiles"), (snap) => {
    cb(snap.docs.map((d) => normalizeProfile(d.id, d.data()))
      .filter((p) => !p.hidden && (p.role === "mentor" || p.role === "operator"))
      .sort((a, b) => a.name.localeCompare(b.name)));
  }, onError);
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
    ...(typeof m.released === "boolean" ? { released: m.released } : {}),
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

/** Student reads go through the server so unreleased content never reaches the browser. */
export function watchReleasedSeason(cb: (s: Season | null) => void, onError: () => void): Unsubscribe {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  async function refresh() {
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      const response = await fetch("/api/season", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("season-unavailable");
      const { season } = await response.json();
      if (!stopped) cb(season ? normalizeSeason(season.id, season) : null);
    } catch { if (!stopped) onError(); }
    finally { if (!stopped) timer = setTimeout(refresh, 10_000); }
  }
  void refresh();
  return () => { stopped = true; clearTimeout(timer); };
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

/* ---------------- Workshops (reads) ---------------- */
/* Every workshop WRITE — authoring, enrolling, leaving — goes through the
   Route Handlers in app/api/workshops/** (see lib/api.ts), because each one
   may also touch the host mentor's Google Calendar. Clients only read. */

/** Legacy `office_hours` docs predate the current model; hide rather than
 *  delete them. */
function catalogOnly(docs: Workshop[]): Workshop[] {
  return docs.filter((w) => w.hidden !== true && (w as { kind?: string }).kind !== "office_hours");
}

function upcomingWorkshopQuery() {
  return query(
    collection(getDb(), "workshops"),
    where("startsAt", ">", Timestamp.fromMillis(Date.now() - WORKSHOP_MAX_DURATION_MINS * 60_000)),
    orderBy("startsAt", "asc")
  );
}

function upcomingCatalog(docs: Workshop[]): Workshop[] {
  const now = Date.now();
  return catalogOnly(docs).filter(w => workshopIsUpcoming(w, now));
}

export async function getUpcomingWorkshops(): Promise<Workshop[]> {
  const snap = await getDocs(upcomingWorkshopQuery());
  return upcomingCatalog(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workshop));
}

/** Updates roster/meeting edits live, and expires sessions without another read. */
export function watchUpcomingWorkshops(
  cb: (workshops: Workshop[]) => void,
  onError?: ListenerErrorHandler
): Unsubscribe {
  let latest: Workshop[] | null = null;
  const emit = () => { if (latest) cb(upcomingCatalog(latest)); };
  const unsubscribe = onSnapshot(upcomingWorkshopQuery(), snap => {
    latest = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Workshop);
    emit();
  }, listenerError("workshops/upcoming", onError));
  const timer = setInterval(emit, 30_000);
  return () => { clearInterval(timer); unsubscribe(); };
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
  return watchUpcomingWorkshops(workshops => cb(workshops.filter(w => w.mentorUid === mentorUid)));
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
