/**
 * Integration test for the server-authoritative mentor-invite logic
 * (app/lib/mentorInviteServer.ts) exercised through the *real* code path
 * against the Firestore emulator. Run with:
 *
 *   npm run test:mentor
 *
 * (wraps `tsx --test` in `firebase emulators:exec --only firestore`).
 *
 * The core claims: redeeming mints role "mentor" for exactly the caller's uid
 * and consumes the invite atomically (single-use); an existing operator is
 * promoted in place; used/expired/garbage codes grant nothing; and the
 * server-side sanitizer rejects incomplete signups without spending the code.
 */
import { createHash, randomBytes } from "node:crypto";
import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../app/lib/firebaseAdmin.ts";
import {
  peekMentorInvite,
  redeemMentorInvite,
  buildMentorProfile,
} from "../app/lib/mentorInviteServer.ts";
import type { MentorSignupInput } from "../app/lib/types.ts";

const db = adminDb();

/** Seed an invite the way scripts/mentor-invite.js does; returns the raw code. */
async function seedInvite(opts: { used?: boolean; expired?: boolean } = {}) {
  const rawCode = randomBytes(24).toString("base64url");
  const hash = createHash("sha256").update(rawCode).digest("hex");
  const now = Date.now();
  await db.collection("mentorInvites").doc(hash).set({
    label: "Test Mentor <t@example.com>",
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + (opts.expired ? -1000 : 86400_000)),
    used: opts.used ?? false,
    usedAt: null,
    usedByUid: null,
  });
  return { rawCode, hash };
}

function signup(overrides: Partial<MentorSignupInput> = {}): MentorSignupInput {
  return {
    firstName: "Grace",
    lastName: "Hopper",
    country: "United States",
    timezone: "America/New_York",
    headline: "Rear admiral of shipping",
    building: "",
    stage: "idea",
    domains: ["AI"],
    skills: ["Coding"],
    proofUrl: "",
    proofNote: "",
    bio: "",
    links: { github: "", linkedin: "", site: "" },
    localDay: "2026-07-23",
    ...overrides,
  };
}

