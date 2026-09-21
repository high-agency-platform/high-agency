import { signInWithEmailLink, type User } from "firebase/auth";
import { getFirebaseAuth } from "./firebase";
import type { MentorSignupInput } from "./types";

/** Where the requested email is stashed so /login/verify can complete the
 *  sign-in. Firebase requires the email back at completion time; it is only
 *  absent when the link is opened on a different device, which the verify
 *  page handles by asking. */
export const ACCESS_EMAIL_KEY = "ha:accessEmail";

let redemption: { email: string; link: string; result: Promise<User>; uid?: string } | undefined;

async function verificationKey(link: string): Promise<string> {
  const code = new URL(link).searchParams.get("oobCode") ?? "";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return "ha:verified:" + Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
}

/** Resume only the verified session that redeemed this exact link. */
export async function restoredLinkUser(link: string): Promise<User | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user?.emailVerified) return null;
  try {
    return sessionStorage.getItem(await verificationKey(link)) === user.uid ? user : null;
  } catch { return null; }
}

/** Effects and form submissions share one redemption of a single-use credential. */
export function completeEmailLink(email: string, link: string): Promise<User> {
  email = email.trim().toLowerCase();
  if (redemption?.email === email && redemption.link === link &&
      (!redemption.uid || redemption.uid === getFirebaseAuth().currentUser?.uid)) return redemption.result;
  const result = (async () => {
    const restored = await restoredLinkUser(link);
    const user = restored?.email?.toLowerCase() === email
      ? restored
      : (await signInWithEmailLink(getFirebaseAuth(), email, link)).user;
    try { sessionStorage.setItem(await verificationKey(link), user.uid); } catch { /* storage is optional */ }
    return user;
  })().then(user => {
    attempt.uid = user.uid;
    return user;
  }).catch(error => {
    if (redemption === attempt) redemption = undefined;
    throw error;
  });
  const attempt: NonNullable<typeof redemption> = { email, link, result };
  redemption = attempt;
  return result;
}

export type AccessRequestStatus =
  | "sent"
  | "not-approved"
  | "bad-email"
  | "rate-limited"
  | "error";

/** Ask for a sign-in link. Never throws on a normal outcome — "not-approved"
 *  is an answer, not a failure. */
export async function requestAccessLink(email: string, invite?: string): Promise<{
  status: AccessRequestStatus;
  message?: string;
  qaUrl?: string;
}> {
  try {
    const res = await fetch("/api/access/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, invite }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: AccessRequestStatus;
      message?: string;
      qaUrl?: string;
    };
    return { status: data.status ?? "error", message: data.message, qaUrl: data.qaUrl };
  } catch {
    return { status: "error" };
  }
}

export interface AccessClaim {
  ok: boolean;
  role: "operator" | "mentor";
  hasProfile: boolean;
}

/** Claim invite membership using the verified Firebase identity. */
export async function claimAccess(invite?: string | null): Promise<AccessClaim> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("not-signed-in");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/access/claim", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ invite }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    role?: "operator" | "mentor";
    hasProfile?: boolean;
  };

  if (res.status >= 500) throw new Error("access-unavailable");
  return {
    ok: res.ok && data.status === "ok",
    role: data.role === "mentor" ? "mentor" : "operator",
    hasProfile: Boolean(data.hasProfile),
  };
}

/** Create the mentor profile for an allowlisted mentor (the magic-link
 *  equivalent of redeeming an invite code). Server-side write — clients can
 *  never author `role: "mentor"` themselves. */
export async function createApprovedMentorProfile(
  profile: MentorSignupInput
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("not-signed-in");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/access/mentor-profile", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profile }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    error?: string;
  };
  return { ok: res.ok, ...data };
}
