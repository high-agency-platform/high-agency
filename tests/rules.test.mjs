/**
 * Firestore security-rules tests: the founding-batch gate, the profile
 * invariants (consent, the server-written streak, tolerated legacy fields),
 * workshops (server-only writes), THE SEASON and its proof submissions
 * (server-only writes; reads split by the row's snapshotted verifier), and
 * the season feed. Run against the Firestore emulator:
 *
 *   npm run test:rules
 *
 * which wraps `node --test` in `firebase emulators:exec --only firestore`, so
 * the emulator is up and FIRESTORE_EMULATOR_HOST is set for us.
 *
 * The claims that matter most:
 *  - no client can write a season, a submission or a build log by any path;
 *  - a 'mentor'-verifier submission is readable by its author and by mentors,
 *    and by NOBODY else — while an 'open' one is readable by every member;
 *  - a list over submissions is all-or-nothing: the public wall MUST filter
 *    on verifier == 'open' or it is denied;
 *  - a profile that still carries the squad-era `pendingApplications` field
 *    can still be updated (an update is validated as the merged doc).
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
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  arrayUnion,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const PROJECT_ID = "highagency-rules-test";

/** A fully rules-valid profile, parameterised by consent state. Shaped the
 *  way the app writes one TODAY — no pendingApplications. */
function profile(uid, consentStatus, role = "operator") {
  return {
    uid,
    name: "Test O.",
    role,
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
    streak: 1,
    streakFreezes: 0,
    lastActiveDay: "2026-07-10",
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
}

/** A workshop owned by mentorA, shaped like the server writes it. */
function workshop(overrides = {}) {
  return {
    title: "The Cold Ask",
    mentorName: "Mentor A.",
    mentorUid: "mentorA",
    description: "",
    startsAt: Timestamp.fromMillis(Date.now() + 86400000),
    durationMins: 60,
    meetLink: "https://meet.example/x",
    capacity: 3,
    enrolledUids: [],
    recordingUrl: "",
    ...overrides,
  };
}

/** A submission, shaped like the server writes it. */
function submission(uid, milestoneId, verifier, status, overrides = {}) {
  return {
    seasonId: "s1",
    milestoneId,
    milestoneTitle: milestoneId,
    uid,
    name: "Test O.",
    proofUrl: "https://example.com/proof",
    note: "",
    verifier,
    status,
    attempt: 1,
    reviewedByUid: "",
    reviewedByName: "",
    reviewedAt: null,
    reviewNote: "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
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
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Operators: a pending minor, two granted adults, and a legacy doc that
    // still carries the squad-era field.
    await setDoc(doc(db, "profiles/minor"), profile("minor", "pending"));
    await setDoc(doc(db, "profiles/granted"), profile("granted", "granted"));
    await setDoc(doc(db, "profiles/other"), profile("other", "granted"));
    await setDoc(doc(db, "profiles/legacy"), {
      ...profile("legacy", "granted"),
      pendingApplications: ["oldSquad"],
      xp: 250,
    });
    // Two mentors, so "another mentor" is always available to a test.
    await setDoc(doc(db, "profiles/mentorA"), profile("mentorA", "granted", "mentor"));
    await setDoc(doc(db, "profiles/mentorB"), profile("mentorB", "granted", "mentor"));

    // TEMPORARY — founding-batch access gate. Profile CREATE also requires
    // the caller's token email to be on this allowlist. Seeded with rules
    // bypassed, exactly as staff writes it (Console / scripts/approve.js).
    await setDoc(doc(db, "approvedMembers/approved@example.com"), {
      role: "operator",
      name: "Approved O.",
      addedAt: Date.now(),
    });
    // Hand-created-in-the-Console shape: role only, no addedAt. Must still work.
    await setDoc(doc(db, "approvedMembers/wannabe@example.com"), {
      role: "operator",
    });

    // The live season: one open step, one mentor-reviewed step.
    await setDoc(doc(db, "seasons/s1"), {
      name: "Developing High Agency",
      state: "live",
      milestones: [
        { id: "cold-ask", title: "The Cold Ask", why: "", proof: "", effort: "", verifier: "open", sessions: [] },
        { id: "mission", title: "Mission Locked", why: "", proof: "", effort: "", verifier: "mentor", sessions: [] },
      ],
      updatedAt: Timestamp.now(),
    });
    // granted: an open row (public) and a mentor row (private, in review).
    await setDoc(doc(db, "seasons/s1/submissions/granted__cold-ask"), submission("granted", "cold-ask", "open", "approved"));
    await setDoc(doc(db, "seasons/s1/submissions/granted__mission"), submission("granted", "mission", "mentor", "submitted"));
    // other: a mentor row that was returned.
    await setDoc(doc(db, "seasons/s1/submissions/other__mission"), submission("other", "mission", "mentor", "returned", { reviewNote: "Add the who" }));

    // The season feed.
    await setDoc(doc(db, "buildLogs/l1"), {
      uid: "granted",
      name: "Test O.",
      text: "Shipped the landing page",
      day: "2026-07-10",
      createdAt: Timestamp.now(),
    });

    // mentorA's session with two seats, one already taken.
    await setDoc(doc(db, "workshops/owned"), workshop({ enrolledUids: ["someone"] }));
  });
});

