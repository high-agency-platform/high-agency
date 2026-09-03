import type { Timestamp } from "firebase/firestore";

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

/** Public age band — exact DOB lives in the private doc, never here. */
export type AgeBand = "13-15" | "16-17" | "18+";

export type VentureStage = "idea" | "building" | "launched" | "revenue";

export type WeeklyHours = "<3" | "3-5" | "5-10" | "10+";

export type ConsentStatus = "none" | "pending" | "granted";

export type Plan = "free" | "pro";

/** mentor is staff-assigned — via a single-use invite link (`/mentor/join`,
 *  minted by scripts/mentor-invite.js) or the break-glass admin script. */
export type Role = "operator" | "mentor";

/** What the mentor signup form submits to POST /api/mentor/redeem. The server
 *  (Admin SDK, bypasses rules) sanitizes + bounds every field itself before
 *  writing the profile — this type is the wire contract, not the validation.
 *  Deliberately no DOB / parent email: mentors are adults (attested 18+ in the
 *  form), so no privateProfiles doc is created and consent is "granted". */
export interface MentorSignupInput {
  firstName: string;
  lastName: string;
  country: string;
  /** IANA timezone from the browser — office-hours scheduling signal. */
  timezone: string;
  /** Credibility one-liner, e.g. "Founder of X — 2 exits". */
  headline: string;
  /** What they're building/working on now (optional, like operators). */
  building: string;
  stage: VentureStage;
  /** Expertise areas — DOMAINS presets or free-typed tags (mentors are niche
   *  experts); server-normalized via normalizeFocusTag, capped at 9. */
  domains: string[];
  /** What they can coach — SKILLS presets or free-typed tags; server-
   *  normalized, capped at 7. */
  skills: string[];
  proofUrl: string;
  proofNote: string;
  bio: string;
  links: { github: string; linkedin: string; site: string };
  /** Signup day in the mentor's local time (YYYY-MM-DD) — seeds the streak
   *  fields the same client-trusted way operator onboarding does. */
  localDay: string;
}

export const DOMAINS = [
  "AI",
  "Web/Apps",
  "Hardware",
  "Content",
  "E-commerce",
  "Nonprofit",
  "Science",
  "Finance",
  "Other",
] as const;
export type Domain = (typeof DOMAINS)[number];

/** Focus tags on a squad may be picked from DOMAINS *or* typed freely. Custom
 *  tags are user text that ends up cross-cohort readable (and minor-facing), so
 *  they're always run through normalizeFocusTag + bounded by these caps before
 *  they touch Firestore. Rules can't loop a list to check element length, so
 *  the per-tag limit is client-enforced; the total count is bounded both here
 *  and in firestore.rules (validStringList). */
export const MAX_FOCUS_TAGS = 6;
export const MAX_TAG_LEN = 24;

/** Clean a free-typed focus tag: unicode-normalize, drop anything that isn't a
 *  letter/number/space or a light technical separator (kills emoji, control
 *  chars, and punctuation soup), collapse whitespace, and clamp length. Returns
 *  "" when nothing usable survives (e.g. "🔥🔥" or "  ") — callers drop those. */
export function normalizeFocusTag(raw: string): string {
  const cleaned = raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s&/+.#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TAG_LEN);
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : "";
}

export const SKILLS = [
  "Coding",
  "Design",
  "Video",
  "Sales/Outreach",
  "Writing",
  "Marketing",
  "Ops",
] as const;
export type Skill = (typeof SKILLS)[number];

/** Operator profile — the artifact cohorts evaluate and matching consumes.
 *  Deliberately privacy-lean: name is always "First L.", age is a band,
 *  location is country + timezone only. Exact DOB/city/parent email live
 *  in privateProfiles/{uid}, readable by the owner alone. */
export interface Profile {
  uid: string;
  /** Display name, always "First L." — built at signup, never the full name. */
  name: string;
  ageBand: AgeBand;
  country: string;
  /** IANA timezone derived from the browser at signup, used for matching. */
  timezone: string;
  /** One-line hook, e.g. "Building an AI study planner with 500 users". */
  headline: string;
  /** What they're building / want to build (<=300 chars). */
  building: string;
  stage: VentureStage;
  domains: string[];
  skills: string[];
  /** Link to the best thing they've ever made — highest-signal field. */
  proofUrl: string;
  /** One sentence about the proof. */
  proofNote: string;
  /** Deprecated on the profile: weekly commitment is now captured
   *  per-application (it varies by what a squad is building). Kept
   *  optional so legacy profile docs still validate and read. */
  hours?: WeeklyHours;
  /** Personality, not résumé (<=300 chars). */
  bio: string;
  links: { github: string; linkedin: string; site: string };

