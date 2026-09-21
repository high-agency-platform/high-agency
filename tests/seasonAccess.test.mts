import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../app/lib/firebaseAdmin.ts";
import { createSeasonInvite, checkSeasonInvite, claimSeasonAccess, checkRateLimit } from "../app/lib/accessGate.ts";
import { readReleasedSeason, saveSeason, recordSubmission } from "../app/lib/seasonServer.ts";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Emulator required");
const db = adminDb();
beforeEach(async () => {
  for (const name of ["seasonInvites", "memberships", "approvedMembers", "profiles", "seasons", "accessRateLimits"]) await db.recursiveDelete(db.collection(name));
});
const refFor = (code: string) => db.collection("seasonInvites").doc(createHash("sha256").update(code).digest("hex"));

test("Invite requires verified email; capped concurrent claims are atomic and idempotent", async () => {
  const code = await createSeasonInvite(1);
  await assert.rejects(claimSeasonAccess("u0", "zero@example.test", false, code), /email-unverified/);
  await assert.rejects(claimSeasonAccess("u0", "zero@example.test", true, "garbage"), /invite-required/);
  const claims = await Promise.allSettled([claimSeasonAccess("u1", "one@example.test", true, code), claimSeasonAccess("u2", "two@example.test", true, code)]);
  assert.equal(claims.filter(r => r.status === "fulfilled").length, 1);
  assert.equal((await refFor(code).get()).data()?.used, 1);
  const winner = claims[0].status === "fulfilled" ? "u1" : "u2";
  assert.deepEqual(await claimSeasonAccess(winner, "winner@example.test", true, code), { role: "operator", hasProfile: false });
  assert.equal((await refFor(code).get()).data()?.used, 1);
  assert.equal(await checkSeasonInvite(code), false);
});

test("Revoked and expired invites cannot admit anyone", async () => {
  const code = await createSeasonInvite();
  await refFor(code).update({ revoked: true });
  await assert.rejects(claimSeasonAccess("u1", "one@example.test", true, code), /invite-unavailable/);
  await refFor(code).update({ revoked: false, expiresAt: Timestamp.fromMillis(1) });
  assert.equal(await checkSeasonInvite(code), false);
  await assert.rejects(claimSeasonAccess("u1", "one@example.test", true, code), /invite-unavailable/);
  assert.equal((await db.collection("memberships").get()).size, 0);
});

test("Returning members and legacy mentors do not consume student invitations", async () => {
  await db.collection("profiles").doc("mentor").set({ role: "mentor" });
  assert.deepEqual(await claimSeasonAccess("mentor", "mentor@example.test", true, null), { role: "mentor", hasProfile: true });
  await db.collection("approvedMembers").doc("legacy@example.test").set({ role: "mentor" });
  assert.deepEqual(await claimSeasonAccess("new-mentor", "legacy@example.test", true, null), { role: "mentor", hasProfile: false });
});

test("Per-email mail limits persist and do not block a 50-person shared IP", async () => {
  for (let i = 0; i < 50; i++) assert.equal((await checkRateLimit([`email:${i}@example.test`, "ip:shared"])).ok, true);
  for (let i = 0; i < 4; i++) assert.equal((await checkRateLimit(["email:0@example.test", "ip:shared"])).ok, true);
  assert.equal((await checkRateLimit(["email:0@example.test", "ip:shared"])).ok, false);
});

const milestones = [
  { id: "first", title: "First", why: "", proof: "Post a link", effort: "", verifier: "mentor", sessions: [] },
  { id: "second", title: "Secret later lesson", why: "Hidden teaching", proof: "Hidden proof instructions", effort: "", verifier: "open", sessions: [] },
];
async function seedSeason() {
  await db.collection("profiles").doc("student").set({ name: "Test S.", role: "operator", consentStatus: "granted", timezone: "UTC", streak: 0, streakFreezes: 0, lastActiveDay: "" });
  const saved = await saveSeason("mentor", "Mentor", { name: "Season 1", state: "live", milestones });
  return saved;
}

test("Unreleased content is withheld; guessed milestone submissions fail; released work succeeds", async () => {
  const saved = await seedSeason();
  await assert.rejects(readReleasedSeason("stranger"), /no-profile/);
  const view = await readReleasedSeason("student");
  assert.equal(view?.milestones.length, 1);
  assert.equal(view?.hasUpcoming, true);
  assert.deepEqual(view?.milestonePreviews?.[1], { id: "second", title: "Secret later lesson", released: false });
  assert.equal(JSON.stringify(view).includes("Hidden teaching"), false);
  assert.equal(JSON.stringify(view).includes("Hidden proof instructions"), false);
  await assert.rejects(recordSubmission("student", { seasonId: saved.id, milestoneId: "second", proofUrl: "https://example.test/proof" }), /milestone-locked/);
  const released = await saveSeason("mentor", "Mentor", { seasonId: saved.id, expectedUpdatedAt: saved.updatedAt, name: "Season 1", state: "live", milestones: milestones.map(m => ({ ...m, released: true })) });
  assert.equal((await readReleasedSeason("student"))?.milestones.length, 2);
  const proof = await recordSubmission("student", { seasonId: saved.id, milestoneId: "second", proofUrl: "https://example.test/proof" });
  assert.equal(proof.status, "approved");
  await assert.rejects(saveSeason("mentor", "Mentor", { seasonId: saved.id, expectedUpdatedAt: released.updatedAt, name: "Season 1", state: "live", milestones: milestones.map(m => ({ ...m, released: false })) }), /milestone-has-submissions/);
});

test("Stale saves and drafts stay blocked; parent email never gates proof", async () => {
  const saved = await seedSeason();
  await assert.rejects(saveSeason("mentor", "Mentor", { seasonId: saved.id, expectedUpdatedAt: 1, name: "Oops", state: "live", milestones }), /stale-write/);
  await db.collection("profiles").doc("student").update({ consentStatus: "pending" });
  assert.equal((await recordSubmission("student", { seasonId: saved.id, milestoneId: "first", proofUrl: "https://example.test/proof" })).status, "submitted");
  await db.collection("profiles").doc("student").update({ consentStatus: "granted" });
  await db.collection("seasons").doc(saved.id).update({ state: "draft" });
  assert.equal(await readReleasedSeason("student"), null);
  await assert.rejects(recordSubmission("student", { seasonId: saved.id, milestoneId: "first", proofUrl: "https://example.test/proof" }), /season-closed/);
});
