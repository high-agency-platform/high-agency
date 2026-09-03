"use client";

/* Shared data + guard for the mentor app. Every mentor screen reads from
   here so the queues are defined once and can't drift between Home and the
   surface that actually works them. */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { useAuth } from "./AuthProvider";
import {
  watchLiveSeason,
  watchReviewQueue,
  watchAllSubmissions,
  watchOperators,
  watchPendingConsent,
  REVIEW_QUEUE_LIMIT,
  CONSENT_QUEUE_LIMIT,
} from "../lib/db";
import type { Profile, Season, Submission } from "../lib/types";

/** Route guard for every /mentor screen. Signed out → login. Signed in with
 *  no profile → onboarding. Signed in as an operator → the operator app,
 *  because none of this is theirs. Returns null-ish while resolving so pages
 *  can bail out with one check. */
export function useMentorGate(): { user: User | null; profile: Profile | null } {
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (user && profile === null) router.replace("/onboarding");
    else if (profile && profile.role !== "mentor") router.replace("/dashboard");
  }, [user, profile, router]);

  if (!user || !profile || profile.role !== "mentor") {
    return { user: null, profile: null };
  }
  return { user, profile };
}

/** The one live season. `loading` until the first snapshot lands. */
export function useLiveSeason(enabled: boolean): { season: Season | null; loading: boolean } {
  const [snap, setSnap] = useState<{ season: Season | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return watchLiveSeason((season) => setSnap({ season }));
  }, [enabled]);
  return { season: snap?.season ?? null, loading: snap === null };
}

export interface ReviewQueue {
  /** Waiting on a mentor, oldest first. Null while loading. */
  queue: Submission[] | null;
  /** The queue is capped — there are likely more behind these. */
  truncated: boolean;
}

/** Everything waiting on a review. Tagged with the season it came from so a
 *  season change can never show the previous season's rows. */
export function useReviewQueue(seasonId: string | null): ReviewQueue {
  const [snap, setSnap] = useState<{ seasonId: string; queue: Submission[] } | null>(null);
  useEffect(() => {
    if (!seasonId) return;
    return watchReviewQueue(seasonId, (queue) => setSnap({ seasonId, queue }));
  }, [seasonId]);
  const queue = snap && snap.seasonId === seasonId ? snap.queue : null;
  return { queue, truncated: (queue?.length ?? 0) >= REVIEW_QUEUE_LIMIT };
}

export interface Roster {
  /** Every operator, A–Z. Null while loading. */
  operators: Profile[] | null;
  /** Every submission this season, for the progress column. */
  submissions: Submission[];
}

/** Where everyone is: the operators plus all their proof. Mentor-only reads. */
export function useRoster(seasonId: string | null): Roster {
  const [operators, setOperators] = useState<Profile[] | null>(null);
  const [snap, setSnap] = useState<{ seasonId: string; subs: Submission[] } | null>(null);

  useEffect(() => {
    if (!seasonId) return;
    return watchOperators(setOperators);
  }, [seasonId]);

  useEffect(() => {
    if (!seasonId) return;
    return watchAllSubmissions(seasonId, (subs) => setSnap({ seasonId, subs }));
  }, [seasonId]);

  const submissions = useMemo(
    () => (snap && snap.seasonId === seasonId ? snap.subs : []),
    [snap, seasonId]
  );
  return { operators, submissions };
}

export interface ConsentQueue {
  pending: Profile[] | null;
  /** The queue is capped — there are likely more behind these. */
  truncated: boolean;
}

/** Minors waiting on a parent's OK. Capped; see CONSENT_QUEUE_LIMIT. */
export function useConsentQueue(enabled: boolean): ConsentQueue {
  const [pending, setPending] = useState<Profile[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return watchPendingConsent(setPending);
  }, [enabled]);

  const sorted = useMemo(
    () =>
      pending
        ? [...pending].sort((a, b) => {
            // Longest-waiting first: never-emailed at the top, then oldest send.
            const at = a.consentEmailSentAt?.toMillis() ?? 0;
            const bt = b.consentEmailSentAt?.toMillis() ?? 0;
            return at - bt || a.name.localeCompare(b.name);
          })
        : null,
    [pending]
  );

  return {
    pending: sorted,
    truncated: (pending?.length ?? 0) >= CONSENT_QUEUE_LIMIT,
  };
}
