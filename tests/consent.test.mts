/**
 * Integration test for the server-authoritative consent token logic
 * (app/lib/consentServer.ts) exercised through the *real* code path against the
 * Firestore emulator. Run with:
 *
 *   npm run test:consent
 *
 * (wraps `tsx --test` in `firebase emulators:exec --only firestore`). Because
 * FIRESTORE_EMULATOR_HOST is set by the emulator, the Admin SDK talks to the
 * emulator with a stub identity — no service-account secret required.
 *
 * Proves acceptance criterion 2: approving flips exactly the bound uid to
 * "granted", the token is single-use, expiry and invalid tokens are handled,
 * and a resend supersedes the prior link.
 */
import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../app/lib/firebaseAdmin.ts";
import {
  createConsentToken,
  peekConsentToken,
  grantConsentWithToken,
} from "../app/lib/consentServer.ts";

const db = adminDb();

async function seedProfile(uid: string, consentStatus = "pending") {
  await db.collection("profiles").doc(uid).set({
    uid,
    name: `${uid} O.`,
    consentStatus,
    role: "operator",
    plan: "free",
  });
}

async function consentOf(uid: string): Promise<string | undefined> {
  const snap = await db.collection("profiles").doc(uid).get();
  return snap.data()?.consentStatus;
}

async function clearAll() {
  for (const col of ["profiles", "consentTokens"]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

beforeEach(clearAll);
after(clearAll);

test("peek returns valid + child name for a fresh token", async () => {
  await seedProfile("kid1");
  const token = await createConsentToken("kid1", "Ada L.", "parent@example.com");
  const peek = await peekConsentToken(token);
  assert.equal(peek.status, "valid");
  assert.equal(peek.childName, "Ada L.");
});

test("approving grants exactly the bound uid, and is single-use", async () => {
  await seedProfile("kid1");
  await seedProfile("kid2");
  const token = await createConsentToken("kid1", "Ada L.", "parent@example.com");

  const first = await grantConsentWithToken(token);
  assert.equal(first.status, "granted");
  assert.equal(await consentOf("kid1"), "granted");
  // The token was bound to kid1 only — kid2 is untouched.
  assert.equal(await consentOf("kid2"), "pending");

  // Reusing the same token fails (single-use).
  const second = await grantConsentWithToken(token);
  assert.equal(second.status, "used");
});

test("an invalid/garbage token grants nothing", async () => {
  await seedProfile("kid1");
  const res = await grantConsentWithToken("not-a-real-token");
  assert.equal(res.status, "invalid");
  assert.equal(await consentOf("kid1"), "pending");
});

test("an expired token is rejected", async () => {
  await seedProfile("kid1");
  const token = await createConsentToken("kid1", "Ada L.", "parent@example.com");
  // Force expiry into the past (Admin SDK — bypasses rules).
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(token).digest("hex");
  await db
    .collection("consentTokens")
    .doc(hash)
    .update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });

  assert.equal((await peekConsentToken(token)).status, "expired");
  assert.equal((await grantConsentWithToken(token)).status, "expired");
  assert.equal(await consentOf("kid1"), "pending");
});

test("resend supersedes: the prior token stops working, the new one grants", async () => {
  await seedProfile("kid1");
  const first = await createConsentToken("kid1", "Ada L.", "p@example.com");
  const second = await createConsentToken("kid1", "Ada L.", "p@example.com");

  assert.equal((await peekConsentToken(first)).status, "invalid");
  assert.equal((await grantConsentWithToken(second)).status, "granted");
  assert.equal(await consentOf("kid1"), "granted");
});