const asUser = (uid, opts) => testEnv.authenticatedContext(uid, opts).firestore();
const subs = (db) => collection(db, "seasons/s1/submissions");

/* ========================================================================= *
 *  Profiles — the streak is server-written, consent can't be self-granted,
 *  legacy fields are tolerated, the gate holds on create
 * ========================================================================= */

test("STREAK: an operator cannot raise their own streak", async () => {
  const db = asUser("granted");
  await assertFails(updateDoc(doc(db, "profiles/granted"), { streak: 400, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "profiles/granted"), { streakFreezes: 3, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "profiles/granted"), { lastActiveDay: "2026-07-11", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "profiles/granted"), { lastBuildLogDay: "2026-07-11", updatedAt: serverTimestamp() }));
});

test("STREAK: an operator can still edit their card with the streak untouched", async () => {
  const db = asUser("granted");
  await assertSucceeds(updateDoc(doc(db, "profiles/granted"), { headline: "New line", updatedAt: serverTimestamp() }));
});

test("STREAK: a new profile cannot start with a banked streak", async () => {
  const db = asUser("approved", { email: "approved@example.com" });
  await assertFails(setDoc(doc(db, "profiles/approved"), { ...profile("approved", "granted"), streak: 30 }));
  await assertFails(setDoc(doc(db, "profiles/approved"), { ...profile("approved", "granted"), streakFreezes: 2 }));
  await assertSucceeds(setDoc(doc(db, "profiles/approved"), profile("approved", "granted")));
});

test("LEGACY: a profile that still carries pendingApplications can be updated", async () => {
  // An update is validated as the merged document, not the delta. If the
  // squad-era field ever leaves the allowed list, every existing profile
  // becomes silently unupdatable. This pins it.
  const db = asUser("legacy");
  await assertSucceeds(updateDoc(doc(db, "profiles/legacy"), { headline: "Still here", updatedAt: serverTimestamp() }));
});

test("LEGACY: a new profile is not required to carry pendingApplications", async () => {
  const db = asUser("newbie", { email: "approved@example.com" });
  await assertSucceeds(setDoc(doc(db, "profiles/newbie"), profile("newbie", "granted")));
});

test("pending minor cannot self-grant consent via profile update", async () => {
  const db = asUser("minor");
  await assertFails(updateDoc(doc(db, "profiles/minor"), { consentStatus: "granted", updatedAt: serverTimestamp() }));
});

test("a mentor can grant consent (the manual override)", async () => {
  const db = asUser("mentorA");
  await assertSucceeds(updateDoc(doc(db, "profiles/minor"), { consentStatus: "granted", updatedAt: serverTimestamp() }));
});

test("an operator cannot grant someone else's consent", async () => {
  const db = asUser("granted");
  await assertFails(updateDoc(doc(db, "profiles/minor"), { consentStatus: "granted", updatedAt: serverTimestamp() }));
});

test("clients cannot read or write consentTokens", async () => {
  const authed = asUser("minor");
  await assertFails(getDoc(doc(authed, "consentTokens/abc")));
  await assertFails(setDoc(doc(authed, "consentTokens/abc"), { uid: "minor" }));
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, "consentTokens/abc")));
});

