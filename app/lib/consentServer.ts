/**
 * Server-only parental-consent logic. Runs exclusively inside Route Handlers
 * (`app/api/consent/**`) via the Admin SDK, which bypasses Firestore rules.
 *
 * Token model (single-use, expiring, uid-bound):
 *  - We mint a 32-byte random token and email the RAW token to the parent.
 *  - Firestore stores only the SHA-256 HASH of the token as the doc id, so a
 *    read of `consentTokens` (which clients can't do anyway) never leaks a
 *    usable token. The doc binds the token to exactly one `uid`.
 *  - Approval is an Admin-SDK transaction that (a) rejects used/expired tokens
 *    and (b) flips `profiles/{uid}.consentStatus` to "granted" and marks the
 *    token used in the same atomic step — so a token can grant one uid, once.
 */
import { createHash, randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";

const TOKENS = "consentTokens";
const PROFILES = "profiles";

/** Consent links stay valid for two weeks; a parent who misses it gets a resend. */
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type ConsentPeekStatus = "valid" | "used" | "expired" | "invalid";

export interface ConsentTokenDoc {
  uid: string;
  childName: string;
  parentEmail: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  used: boolean;
  usedAt: Timestamp | null;
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Mint a fresh consent token for `uid`, storing only its hash. Any prior unused
 * tokens for the same uid are invalidated first, so a resend supersedes the old
 * link and only one live token exists per minor at a time.
 * Returns the RAW token (email it; never store or log it in Firestore).
 */
export async function createConsentToken(
  uid: string,
  childName: string,
  parentEmail: string
): Promise<string> {
  const db = adminDb();

  // Invalidate outstanding tokens for this uid (resend supersedes).
  const prior = await db
    .collection(TOKENS)
    .where("uid", "==", uid)
    .where("used", "==", false)
    .get();
  if (!prior.empty) {
    const batch = db.batch();
    prior.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  const rawToken = randomBytes(32).toString("base64url");
  const now = Date.now();
  const doc: ConsentTokenDoc = {
    uid,
    childName,
    parentEmail,
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + TOKEN_TTL_MS),
    used: false,
    usedAt: null,
  };
  await db.collection(TOKENS).doc(hashToken(rawToken)).set(doc);
  return rawToken;
}

/** Read-only look-up used to render the approval page (does not consume). */
export async function peekConsentToken(
  rawToken: string
): Promise<{ status: ConsentPeekStatus; childName?: string }> {
  if (!rawToken) return { status: "invalid" };
  const snap = await adminDb().collection(TOKENS).doc(hashToken(rawToken)).get();
  if (!snap.exists) return { status: "invalid" };
  const data = snap.data() as ConsentTokenDoc;
  if (data.used) return { status: "used", childName: data.childName };
  if (data.expiresAt.toMillis() < Date.now()) {
    return { status: "expired", childName: data.childName };
  }
  return { status: "valid", childName: data.childName };
}

export type ConsentGrantResult =
  | { status: "granted"; childName: string }
  | { status: "used"; childName: string }
  | { status: "expired"; childName: string }
  | { status: "invalid" };

/**
 * Consume a token and authoritatively grant consent — atomic and single-use.
 * The transaction re-reads the token so two concurrent approvals can't both
 * succeed, and only ever writes the `uid` the token was minted for.
 */
export async function grantConsentWithToken(
  rawToken: string
): Promise<ConsentGrantResult> {
  if (!rawToken) return { status: "invalid" };
  const db = adminDb();
  const tokenRef = db.collection(TOKENS).doc(hashToken(rawToken));

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(tokenRef);
    if (!snap.exists) return { status: "invalid" };
    const data = snap.data() as ConsentTokenDoc;
    if (data.used) return { status: "used", childName: data.childName };
    if (data.expiresAt.toMillis() < Date.now()) {
      return { status: "expired", childName: data.childName };
    }
    // Bind strictly to the token's uid — never a caller-supplied one.
    tx.update(db.collection(PROFILES).doc(data.uid), {
      consentStatus: "granted",
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(tokenRef, { used: true, usedAt: FieldValue.serverTimestamp() });
    return { status: "granted", childName: data.childName };
  });
}
