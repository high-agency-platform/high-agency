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

/** mentor is staff-assigned (admin script); peer-leads are per-cohort. */
export type Role = "operator" | "mentor";

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
  /** Entitlement flag — wired now, everything is free during batch 1. */
  plan: Plan;
  role: Role;

  /* ---- gamification ---- */
  xp: number;
  streak: number;
  /** Banked streak freezes (earned 1 per 7-day streak, max 3). */
  streakFreezes: number;
  /** Last day (YYYY-MM-DD, user-local) that counted toward the streak. */
  lastActiveDay: string;
  /** Caps: one build-log XP per day, one ritual XP per ISO week. */
  lastBuildLogDay: string;
  lastRitualWeek: string;

  /* ---- workshops ---- */
  enrolledWorkshops: string[];
  attendedWorkshops: string[];

  /** Cohort ids with a live pending application (hard cap 3). */
  pendingApplications: string[];

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
  /** Verifies milestones 1–3 for the squad (defaults to the founder). */
  peerLeadUid: string;
  memberUids: string[];
  /** Denormalized display names so member lists render without N reads. */
  memberNames: Record<string, string>;
  open: boolean;
  /** Consecutive weeks the squad held its ritual + someone progressed. */
  weeklyStreak: number;
  /** Last ISO week (YYYY-Www) that counted. */
  lastRitualWeek: string;
  createdAt?: Timestamp;
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
/* Milestone submissions (per-operator — the squad model)              */
/* ------------------------------------------------------------------ */

export type SubmissionStatus = "submitted" | "returned" | "verified";

/** Doc id == `${milestoneId}_${uid}` so one submission per operator
 *  per milestone, and resubmits overwrite in place. */
export interface MilestoneSubmission {
  uid: string;
  name: string;
  /** 1–7, indexes into the default track (lib/milestones.ts). */
  milestoneId: number;
  /** Public link to the evidence (doc, screenshot album, live URL…). */
  evidenceUrl: string;
  /** What the verifier should look at (<=500 chars). */
  note: string;
  status: SubmissionStatus;
  verifierUid: string | null;
  verifierName: string | null;
  /** Set when returned — specific, actionable, never punitive. */
  returnReason: string | null;
  createdAt?: Timestamp;
  decidedAt?: Timestamp | null;
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
  mentorName: string;
  description: string;
  kind: "workshop" | "office_hours";
  startsAt: Timestamp;
  durationMins: number;
  meetLink: string;
  /** The one free "open workshop" per season — everyone can join. */
  open: boolean;
  /** Minimum operator level to enroll (0 = none). Level-gated, not paid-gated. */
  levelGate: number;
  /** Which default-track milestone this workshop teaches (0 = none). */
  milestoneId: number;
  /** Posted after the session; free after 30 days, immediate for Pro. */
  recordingUrl: string;
}
