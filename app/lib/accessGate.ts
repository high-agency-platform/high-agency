import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpError } from "./serverAuth";
import { adminAuth, adminDb } from "./firebaseAdmin";

export const APPROVED_MEMBERS = "approvedMembers";

/** Legacy staff-approved access remains supported for existing mentors. */
export type ApprovedRole = "operator" | "mentor";

export interface ApprovedMember {
  /** Normalized (trimmed + lowercased) email — also the doc id. */
  email: string;
  role: ApprovedRole;
  /** Display only; never shown to other members. */
  name?: string;
  /** Epoch ms. OPTIONAL: absent on docs hand-created in the Console. */
  addedAt?: number;
  note?: string;
}

/** The doc id convention, in one place. Trim + lowercase, nothing else — the
 *  Console click-path documented in QA-HANDOFF.md depends on this being
 *  something a human can reproduce by typing. */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** Deliberately loose: a real mailbox check is the sign-in link itself (an
 *  unreachable address simply never arrives). This only rejects input that
 *  could not be an address at all, and bounds the length so a hostile body
 *  can't be used as a Firestore doc id. Firestore doc ids also cannot contain
 *  "/", which the shape check already excludes. */
export function isValidEmail(email: string): boolean {
  return (
    email.length > 0 &&
    email.length <= 254 &&
    /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)
  );
}

/**
 * Look up an approved member. Returns null when the email is not on the list
 * or the doc is malformed (a hand-created doc missing `role`, say) — a doc we
 * can't read a role out of is not an approval.
 */
export async function lookupApprovedMember(
  rawEmail: string
): Promise<ApprovedMember | null> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return null;

  const snap = await adminDb().collection(APPROVED_MEMBERS).doc(email).get();
  if (!snap.exists) return null;

  const data = snap.data() ?? {};
  const role = data.role === "mentor" ? "mentor" : data.role === "operator" ? "operator" : null;
  if (!role) return null;

  return {
    email,
    role,
    ...(typeof data.name === "string" ? { name: data.name } : {}),
    // Console-created docs often have no addedAt at all — that must not throw.
    ...(typeof data.addedAt === "number" ? { addedAt: data.addedAt } : {}),
    ...(typeof data.note === "string" ? { note: data.note } : {}),
  };
}

/** A shareable invite grants student membership only after mailbox verification. */
function inviteRef(code: unknown) {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(code)) return null;
  return adminDb().collection("seasonInvites").doc(createHash("sha256").update(code).digest("hex"));
}

function inviteIsOpen(data: FirebaseFirestore.DocumentData | undefined): boolean {
  return !!data && data.seasonId === "s1" && data.revoked === false &&
    data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() > Date.now() &&
    Number.isInteger(data.maxUses) && Number.isInteger(data.used) && data.used < data.maxUses;
}

export async function createSeasonInvite(maxUses = 50) {
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) throw new HttpError(400, "bad-capacity");
  const code = randomBytes(24).toString("base64url");
  await inviteRef(code)!.create({ seasonId: "s1", maxUses, used: 0, revoked: false,
    createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400_000) });
  return code;
}

export async function checkSeasonInvite(code: unknown): Promise<boolean> {
  const ref = inviteRef(code);
  return !!ref && inviteIsOpen((await ref.get()).data());
}

/** Existing accounts can return without the original invite. */
export async function lookupAccessMember(email: string): Promise<ApprovedMember | null> {
  const approved = await lookupApprovedMember(email);
  if (approved) return approved;
  let uid: string;
  try { uid = (await adminAuth().getUserByEmail(email)).uid; }
  catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") return null;
    throw error;
  }
  const db = adminDb();
  const [profile, membership] = await Promise.all([
    db.collection("profiles").doc(uid).get(), db.collection("memberships").doc(uid).get(),
  ]);
  if (!profile.exists && !membership.exists) return null;
  return { email, role: profile.data()?.role === "mentor" ? "mentor" : "operator" };
}

export async function claimSeasonAccess(uid: string, email: string, verified: boolean, code: unknown) {
  if (!verified || !isValidEmail(email)) throw new HttpError(403, "email-unverified");
  const db = adminDb();
  const approved = await lookupApprovedMember(email);
  return db.runTransaction(async (tx) => {
    const profileRef = db.collection("profiles").doc(uid);
    const membershipRef = db.collection("memberships").doc(uid);
    const [profile, membership] = await Promise.all([tx.get(profileRef), tx.get(membershipRef)]);
    if (profile.exists || membership.exists || approved) return {
      role: profile.data()?.role === "mentor" ? "mentor" : approved?.role ?? "operator",
      hasProfile: profile.exists,
    };
    const ref = inviteRef(code);
    if (!ref) throw new HttpError(403, "invite-required");
    const invite = (await tx.get(ref)).data();
    if (!inviteIsOpen(invite)) throw new HttpError(403, "invite-unavailable");
    tx.create(membershipRef, { role: "operator", seasonId: "s1", inviteId: ref.id, joinedAt: Timestamp.now() });
    tx.update(ref, { used: invite!.used + 1 });
    return { role: "operator", hasProfile: false };
  });
}

/** Durable budgets allow a cohort on shared Wi-Fi without allowing inbox loops. */
export async function checkRateLimit(keys: string[]): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowMs = 15 * 60_000;
  const refs = keys.map(key => adminDb().collection("accessRateLimits").doc(createHash("sha256").update(key).digest("hex")));
  return adminDb().runTransaction(async tx => {
    const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
    const rows = snaps.map(snap => {
      const data = snap.data();
      return data && data.until > now ? { count: Number(data.count), until: Number(data.until) } : { count: 0, until: now + windowMs };
    });
    const blocked = rows.find((row, index) => row.count >= (keys[index].startsWith("ip:") ? 100 : 5));
    if (blocked) return { ok: false, retryAfter: Math.ceil((blocked.until - now) / 1000) };
    rows.forEach((row, index) => tx.set(refs[index], { ...row, count: row.count + 1 }));
    return { ok: true, retryAfter: 0 };
  });
}

export function callerIp(headers: Headers): string {
  return (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
