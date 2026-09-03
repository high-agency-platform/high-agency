/**
 * Server-only. The streak arithmetic behind every qualifying action — a
 * build log (POST /api/build-log) and a proof submission (POST
 * /api/submissions, via app/lib/seasonServer.ts). Each runs as one Admin-SDK
 * transaction: consent is checked against the live profile, "today" is
 * computed from the profile's own IANA timezone (never taken from the
 * request), and the streak fields are written here and only here. The rules
 * freeze those fields on every client path.
 */
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { HttpError } from "./serverAuth";
import { nextStreak, type StreakState } from "./streaks";

export const BUILD_LOG_MAX = 300;

/** YYYY-MM-DD right now in `tz`. Falls back to UTC on a bad zone. */
export function localDayIn(tz: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function streakOf(p: FirebaseFirestore.DocumentData): StreakState {
  return {
    streak: typeof p.streak === "number" ? p.streak : 0,
    streakFreezes: typeof p.streakFreezes === "number" ? p.streakFreezes : 0,
    lastActiveDay: typeof p.lastActiveDay === "string" ? p.lastActiveDay : "",
  };
}

/** Count today for this profile, inside the caller's transaction. Same-day
 *  repeats are a no-op inside nextStreak, so two actions in one day never
 *  double-count. `extra` rides along on the same profile write. */
export function bumpStreak(
  tx: FirebaseFirestore.Transaction,
  profileRef: FirebaseFirestore.DocumentReference,
  profile: FirebaseFirestore.DocumentData,
  extra: Record<string, unknown> = {}
): StreakState {
  const today = localDayIn(String(profile.timezone ?? "UTC"));
  const next = nextStreak(streakOf(profile), today);
  tx.update(profileRef, { ...next, ...extra, updatedAt: FieldValue.serverTimestamp() });
  return next;
}

/** The profile behind a streak action, with parental consent enforced. This
 *  is where the consent gate lives for server-written actions — the rules
 *  can't see these writes. */
async function gate(
  tx: FirebaseFirestore.Transaction,
  uid: string
): Promise<{
  profileRef: FirebaseFirestore.DocumentReference;
  profile: FirebaseFirestore.DocumentData;
}> {
  const profileRef = adminDb().collection("profiles").doc(uid);
  const profile = (await tx.get(profileRef)).data();
  if (!profile) throw new HttpError(403, "no-profile");
  if (profile.consentStatus === "pending") throw new HttpError(403, "consent-pending");
  return { profileRef, profile };
}

/** Post one line to the season feed and count the day. */
export async function recordBuildLog(
  uid: string,
  rawText: unknown
): Promise<{ streak: number; day: string }> {
  const text = typeof rawText === "string" ? rawText.trim().slice(0, BUILD_LOG_MAX) : "";
  if (!text) throw new HttpError(400, "text-required");

  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const { profileRef, profile } = await gate(tx, uid);
    const today = localDayIn(String(profile.timezone ?? "UTC"));
    tx.set(db.collection("buildLogs").doc(), {
      uid,
      name: String(profile.name ?? "?"),
      text,
      day: today,
      createdAt: FieldValue.serverTimestamp(),
    });
    const next = bumpStreak(tx, profileRef, profile, { lastBuildLogDay: today });
    return { streak: next.streak, day: today };
  });
}