async function clearAll() {
  for (const col of ["profiles", "mentorInvites"]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

beforeEach(clearAll);
after(clearAll);

test("peek: valid, used, expired, and garbage codes", async () => {
  const fresh = await seedInvite();
  const used = await seedInvite({ used: true });
  const expired = await seedInvite({ expired: true });
  assert.equal(await peekMentorInvite(fresh.rawCode), "valid");
  assert.equal(await peekMentorInvite(used.rawCode), "used");
  assert.equal(await peekMentorInvite(expired.rawCode), "expired");
  assert.equal(await peekMentorInvite("not-a-code"), "invalid");
  assert.equal(await peekMentorInvite(""), "invalid");
});

test("redeem creates a mentor profile and consumes the invite", async () => {
  const { rawCode, hash } = await seedInvite();
  const result = await redeemMentorInvite(rawCode, "mentor1", signup());
  assert.equal(result.status, "created");

  const profile = (await db.collection("profiles").doc("mentor1").get()).data()!;
  assert.equal(profile.role, "mentor");
  assert.equal(profile.name, "Grace H."); // "First L." convention holds
  assert.equal(profile.ageBand, "18+");
  assert.equal(profile.consentStatus, "granted");
  assert.equal(profile.plan, "free");
  assert.equal(profile.uid, "mentor1");

  const invite = (await db.collection("mentorInvites").doc(hash).get()).data()!;
  assert.equal(invite.used, true);
  assert.equal(invite.usedByUid, "mentor1");
});

test("an invite is single-use: the second redeemer is turned away", async () => {
  const { rawCode } = await seedInvite();
  await redeemMentorInvite(rawCode, "mentor1", signup());
  const second = await redeemMentorInvite(rawCode, "mentor2", signup());
  assert.equal(second.status, "used");
  const snap = await db.collection("profiles").doc("mentor2").get();
  assert.equal(snap.exists, false);
});

test("an existing operator is promoted in place, profile intact", async () => {
  await db.collection("profiles").doc("op1").set({
    uid: "op1",
    name: "Ada L.",
    role: "operator",
    plan: "free",
    xp: 450,
    consentStatus: "granted",
  });
  const { rawCode, hash } = await seedInvite();
  const result = await redeemMentorInvite(rawCode, "op1", null);
  assert.equal(result.status, "promoted");

  const profile = (await db.collection("profiles").doc("op1").get()).data()!;
  assert.equal(profile.role, "mentor");
  assert.equal(profile.xp, 450); // history survives the promotion
  assert.equal(profile.name, "Ada L.");

  const invite = (await db.collection("mentorInvites").doc(hash).get()).data()!;
  assert.equal(invite.used, true);
  assert.equal(invite.usedByUid, "op1");
});

test("an existing mentor is a no-op and the invite stays live", async () => {
  await db.collection("profiles").doc("m1").set({ uid: "m1", role: "mentor" });
  const { rawCode, hash } = await seedInvite();
  const result = await redeemMentorInvite(rawCode, "m1", null);
  assert.equal(result.status, "already-mentor");
  const invite = (await db.collection("mentorInvites").doc(hash).get()).data()!;
  assert.equal(invite.used, false);
});

test("expired and garbage codes grant nothing", async () => {
  const { rawCode } = await seedInvite({ expired: true });
  assert.equal((await redeemMentorInvite(rawCode, "x", signup())).status, "expired");
  assert.equal((await redeemMentorInvite("junk", "x", signup())).status, "invalid");
  const snap = await db.collection("profiles").doc("x").get();
  assert.equal(snap.exists, false);
});

test("incomplete signup fails without spending the code", async () => {
  const { rawCode, hash } = await seedInvite();
  // Blank headline + no skills survive sanitation (emoji-only tag dies in
  // normalizeFocusTag) → rejected.
  const bad = await redeemMentorInvite(
    rawCode,
    "mentor1",
    signup({ headline: "  ", skills: ["🔥🔥"] })
  );
  assert.equal(bad.status, "profile-required");
  const invite = (await db.collection("mentorInvites").doc(hash).get()).data()!;
  assert.equal(invite.used, false);

  // …and the same code still works once the form is complete.
  const good = await redeemMentorInvite(rawCode, "mentor1", signup());
  assert.equal(good.status, "created");
});

test("sanitizer bounds fields and normalizes custom tags", () => {
  const built = buildMentorProfile(
    "u1",
    signup({
      headline: "x".repeat(500),
      // Custom expertise survives (normalized), preset names fold onto their
      // canonical chip, dupes and emoji-only junk are dropped.
      domains: ["ai", "Hardtech Robotics!!", "AI", "🔥🔥"],
      skills: ["Coding", "Pitch Decks", "coding"],
      building: "A dev-tools startup",
      stage: "revenue",
    })
  )!;
  assert.equal((built.headline as string).length, 90);
  assert.deepEqual(built.domains, ["AI", "Hardtech Robotics"]);
  assert.deepEqual(built.skills, ["Coding", "Pitch Decks"]);
  assert.equal(built.stage, "revenue");
  // Tag counts stay inside the rules' bounds (domains ≤ 9, skills ≤ 7).
  const many = buildMentorProfile(
    "u1",
    signup({
      domains: Array.from({ length: 20 }, (_, i) => `Field ${i}`),
      skills: Array.from({ length: 20 }, (_, i) => `Skill ${i}`),
    })
  )!;
  assert.equal((many.domains as string[]).length, 9);
  assert.equal((many.skills as string[]).length, 7);
  // No venture text → stage falls back to "idea" regardless of input.
  const noVenture = buildMentorProfile("u1", signup({ building: "", stage: "revenue" }))!;
  assert.equal(noVenture.stage, "idea");
});