test("clients cannot read or write mentorInvites", async () => {
  const authed = asUser("minor");
  await assertFails(getDoc(doc(authed, "mentorInvites/abc")));
  await assertFails(setDoc(doc(authed, "mentorInvites/abc"), { used: false }));
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, "mentorInvites/abc")));
});

test("client cannot create a profile with role mentor (invite route only)", async () => {
  // Allowlisted, so the ONLY thing under test here is the role restriction.
  const db = asUser("wannabe", { email: "wannabe@example.com" });
  await assertFails(setDoc(doc(db, "profiles/wannabe"), profile("wannabe", "granted", "mentor")));
});

test("client cannot promote themselves to mentor on update", async () => {
  const db = asUser("granted");
  await assertFails(updateDoc(doc(db, "profiles/granted"), { role: "mentor", updatedAt: serverTimestamp() }));
});

/* ---- TEMPORARY — the founding-batch gate ---- */

test("GATE: an allowlisted user can create their own profile", async () => {
  const db = asUser("newbie", { email: "approved@example.com" });
  await assertSucceeds(setDoc(doc(db, "profiles/newbie"), profile("newbie", "granted")));
});

test("GATE: the allowlist is matched case-insensitively", async () => {
  const db = asUser("shouty", { email: "Approved@Example.com" });
  await assertSucceeds(setDoc(doc(db, "profiles/shouty"), profile("shouty", "granted")));
});

test("GATE: a non-allowlisted user cannot create a profile", async () => {
  const db = asUser("stranger", { email: "stranger@example.com" });
  await assertFails(setDoc(doc(db, "profiles/stranger"), profile("stranger", "granted")));
});

test("GATE: a caller with no email on the token cannot create a profile", async () => {
  const db = asUser("tokenless");
  await assertFails(setDoc(doc(db, "profiles/tokenless"), profile("tokenless", "granted")));
});

test("GATE: an allowlisted user still cannot create somebody else's profile", async () => {
  const db = asUser("newbie", { email: "approved@example.com" });
  await assertFails(setDoc(doc(db, "profiles/someoneelse"), profile("someoneelse", "granted")));
});

test("GATE: the gate does not block profile UPDATES for existing members", async () => {
  const db = asUser("granted");
  await assertSucceeds(updateDoc(doc(db, "profiles/granted"), { headline: "Still building", updatedAt: serverTimestamp() }));
});

test("GATE: clients cannot read or write approvedMembers", async () => {
  const authed = asUser("newbie", { email: "approved@example.com" });
  await assertFails(getDoc(doc(authed, "approvedMembers/approved@example.com")));
  await assertFails(setDoc(doc(authed, "approvedMembers/self@example.com"), { role: "mentor" }));
  await assertFails(deleteDoc(doc(authed, "approvedMembers/approved@example.com")));
  await assertFails(getDocs(collection(authed, "approvedMembers")));
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, "approvedMembers/approved@example.com")));
  await assertFails(setDoc(doc(anon, "approvedMembers/x@example.com"), { role: "mentor" }));
});

test("pending minor can still READ (sees the waiting-on-consent state)", async () => {
  const db = asUser("minor");
  await assertSucceeds(getDoc(doc(db, "profiles/minor")));
  await assertSucceeds(getDoc(doc(db, "seasons/s1")));
});

test("PHOTO: operators and mentors can update their own bounded raster photo", async () => {
  for (const uid of ["granted", "mentorA"]) {
    await assertSucceeds(updateDoc(doc(asUser(uid), `profiles/${uid}`), {
      photoUrl: "data:image/webp;base64,UklGRg==", updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(asUser(uid), `profiles/${uid}`), { photoUrl: "" }));
  }
});

test("PHOTO: unsupported formats, remote URLs, malformed data and oversized payloads are denied", async () => {
  const ref = doc(asUser("granted"), "profiles/granted");
  for (const photoUrl of [
    "https://example.com/tracker.jpg", "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=", "data:image/webp;base64,!invalid!", 42,
    `data:image/jpeg;base64,${"A".repeat(40000)}`,
  ]) await assertFails(updateDoc(ref, { photoUrl }));
});

test("PHOTO: a photo never grants another member edit access or public read access", async () => {
  const db = asUser("other");
  await assertFails(updateDoc(doc(db, "profiles/granted"), { photoUrl: "data:image/jpeg;base64,/9j/2Q==" }));
  await assertSucceeds(getDoc(doc(db, "profiles/granted")));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "profiles/granted")));
  await assertFails(getDoc(doc(db, "privateProfiles/granted")));
});

