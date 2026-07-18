import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb, getFirebaseAuth } from "./firebase";
import type {
  Profile,
  PrivateProfile,
  Cohort,
  CohortApplication,
  DeclineReason,
  MilestoneSubmission,
  BuildLog,
  Workshop,
  WeeklyHours,
} from "./types";
import { COHORT_MIN_TO_ACTIVATE } from "./types";
import { XP, localDay, isoWeek, touchStreak } from "./gamify";
import { milestone } from "./milestones";

export const MAX_PENDING_APPLICATIONS = 3;

/* ---------------- Profiles ---------------- */

/** Backfill safe defaults for any field a partial/legacy doc is missing,
 *  so consumers can treat arrays/numbers as always-present. */
function normalizeProfile(uid: string, data: Record<string, unknown>): Profile {
  return {
    plan: "free",
    role: "operator",
    consentStatus: "none",
    xp: 0,
    streak: 0,
    streakFreezes: 0,
    lastActiveDay: "",
    lastBuildLogDay: "",
    lastRitualWeek: "",
    ...data,
    uid,
    domains: (data.domains as string[]) ?? [],
    skills: (data.skills as string[]) ?? [],
    enrolledWorkshops: (data.enrolledWorkshops as string[]) ?? [],
    attendedWorkshops: (data.attendedWorkshops as string[]) ?? [],
    pendingApplications: (data.pendingApplications as string[]) ?? [],
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
  });
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

/* ---------------- Cohorts ---------------- */

export function watchCohorts(cb: (cohorts: Cohort[]) => void): Unsubscribe {
  const q = query(
    collection(getDb(), "cohorts"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cohort));
  });
}

export function watchMyCohorts(
  uid: string,
  cb: (cohorts: Cohort[]) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "cohorts"),
    where("memberUids", "array-contains", uid)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cohort));
  });
}

export function watchCohort(
  id: string,
  cb: (c: Cohort | null) => void
): Unsubscribe {
  return onSnapshot(doc(getDb(), "cohorts", id), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Cohort) : null);
  });
}

/** Creation requires a committed weekly slot — deliberate friction that
 *  forces the founder to commit to the ritual before recruiting. */
export async function createCohort(
  founder: Profile,
  data: {
    name: string;
    mission: string;
    tags: string[];
    lookingFor: string[];
    meetingSlot: string;
  }
): Promise<string> {
  const ref = await addDoc(collection(getDb(), "cohorts"), {
    ...data,
    timezone: founder.timezone,
    state: "forming",
    founderUid: founder.uid,
    founderName: founder.name,
    peerLeadUid: founder.uid,
    memberUids: [founder.uid],
    memberNames: { [founder.uid]: founder.name },
    open: true,
    weeklyStreak: 0,
    lastRitualWeek: "",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Weekly ritual check-in: any member marks "we held it" once per ISO
 *  week. Extends the cohort streak; the caller separately earns their
 *  personal ritual XP (capped 1/week). */
export async function markRitual(cohort: Cohort, profile: Profile): Promise<void> {
  const week = isoWeek();
  const db = getDb();
  if (cohort.lastRitualWeek !== week) {
    const prev = isoWeek(new Date(Date.now() - 7 * 86400000));
    await updateDoc(doc(db, "cohorts", cohort.id), {
      weeklyStreak: cohort.lastRitualWeek === prev ? cohort.weeklyStreak + 1 : 1,
      lastRitualWeek: week,
    });
  }
  if (profile.lastRitualWeek !== week) {
    await updateDoc(doc(db, "profiles", profile.uid), {
      xp: increment(XP.ritual),
      lastRitualWeek: week,
      updatedAt: serverTimestamp(),
    });
    await touchStreak({ ...profile, lastRitualWeek: week });
  }
}

/* ---------------- Applications ---------------- */

/** Hard cap of 3 live applications. The pendingApplications list on the
 *  applicant's own profile enforces the cap without collection-group
 *  queries; it's reconciled lazily as decisions land. */
export async function applyToCohort(
  cohortId: string,
  applicant: Profile,
  pitch: string,
  hours: WeeklyHours
): Promise<void> {
  if (applicant.pendingApplications.length >= MAX_PENDING_APPLICATIONS) {
    throw new Error("max-pending");
  }
  const db = getDb();
  await setDoc(doc(db, "cohorts", cohortId, "applications", applicant.uid), {
    applicantUid: applicant.uid,
    applicantName: applicant.name,
    pitch,
    hours,
    status: "pending",
    declineReason: null,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "profiles", applicant.uid), {
    pendingApplications: arrayUnion(cohortId),
    updatedAt: serverTimestamp(),
  });
}

export async function getMyApplication(
  cohortId: string,
  uid: string
): Promise<CohortApplication | null> {
  const snap = await getDoc(doc(getDb(), "cohorts", cohortId, "applications", uid));
  return snap.exists() ? (snap.data() as CohortApplication) : null;
}

/** Drop decided/dead cohort ids from my pendingApplications so slots
 *  free up. Founders can't write my profile, so I reconcile my own. */
export async function reconcilePendingApplications(
  profile: Profile
): Promise<void> {
  if (profile.pendingApplications.length === 0) return;
  const db = getDb();
  const stale: string[] = [];
  await Promise.all(
    profile.pendingApplications.map(async (cohortId) => {
      const app = await getMyApplication(cohortId, profile.uid).catch(() => null);
      if (!app || app.status !== "pending") stale.push(cohortId);
    })
  );
  if (stale.length > 0) {
    await updateDoc(doc(db, "profiles", profile.uid), {
      pendingApplications: arrayRemove(...stale),
      updatedAt: serverTimestamp(),
    });
  }
}

export function watchApplications(
  cohortId: string,
  cb: (apps: CohortApplication[]) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "cohorts", cohortId, "applications"),
    where("status", "==", "pending")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as CohortApplication));
  });
}