  /** Minors start "pending" until a parent confirms; adults are "granted". */
  consentStatus: ConsentStatus;
  /** When the parental-consent email was last dispatched (server-set, admin
   *  SDK). Gives mentors context in the consent queue; absent until sent. */
  consentEmailSentAt?: Timestamp;
  /** Dormant monetization scaffold — everyone is "free"; nothing reads it. */
  plan: Plan;
  role: Role;

  /* ---- streak (the only game mechanic) ---- */
  streak: number;
  /** Banked streak freezes (earned 1 per 7-day streak, max 3). */
  streakFreezes: number;
  /** Last day (YYYY-MM-DD, user-local) that counted toward the streak. */
  lastActiveDay: string;
  /** Last local day a build log was posted — "shipped today" on the home screen. */
  lastBuildLogDay: string;

  /* ---- workshops ---- */
  /** Mirror of workshops/{id}.enrolledUids for cheap per-user reads. */
  enrolledWorkshops: string[];

  /** LEGACY (squad era): cohort ids with a pending application. Nothing
   *  writes or reads it now; existing docs still carry it and the rules
   *  tolerate it. Never make this required again. */
  pendingApplications?: string[];

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** Owner-only document: everything we collect but never expose. */
export interface PrivateProfile {
  uid: string;
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD. */
  dob: string;
  city: string;
  /** Set for minors; consent email goes here. */
  parentEmail: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Cohorts (squad model: own ventures, shared track, shared ritual)    */
/* ------------------------------------------------------------------ */

export type CohortState = "forming" | "active" | "stalled" | "archived";

export const COHORT_MIN_TO_ACTIVATE = 3;
export const COHORT_MAX_MEMBERS = 8;

/** A squad goes live only when it has a real crew AND a mentor who owns it.
 *  The mentor writes and advances the track, so activating without one hands
 *  a squad a season nobody is running. Mirrored in firestore.rules. */
export function canActivate(c: {
  memberUids: string[];
  mentorUid?: string | null;
}): boolean {
  return c.memberUids.length >= COHORT_MIN_TO_ACTIVATE && !!c.mentorUid;
}

export interface Cohort {
  id: string;
  name: string;
  /** One-line mission, shown on the discovery list. */
  mission: string;
  /** Domain focus tags — matching signal. */
  tags: string[];
  /** Skills the squad wants to recruit. */
  lookingFor: string[];
  /** Committed weekly ritual slot, e.g. "Sundays 7pm ET" — required. */
  meetingSlot: string;
  /** Founder's IANA timezone — used for timezone-overlap matching. */
  timezone: string;
  state: CohortState;
  founderUid: string;
  founderName: string;
  /** The mentor who adopted this squad from the adoption feed. Absent until
   *  one does — and a squad can't leave `forming` without it (see
   *  COHORT_MIN_TO_ACTIVATE + canActivate). The mentor owns the squad's track
   *  and takes its check-in requests. */
  mentorUid?: string;
  mentorName?: string;
  /** When ops was last emailed that this squad is still unassigned. Written
   *  only by the Admin SDK (the daily cron) so the same squad doesn't page
   *  info@high-agency.io every morning forever. */
  mentorNotifiedAt?: Timestamp;
  memberUids: string[];
  /** Denormalized display names so member lists render without N reads. */
  memberNames: Record<string, string>;
  open: boolean;
  /** Optional landing page for the squad — a site, deck, or demo link.
   *  Founder-set, shown to signed-in users; validated http(s) in the rules. */
  link?: string;
  /** Optional square icon, stored inline as a compressed data: URL (bounded by
   *  COHORT_ICON_MAX_CHARS) so squads get a picture without a Storage bucket —
   *  and, being inline, it loads nothing external onto a minor-facing page. */
  icon?: string;
  /** Consecutive weeks the squad marked its ritual held. */
  weeklyStreak: number;
  /** Last ISO week (YYYY-Www) that counted. */
  lastRitualWeek: string;
  /** The squad's track — authored and advanced by its mentor alone. Absent
   *  until the mentor sets one. See TrackMilestone. */
  track?: TrackMilestone[];
  trackUpdatedAt?: Timestamp;
  createdAt?: Timestamp;
}

/* ------------------------------------------------------------------ */
/* The track (mentor-authored, per squad)                              */
/* ------------------------------------------------------------------ */

/** One step on a squad's track. The mentor writes the list, orders it, sets
 *  optional due days, and marks steps done for the whole squad. There is no
 *  operator-side submission: the mentor is the single source of truth for
 *  progress, and the squad reads it. Stored inline on the cohort doc so the
 *  whole track is one read and one write. */
export interface TrackMilestone {
  /** Stable within the squad; never reused. */
  id: string;
  title: string;
  /** What "done" looks like — the mentor's words, not a spec. */
  detail: string;
  /** Optional target day, YYYY-MM-DD, or "". */
  dueDay: string;
  /** Epoch ms when the mentor marked it done for the squad; null = not yet. */
  doneAt: number | null;
}

export const TRACK_MAX_MILESTONES = 20;
export const TRACK_TITLE_MAX = 80;
export const TRACK_DETAIL_MAX = 300;

/** The first milestone not yet done — what the squad is on right now. */
export function currentMilestone(track: TrackMilestone[] | undefined): TrackMilestone | null {
  return (track ?? []).find((m) => !m.doneAt) ?? null;
}

/** Squad icon: center-cropped to a square this many px before it's encoded. */
export const COHORT_ICON_PX = 128;
/** Hard cap on the icon data: URL length (~30KB). Keeps discovery-list reads
 *  lean and stays well under Firestore's 1MB doc limit. Mirrored in the rules. */
export const COHORT_ICON_MAX_CHARS = 40000;

/** Trim + light-normalize a user-typed URL: prefix https:// when it's
 *  scheme-less so "yoursquad.com" becomes a real link. "" stays "". The rules
 *  additionally enforce the http(s) shape server-side. */
export function normalizeLink(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/* ------------------------------------------------------------------ */
/* Applications                                                        */
/* ------------------------------------------------------------------ */

export type ApplicationStatus = "pending" | "accepted" | "declined";

/** One-tap decline reasons so rejection is informative, not silent. */
export type DeclineReason = "full" | "different_focus" | "timezone";

export const DECLINE_LABELS: Record<DeclineReason, string> = {
  full: "Squad is full",
  different_focus: "Different focus",
  timezone: "Timezone mismatch",
};

export interface CohortApplication {
  /** Doc id == applicantUid, which also de-dupes repeat applications. */
  applicantUid: string;
  applicantName: string;
  /** "Why this cohort, and what do you bring?" (<=300 chars). */
  pitch: string;
  /** Weekly hours the applicant can commit *to this squad* — captured at
   *  apply time because commitment varies with what's being built. */
  hours: WeeklyHours;
  status: ApplicationStatus;
  declineReason: DeclineReason | null;
  createdAt?: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Build log (the sleeper feature)                                     */
/* ------------------------------------------------------------------ */

export interface BuildLog {
  id: string;
  uid: string;
  name: string;
  /** One-liner to a short paragraph (<=300 chars). */
  text: string;
  /** YYYY-MM-DD in the author's local time. */
  day: string;
  createdAt?: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Workshops                                                           */
/* ------------------------------------------------------------------ */

export interface Workshop {
  id: string;
  title: string;
  /** Display name of the owning mentor, stamped server-side from their profile. */
  mentorName: string;
  /** Owner. Stamped from auth on create, immutable after. */
  mentorUid?: string;
  description: string;
  startsAt: Timestamp;
  durationMins: number;
  /** Where the room is. Comes from the Google Calendar event when the mentor
   *  has connected their calendar; otherwise whatever they pasted. */
  meetLink: string;
  /** Seat cap — required on every session authored now. Absent on legacy
   *  docs, which read as uncapped (see workshopSpots). */
  capacity?: number;
  /** Who's in. Lives on the workshop doc so the cap is countable in one read;
   *  profiles.enrolledWorkshops is a mirror for cheap per-user reads. */
  enrolledUids?: string[];
  /** Posted after the session. */
  recordingUrl: string;
  /** Google Calendar event on the host mentor's calendar, when linked. */
  calendarEventId?: string;
}

/** Allowed seat range for an authored workshop. Below 2 it isn't a workshop
 *  (it's a check-in); above 200 it isn't a cohort session. Mirrored in
 *  firestore.rules. */
export const WORKSHOP_MIN_CAPACITY = 2;
export const WORKSHOP_MAX_CAPACITY = 200;
export const WORKSHOP_DEFAULT_CAPACITY = 15;

/** Seat math, tolerant of legacy docs. `capacity: undefined` (pre-capacity
 *  seeds) reads as uncapped so nothing crashes and nobody is locked out. */
export function workshopSpots(w: Workshop): {
  taken: number;
  capacity: number | null;
  left: number | null;
  full: boolean;
} {
  const taken = (w.enrolledUids ?? []).length;
  const capacity = typeof w.capacity === "number" ? w.capacity : null;
  const left = capacity === null ? null : Math.max(0, capacity - taken);
  return { taken, capacity, left, full: left !== null && left === 0 };
}

/* ------------------------------------------------------------------ */
/* Squad check-ins (what office hours became)                          */
/* ------------------------------------------------------------------ */

/** A squad-scoped session with the squad's own mentor. Not a catalog item:
 *  a member requests one, the assigned mentor puts a time + link on it, and
 *  only that squad plus its mentor can ever see it. Lives at
 *  `cohorts/{cohortId}/checkIns/{id}` so read scoping is the squad roster. */
export type CheckInStatus = "requested" | "confirmed";

export interface CheckIn {
  id: string;
  cohortId: string;
  requestedByUid: string;
  requestedByName: string;
  /** "What we need help with" — optional, short on purpose. */
  note: string;
  status: CheckInStatus;
  /** The squad's assigned mentor at request time; only they can confirm. */
  mentorUid: string;
  mentorName: string;
  /** Set on confirm. */
  startsAt: Timestamp | null;
  durationMins: number;
  meetLink: string;
  /** Google Calendar event on the mentor's calendar, when linked. */
  calendarEventId?: string;
  createdAt?: Timestamp;
  confirmedAt?: Timestamp | null;
}

export const CHECKIN_NOTE_MAX = 200;
export const CHECKIN_DEFAULT_MINS = 30;
/** Nudge the squad to book one once it's been this long. Nudge only — a
 *  squad is never blocked or penalised for going quiet. */
export const CHECKIN_NUDGE_WEEKS = 2;

/* ------------------------------------------------------------------ */
/* The season — ONE shared track, every mentor edits it                */
/* ------------------------------------------------------------------ */

/** Exactly one season is "live" at a time. The operator page reads it by
 *  state, never by a fixed id, so season 2 can't collide with season 1's
 *  submissions (they live in a subcollection under the season). */
export type SeasonState = "draft" | "live" | "archived";

/** Who closes a milestone out.
 *  "open"   — posting the proof completes it, and every member can see it.
 *  "mentor" — a mentor approves or returns it; the proof is private to the
 *             author and the mentors, and stays private after approval.
 *  The mentor's source copy says `peer_lead`; normalizeVerifier() maps it. */
export type Verifier = "open" | "mentor";

export interface SeasonMilestone {
  /** Stable for the life of the season and NEVER regenerated on edit —
   *  submission doc ids are built from it (see submissionKey). */
  id: string;
  title: string;
  /** Why it matters — the mentor's paragraph. Longer than the old squad
   *  track's detail cap on purpose: this is the teaching, not a label. */
  why: string;
  /** Exactly what to submit, in the mentor's words. */
  proof: string;
  /** "2–3 hours". Free text, never parsed. */
  effort: string;
  verifier: Verifier;
  /** Suggested session TITLES — display-only chips, not links. A season is
   *  written before its workshops exist; the two are matched by eye. */
  sessions: string[];
}

export interface Season {
  id: string;
  name: string;
  kind: string;
  category: string;
  duration: string;
  tagline: string;
  overview: string;
  outcome: string;
  state: SeasonState;
  milestones: SeasonMilestone[];
  createdAt?: Timestamp;
  /** Doubles as the editor's optimistic-concurrency token: a save must quote
   *  the updatedAt it read, or the server refuses it as stale. */
  updatedAt?: Timestamp;
  updatedByUid?: string;
  updatedByName?: string;
}

export const SEASON_MAX_MILESTONES = 20;
export const SEASON_NAME_MAX = 80;
export const SEASON_KIND_MAX = 40;
export const SEASON_CATEGORY_MAX = 60;
export const SEASON_DURATION_MAX = 40;
export const SEASON_TAGLINE_MAX = 160;
export const SEASON_OVERVIEW_MAX = 1200;
export const SEASON_OUTCOME_MAX = 300;
export const MILESTONE_TITLE_MAX = 80;
export const MILESTONE_WHY_MAX = 600;
export const MILESTONE_PROOF_MAX = 300;
export const MILESTONE_EFFORT_MAX = 40;
export const MILESTONE_SESSIONS_MAX = 4;
export const MILESTONE_SESSION_TITLE_MAX = 120;

/** Wire → stored. Anything unrecognised FAILS CLOSED to "mentor": an unknown
 *  verifier must never become a self-approval. */
export function normalizeVerifier(raw: unknown): Verifier {
  return raw === "open" || raw === "peer_lead" ? "open" : "mentor";
}

/** A fresh milestone id. Minted once, on the server, for rows that arrive
 *  without one; never re-minted for a row that already has one. */
export function milestoneId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------ */
/* Proof submissions — one per operator per milestone                  */
/* ------------------------------------------------------------------ */

export type SubmissionStatus = "submitted" | "approved" | "returned";

/** Lives at seasons/{seasonId}/submissions/{uid}__{milestoneId}: exactly one
 *  row per pair, so a resubmit is an overwrite. Written ONLY by the server
 *  (POST /api/submissions, POST /api/submissions/review). */
export interface Submission {
  id: string;
  seasonId: string;
  milestoneId: string;
  /** Denormalized; survives the mentor renaming the milestone. */
  milestoneTitle: string;
  uid: string;
  /** "First L.", denormalized so a queue renders in one read. */
  name: string;
  proofUrl: string;
  note: string;
  /** Snapshot of the milestone's verifier AT SUBMIT TIME, stamped by the
   *  server. The read rule keys off this copy, so flipping a milestone
   *  mentor→open later never retroactively exposes proof made privately. */
  verifier: Verifier;
  status: SubmissionStatus;
  /** 1 on first submit, +1 on every resubmit after a return. */
  attempt: number;
  /** "" until a mentor acts; `open` rows never get one. */
  reviewedByUid: string;
  reviewedByName: string;
  reviewedAt: Timestamp | null;
  /** The mentor's words on a return — specific, never punitive. Carried
   *  through a resubmit so the operator can still read it while they redo. */
  reviewNote: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const SUBMISSION_URL_MAX = 500;
export const SUBMISSION_NOTE_MAX = 500;
export const REVIEW_NOTE_MAX = 300;

export function submissionKey(uid: string, milestoneId: string): string {
  return `${uid}__${milestoneId}`;
}

export function byMilestone(subs: Submission[]): Record<string, Submission> {
  const out: Record<string, Submission> = {};
  for (const s of subs) out[s.milestoneId] = s;
  return out;
}

/** Progress is DERIVED: a shared season has no single "done", only one per
 *  operator. Approved is the only state that counts, for both verifier kinds. */
export function seasonProgress(
  season: Season | null | undefined,
  mine: Submission[]
): { done: number; total: number } {
  const approved = new Set(mine.filter((s) => s.status === "approved").map((s) => s.milestoneId));
  const list = season?.milestones ?? [];
  return { done: list.filter((m) => approved.has(m.id)).length, total: list.length };
}

/** The first milestone this operator hasn't had approved. Visual only —
 *  nothing is gated; any milestone may be submitted in any order. */
export function nextMilestone(
  season: Season | null | undefined,
  mine: Submission[]
): SeasonMilestone | null {
  const approved = new Set(mine.filter((s) => s.status === "approved").map((s) => s.milestoneId));
  return (season?.milestones ?? []).find((m) => !approved.has(m.id)) ?? null;
}