test("PHOTO: updating a photo cannot change role, consent or the server-owned streak", async () => {
  const ref = doc(asUser("minor"), "profiles/minor");
  for (const extra of [{ role: "mentor" }, { consentStatus: "granted" }, { streak: 99 }]) {
    await assertFails(updateDoc(ref, { photoUrl: "data:image/webp;base64,UklGRg==", ...extra }));
  }
});

/* ========================================================================= *
 *  Workshops — readable by everyone signed in, written only by the server
 * ========================================================================= */

test("WORKSHOPS: a signed-in operator can read the catalog", async () => {
  await assertSucceeds(getDoc(doc(asUser("granted"), "workshops/owned")));
});

test("WORKSHOPS: a signed-out visitor cannot read it", async () => {
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "workshops/owned")));
});

test("WORKSHOPS: an operator cannot enroll from the browser (server route only)", async () => {
  await assertFails(updateDoc(doc(asUser("granted"), "workshops/owned"), { enrolledUids: arrayUnion("granted") }));
});

test("WORKSHOPS: a mentor cannot author a session from the browser", async () => {
  await assertFails(addDoc(collection(asUser("mentorA"), "workshops"), workshop()));
});

test("WORKSHOPS: a mentor cannot edit or delete their own session from the browser", async () => {
  const db = asUser("mentorA");
  await assertFails(updateDoc(doc(db, "workshops/owned"), { title: "v2" }));
  await assertFails(deleteDoc(doc(db, "workshops/owned")));
});

test("GOOGLE TOKENS: clients cannot read or write a mentor's calendar token", async () => {
  const db = asUser("mentorA");
  await assertFails(getDoc(doc(db, "googleTokens/mentorA")));
  await assertFails(setDoc(doc(db, "googleTokens/mentorA"), { refreshTokenEnc: "x" }));
});

/* ========================================================================= *
 *  The season — readable by everyone signed in, written only by the server
 * ========================================================================= */

test("SEASON: every signed-in user can read it; a visitor cannot", async () => {
  await assertSucceeds(getDoc(doc(asUser("granted"), "seasons/s1")));
  await assertSucceeds(getDoc(doc(asUser("minor"), "seasons/s1")));
  await assertSucceeds(getDocs(query(collection(asUser("granted"), "seasons"), where("state", "==", "live"))));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "seasons/s1")));
});

test("SEASON: not even a mentor can write it from the browser (server route only)", async () => {
  const db = asUser("mentorA");
  await assertFails(updateDoc(doc(db, "seasons/s1"), { name: "Renamed", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, "seasons/s2"), { name: "Season 2", state: "draft", milestones: [], updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db, "seasons/s1")));
});

test("SEASON: an operator cannot write it either", async () => {
  const db = asUser("granted");
  await assertFails(updateDoc(doc(db, "seasons/s1"), { state: "archived" }));
});

/* ========================================================================= *
 *  Submissions — server-written; read split by the snapshotted verifier
 * ========================================================================= */

test("PROOF: nobody writes a submission from the browser — not the author, not a mentor", async () => {
  const me = asUser("granted");
  await assertFails(setDoc(doc(me, "seasons/s1/submissions/granted__ship"), submission("granted", "ship", "open", "approved")));
  await assertFails(updateDoc(doc(me, "seasons/s1/submissions/granted__mission"), { status: "approved" }));
  await assertFails(deleteDoc(doc(me, "seasons/s1/submissions/granted__mission")));
  const mentor = asUser("mentorA");
  await assertFails(updateDoc(doc(mentor, "seasons/s1/submissions/granted__mission"), { status: "approved" }));
  await assertFails(deleteDoc(doc(mentor, "seasons/s1/submissions/granted__mission")));
});

test("PROOF: the author reads their own mentor-reviewed row", async () => {
  await assertSucceeds(getDoc(doc(asUser("granted"), "seasons/s1/submissions/granted__mission")));
});

test("PROOF: a third operator CANNOT read someone's mentor-reviewed row", async () => {
  await assertFails(getDoc(doc(asUser("other"), "seasons/s1/submissions/granted__mission")));
  await assertFails(getDoc(doc(asUser("minor"), "seasons/s1/submissions/granted__mission")));
});