/** Founder decision. Accepting also adds the applicant to the roster and
 *  activates a forming cohort at 3 members — atomically. Declines carry
 *  a one-tap reason so rejection is informative, not silent. */
export async function decideApplication(
  cohort: Cohort,
  app: CohortApplication,
  accept: boolean,
  declineReason: DeclineReason | null = null
): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  batch.update(doc(db, "cohorts", cohort.id, "applications", app.applicantUid), {
    status: accept ? "accepted" : "declined",
    declineReason: accept ? null : declineReason,
  });
  if (accept) {
    const memberUids = [...cohort.memberUids, app.applicantUid];
    batch.update(doc(db, "cohorts", cohort.id), {
      memberUids,
      memberNames: { ...cohort.memberNames, [app.applicantUid]: app.applicantName },
      ...(cohort.state === "forming" && memberUids.length >= COHORT_MIN_TO_ACTIVATE
        ? { state: "active" }
        : {}),
    });
  }
  await batch.commit();
}

/* ---------------- Milestone submissions ---------------- */

function submissionId(milestoneId: number, uid: string): string {
  return `${milestoneId}_${uid}`;
}

export function watchSubmissions(
  cohortId: string,
  cb: (subs: MilestoneSubmission[]) => void
): Unsubscribe {
  return onSnapshot(collection(getDb(), "cohorts", cohortId, "submissions"), (snap) => {
    cb(snap.docs.map((d) => d.data() as MilestoneSubmission));
  });
}

/** Submit (or resubmit — same doc id) evidence for a milestone. A
 *  submission is a qualifying action, so it also feeds the streak. */
export async function submitMilestone(
  cohortId: string,
  profile: Profile,
  milestoneId: number,
  evidenceUrl: string,
  note: string
): Promise<void> {
  await setDoc(
    doc(getDb(), "cohorts", cohortId, "submissions", submissionId(milestoneId, profile.uid)),
    {
      uid: profile.uid,
      name: profile.name,
      milestoneId,
      evidenceUrl,
      note,
      status: "submitted",
      verifierUid: null,
      verifierName: null,
      returnReason: null,
      createdAt: serverTimestamp(),
      decidedAt: null,
    }
  );
  await touchStreak(profile);
}

/** Verify or return a submission. Milestones 1–3: the cohort peer-lead.
 *  4–7: a mentor. Verified milestones pay their XP to the submitter;
 *  returned ones come back with a specific reason and a resubmit path —
 *  returned ≠ rejected, and streaks never punish a return. */
export async function decideSubmission(
  cohortId: string,
  sub: MilestoneSubmission,
  verifier: Profile,
  verdict: "verified" | "returned",
  returnReason: string | null = null
): Promise<void> {
  const db = getDb();
  await updateDoc(
    doc(db, "cohorts", cohortId, "submissions", submissionId(sub.milestoneId, sub.uid)),
    {
      status: verdict,
      verifierUid: verifier.uid,
      verifierName: verifier.name,
      returnReason: verdict === "returned" ? returnReason : null,
      decidedAt: serverTimestamp(),
    }
  );
  if (verdict === "verified") {
    const m = milestone(sub.milestoneId);
    if (m) {
      await updateDoc(doc(db, "profiles", sub.uid), {
        xp: increment(m.xp),
        updatedAt: serverTimestamp(),
      });
    }
  }
}

