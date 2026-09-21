import { test } from "node:test";
import assert from "node:assert/strict";
import { signOut, signInWithEmailLink } from "firebase/auth";
import { adminAuth } from "../app/lib/firebaseAdmin.ts";
import { getFirebaseAuth } from "../app/lib/firebase.ts";
import { completeEmailLink, restoredLinkUser } from "../app/lib/accessClient.ts";
import { accessVerificationUrl } from "../app/lib/accessLink.ts";

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIREBASE_PROJECT_ID !== "demo-highagency") {
  throw new Error("Run only against the demo-highagency Auth emulator");
}
const entries = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
  getItem: (key: string) => entries.get(key) ?? null,
  setItem: (key: string, value: string) => entries.set(key, value),
} });
const continuation = "https://high-agency.io/login/verify?invite=synthetic";
async function linkFor(email: string) {
  return accessVerificationUrl(await adminAuth().generateSignInWithEmailLink(email, {
    url: continuation, handleCodeInApp: true,
  }), continuation);
}

test("single-use redemption survives duplicate callers, reload recovery, and a failed attempt", async () => {
  const email = "verification@example.test";
  const link = await linkFor(email);
  const auth = getFirebaseAuth();
  const first = completeEmailLink(email, link);
  const duplicate = completeEmailLink(email, link);
  assert.equal(first, duplicate);
  const user = await first;
  assert.equal(user.emailVerified, true);
  assert.equal((await duplicate).uid, user.uid);
  // Prove this credential really was consumed; recovery must use the session.
  await assert.rejects(signInWithEmailLink(auth, email, link));
  assert.equal((await restoredLinkUser(link))?.uid, user.uid);
  assert.equal(await restoredLinkUser(await linkFor("other@example.test")), null);
  await signOut(auth);
  assert.equal(await restoredLinkUser(link), null);
  await assert.rejects(completeEmailLink(email, link));
  const fresh = await linkFor(email);
  await assert.rejects(completeEmailLink("wrong@example.test", fresh));
  assert.equal((await completeEmailLink(email, fresh)).email, email);
  await signOut(auth);
});
