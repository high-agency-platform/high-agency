/** Server-authoritative streak arithmetic for proof submissions. */
import { FieldValue } from "firebase-admin/firestore";
import { nextStreak, type StreakState } from "./streaks";

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