/* ---------------- Build log ---------------- */

export function watchBuildLogs(
  cohortId: string,
  cb: (logs: BuildLog[]) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "cohorts", cohortId, "logs"),
    orderBy("createdAt", "desc"),
    limit(40)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BuildLog));
  });
}

/** The cheapest qualifying action: one line keeps the streak alive.
 *  XP is capped at one log per local day. */
export async function addBuildLog(
  cohortId: string,
  profile: Profile,
  text: string
): Promise<void> {
  const db = getDb();
  const today = localDay();
  await addDoc(collection(db, "cohorts", cohortId, "logs"), {
    uid: profile.uid,
    name: profile.name,
    text,
    day: today,
    createdAt: serverTimestamp(),
  });
  if (profile.lastBuildLogDay !== today) {
    await updateDoc(doc(db, "profiles", profile.uid), {
      xp: increment(XP.buildLog),
      lastBuildLogDay: today,
      updatedAt: serverTimestamp(),
    });
  }
  await touchStreak(profile);
}

export async function removeBuildLog(cohortId: string, logId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "cohorts", cohortId, "logs", logId));
}

/* ---------------- Workshops ---------------- */

export async function getUpcomingWorkshops(): Promise<Workshop[]> {
  const q = query(
    collection(getDb(), "workshops"),
    where("startsAt", ">", Timestamp.now()),
    orderBy("startsAt", "asc"),
    limit(12)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workshop);
}

/** Finished sessions that have a recording posted — the on-demand shelf
 *  the Learn page promises. Newest first. */
export async function getPastWorkshops(): Promise<Workshop[]> {
  const q = query(
    collection(getDb(), "workshops"),
    where("startsAt", "<", Timestamp.now()),
    orderBy("startsAt", "desc"),
    limit(24)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Workshop)
    .filter((w) => w.recordingUrl);
}

export async function enrollWorkshop(uid: string, workshopId: string): Promise<void> {
  await updateDoc(doc(getDb(), "profiles", uid), {
    enrolledWorkshops: arrayUnion(workshopId),
    updatedAt: serverTimestamp(),
  });
}

/** Self-reported live attendance (client-trusted v1): 50 XP, once per
 *  workshop, and it counts as a qualifying action for the streak. */
export async function markAttended(profile: Profile, workshopId: string): Promise<void> {
  if (profile.attendedWorkshops.includes(workshopId)) return;
  await updateDoc(doc(getDb(), "profiles", profile.uid), {
    attendedWorkshops: arrayUnion(workshopId),
    xp: increment(XP.workshopLive),
    updatedAt: serverTimestamp(),
  });
  await touchStreak(profile);
}

/* ---------------- Admin: workshop authoring (mentors) ---------------- */

/** Everything a mentor edits — id and Firestore-owned fields excluded.
 *  startsAt is a JS Date in the form, stored as a Timestamp. */
export type WorkshopInput = Omit<Workshop, "id" | "startsAt"> & { startsAt: Date };

/** Live view of the whole catalog (past + upcoming) for the admin panel. */
export function watchAllWorkshops(cb: (workshops: Workshop[]) => void): Unsubscribe {
  const q = query(collection(getDb(), "workshops"), orderBy("startsAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workshop));
  });
}

function workshopDoc(input: WorkshopInput) {
  return {
    title: input.title,
    mentorName: input.mentorName,
    description: input.description,
    kind: input.kind,
    startsAt: Timestamp.fromDate(input.startsAt),
    durationMins: input.durationMins,
    meetLink: input.meetLink,
    open: input.open,
    levelGate: input.levelGate,
    milestoneId: input.milestoneId,
    recordingUrl: input.recordingUrl,
  };
}

export async function createWorkshop(input: WorkshopInput): Promise<string> {
  const ref = await addDoc(collection(getDb(), "workshops"), workshopDoc(input));
  return ref.id;
}

export async function updateWorkshop(id: string, input: WorkshopInput): Promise<void> {
  await setDoc(doc(getDb(), "workshops", id), workshopDoc(input));
}

export async function deleteWorkshop(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "workshops", id));
}

/* ---------------- Admin: member consent (mentors) ---------------- */

/** Operators awaiting parental consent — the mentor's approval queue.
 *  Single-field equality query (no composite index); sorted client-side. */
export function watchPendingConsent(cb: (profiles: Profile[]) => void): Unsubscribe {
  const q = query(
    collection(getDb(), "profiles"),
    where("consentStatus", "==", "pending")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => normalizeProfile(d.id, d.data())));
  });
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
