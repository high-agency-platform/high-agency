/**
 * Firestore security-rules tests for parental-consent enforcement (and the
 * pre-existing write paths it guards). Run against the Firestore emulator:
 *
 *   npm run test:rules
 *
 * which wraps `node --test` in `firebase emulators:exec --only firestore`, so
 * the emulator is up and FIRESTORE_EMULATOR_HOST is set for us.
 *
 * The core claim under test: a minor whose consentStatus is "pending" is
 * DENIED — at the rules level — from every community write (create cohort,
 * apply, submit milestone, post build log, tick the ritual), while a "granted"
 * operator succeeds at the identical writes. Plus: a pending minor can't
 * self-grant consent, and the consentTokens collection is fully locked to
 * clients.
 */
import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const PROJECT_ID = "highagency-rules-test";

/** A fully rules-valid profile, parameterised by consent state. */
function profile(uid, consentStatus) {
  return {
    uid,
    name: "Test O.",
    ageBand: consentStatus === "granted" ? "18+" : "13-15",
    country: "Canada",
    timezone: "America/Toronto",
    headline: "Building something real",
    building: "An app",
    stage: "building",
    domains: ["AI"],
    skills: ["Coding"],
    consentStatus,
    plan: "free",
    role: "operator",
    xp: 0,
    streak: 1,
    streakFreezes: 0,
    lastActiveDay: "2026-07-10",
    pendingApplications: [],
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
}

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed with rules bypassed: two operators (one pending minor, one granted),
  // a squad they both belong to, and a separate open squad to apply into.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "profiles/minor"), profile("minor", "pending"));
    await setDoc(doc(db, "profiles/granted"), profile("granted", "granted"));
    await setDoc(doc(db, "profiles/founder"), profile("founder", "granted"));

    // A squad both test users are members of (so membership-gated writes reach
    // the consent check). Only the fields the rules read are needed.
    await setDoc(doc(db, "cohorts/squad"), {
      founderUid: "founder",
      peerLeadUid: "founder",
      memberUids: ["founder", "minor", "granted"],
      weeklyStreak: 2,
      lastRitualWeek: "2026-W27",
    });
    // A different squad neither is a member of, to apply into.
    await setDoc(doc(db, "cohorts/openSquad"), {
      founderUid: "founder",
      peerLeadUid: "founder",
      memberUids: ["founder"],
      weeklyStreak: 0,
    });
  });
});

/* ---- shared write attempts, parameterised by the acting uid ---- */

function createCohort(db, uid) {
  return addDoc(collection(db, "cohorts"), {
    name: "New Squad",
    mission: "Ship something",
    meetingSlot: "Sundays 7pm ET",
    timezone: "America/Toronto",
    state: "forming",
    founderUid: uid,
    founderName: "Test O.",
    peerLeadUid: uid,
    memberUids: [uid],
    memberNames: { [uid]: "Test O." },
    open: true,
    weeklyStreak: 0,
    createdAt: serverTimestamp(),
  });
}

function applyToOpenSquad(db, uid) {
  return setDoc(doc(db, "cohorts/openSquad/applications", uid), {
    applicantUid: uid,
    applicantName: "Test O.",
    pitch: "Let me in",
    hours: "3-5",
    status: "pending",
    declineReason: null,
    createdAt: serverTimestamp(),
  });
}

function submitMilestone(db, uid) {
  return setDoc(doc(db, `cohorts/squad/submissions/1_${uid}`), {
    uid,
    name: "Test O.",
    milestoneId: 1,
    evidenceUrl: "https://example.com/proof",
    status: "submitted",
  });
}

function postBuildLog(db, uid) {
  return addDoc(collection(db, "cohorts/squad/logs"), {
    uid,
    name: "Test O.",
    text: "Shipped the landing page",
    day: "2026-07-10",
    createdAt: serverTimestamp(),
  });
}

function tickRitual(db) {
  return updateDoc(doc(db, "cohorts/squad"), {
    weeklyStreak: 3,
    lastRitualWeek: "2026-W28",
  });
}

/* ================= pending minor: every community write DENIED ============ */

test("pending minor is denied: create cohort", async () => {
  const db = testEnv.authenticatedContext("minor").firestore();
  await assertFails(createCohort(db, "minor"));
});

test("pending minor is denied: create application", async () => {
  const db = testEnv.authenticatedContext("minor").firestore();
  await assertFails(applyToOpenSquad(db, "minor"));
});

test("pending minor is denied: create milestone submission", async () => {
  const db = testEnv.authenticatedContext("minor").firestore();
  await assertFails(submitMilestone(db, "minor"));
});

test("pending minor is denied: post build log", async () => {
  const db = testEnv.authenticatedContext("minor").firestore();
  await assertFails(postBuildLog(db, "minor"));
});

test("pending minor is denied: ritual update", async () => {
  const db = testEnv.authenticatedContext("minor").firestore();
  await assertFails(tickRitual(db));
});

/* ================= granted operator: identical writes SUCCEED ============= */

test("granted operator is allowed: create cohort", async () => {
  const db = testEnv.authenticatedContext("granted").firestore();
  await assertSucceeds(createCohort(db, "granted"));
});

test("granted operator is allowed: create application", async () => {
  const db = testEnv.authenticatedContext("granted").firestore();
  await assertSucceeds(applyToOpenSquad(db, "granted"));
});

test("granted operator is allowed: create milestone submission", async () => {
  const db = testEnv.authenticatedContext("granted").firestore();
  await assertSucceeds(submitMilestone(db, "granted"));
});

test("granted operator is allowed: post build log", async () => {
  const db = testEnv.authenticatedContext("granted").firestore();
  await assertSucceeds(postBuildLog(db, "granted"));
});

test("granted member is allowed: ritual update", async () => {
  const db = testEnv.authenticatedContext("granted").firestore();
  await assertSucceeds(tickRitual(db));
});

/* ================= consent can't be self-granted ========================= */

test("pending minor cannot self-grant consent via profile update", async () => {
  const db = testEnv.authenticatedContext("minor").firestore();
  await assertFails(
    updateDoc(doc(db, "profiles/minor"), {
      consentStatus: "granted",
      updatedAt: serverTimestamp(),
    })
  );
});

test("operator can still edit their own profile (consent unchanged)", async () => {
  const db = testEnv.authenticatedContext("granted").firestore();
  await assertSucceeds(
    updateDoc(doc(db, "profiles/granted"), {
      headline: "New headline",
      updatedAt: serverTimestamp(),
    })
  );
});

/* ================= consentTokens are server-only ========================= */

test("clients cannot read or write consentTokens", async () => {
  const authed = testEnv.authenticatedContext("minor").firestore();
  await assertFails(getDoc(doc(authed, "consentTokens/abc")));
  await assertFails(setDoc(doc(authed, "consentTokens/abc"), { uid: "minor" }));

  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, "consentTokens/abc")));
});

/* ================= sanity: reads stay open while pending ================= */

test("pending minor can still READ (sees the waiting-on-consent state)", async () => {
  const db = testEnv.authenticatedContext("minor").firestore();
  await assertSucceeds(getDoc(doc(db, "profiles/minor")));
  await assertSucceeds(getDoc(doc(db, "cohorts/squad")));
});