test("PROOF: any mentor reads a mentor-reviewed row", async () => {
  await assertSucceeds(getDoc(doc(asUser("mentorA"), "seasons/s1/submissions/granted__mission")));
  await assertSucceeds(getDoc(doc(asUser("mentorB"), "seasons/s1/submissions/other__mission")));
});

test("PROOF: every signed-in member reads an open row — it's the accountability", async () => {
  await assertSucceeds(getDoc(doc(asUser("other"), "seasons/s1/submissions/granted__cold-ask")));
  await assertSucceeds(getDoc(doc(asUser("minor"), "seasons/s1/submissions/granted__cold-ask")));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "seasons/s1/submissions/granted__cold-ask")));
});

test("PROOF LIST: the public wall — where verifier == 'open' — is readable by an operator", async () => {
  const db = asUser("other");
  const snap = await assertSucceeds(getDocs(query(subs(db), where("verifier", "==", "open"))));
  if (snap.size !== 1) throw new Error(`expected exactly the one open row, got ${snap.size}`);
});

test("PROOF LIST: your own rows — where uid == you — are readable, every verifier kind", async () => {
  const db = asUser("granted");
  const snap = await assertSucceeds(getDocs(query(subs(db), where("uid", "==", "granted"))));
  if (snap.size !== 2) throw new Error(`expected both of granted's rows, got ${snap.size}`);
});

test("PROOF LIST: an UNFILTERED list is denied for an operator (all-or-nothing)", async () => {
  // Pins the query semantics the watchers rely on: drop the where() from
  // watchOpenSubmissions and the whole listener is denied.
  await assertFails(getDocs(subs(asUser("other"))));
  await assertFails(getDocs(subs(asUser("granted"))));
});

test("PROOF LIST: someone else's uid filter is denied for an operator", async () => {
  await assertFails(getDocs(query(subs(asUser("other")), where("uid", "==", "granted"))));
});

test("PROOF LIST: the review queue — where status == 'submitted' — is mentors only", async () => {
  await assertSucceeds(getDocs(query(subs(asUser("mentorA")), where("status", "==", "submitted"))));
  await assertFails(getDocs(query(subs(asUser("other")), where("status", "==", "submitted"))));
});

test("PROOF LIST: a mentor reads everything (the roster)", async () => {
  const snap = await assertSucceeds(getDocs(subs(asUser("mentorB"))));
  if (snap.size !== 3) throw new Error(`expected all 3 rows, got ${snap.size}`);
});

/* ========================================================================= *
 *  Build log — the season feed. Server-written; author may delete own.
 * ========================================================================= */

test("FEED: every signed-in user reads it", async () => {
  await assertSucceeds(getDoc(doc(asUser("other"), "buildLogs/l1")));
  await assertSucceeds(getDocs(collection(asUser("minor"), "buildLogs")));
});

test("FEED: nobody posts a build log from the browser (server route only)", async () => {
  const line = { uid: "granted", name: "Test O.", text: "Shipped", day: "2026-07-11", createdAt: serverTimestamp() };
  await assertFails(addDoc(collection(asUser("granted"), "buildLogs"), line));
  await assertFails(addDoc(collection(asUser("mentorA"), "buildLogs"), { ...line, uid: "mentorA" }));
  await assertFails(updateDoc(doc(asUser("granted"), "buildLogs/l1"), { text: "edited" }));
});

test("FEED: the author may delete their own line; nobody else may", async () => {
  await assertFails(deleteDoc(doc(asUser("other"), "buildLogs/l1")));
  await assertFails(deleteDoc(doc(asUser("mentorA"), "buildLogs/l1")));
  await assertSucceeds(deleteDoc(doc(asUser("granted"), "buildLogs/l1")));
});

/* ========================================================================= *
 *  Nothing squad-shaped is reachable any more
 * ========================================================================= */

test("SQUADS: the old cohorts collection is sealed (no rule = deny)", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "cohorts/old"), { name: "Old Squad", memberUids: ["granted"] });
  });
  await assertFails(getDoc(doc(asUser("granted"), "cohorts/old")));
  await assertFails(getDoc(doc(asUser("mentorA"), "cohorts/old")));
  await assertFails(updateDoc(doc(asUser("granted"), "cohorts/old"), { name: "x" }));
});
