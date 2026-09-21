"use client";

/* Browser-side wrappers for the server-authoritative routes under app/api.
   Every call carries the signed-in user's Firebase ID token. */

import { getFirebaseAuth } from "./firebase";
import type { WorkshopWire } from "./workshopServer";
import type { SeasonWire, SubmitWire, ReviewWire } from "./seasonServer";
import type { SubmissionStatus } from "./types";

export type { WorkshopWire, SeasonWire, SubmitWire, ReviewWire };

async function authed<T>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("not-signed-in");
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/* ---------------- Workshops ---------------- */

export async function createWorkshop(
  input: WorkshopWire
): Promise<{ id: string; calendar: "linked" | "manual" }> {
  const r = await authed<{ id: string; calendar: "linked" | "manual"; error?: string }>(
    "/api/workshops",
    { method: "POST", body: JSON.stringify(input) }
  );
  if (!r.ok) throw new Error(r.data.error ?? "failed");
  return r.data;
}

export async function updateWorkshop(id: string, input: WorkshopWire): Promise<void> {
  const r = await authed<{ error?: string }>(`/api/workshops/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(r.data.error ?? "failed");
}

export async function deleteWorkshop(id: string): Promise<void> {
  const r = await authed<{ error?: string }>(`/api/workshops/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(r.data.error ?? "failed");
}

export type SeatResult = "enrolled" | "already" | "full" | "left" | "not-enrolled";

export async function enrollWorkshop(id: string): Promise<SeatResult> {
  const r = await authed<{ status?: SeatResult; error?: string }>(`/api/workshops/${id}/enroll`, {
    method: "POST",
  });
  if (!r.ok || !r.data.status) throw new Error(r.data.error ?? "failed");
  return r.data.status;
}

export async function leaveWorkshop(id: string): Promise<SeatResult> {
  const r = await authed<{ status?: SeatResult; error?: string }>(`/api/workshops/${id}/enroll`, {
    method: "DELETE",
  });
  if (!r.ok || !r.data.status) throw new Error(r.data.error ?? "failed");
  return r.data.status;
}

/* ---------------- The season ---------------- */

/** Create or save the shared season. Throws with the server's code:
 *  "stale-write" (someone saved first — reload) or
 *  "milestone-has-submissions" (a removed step already has proof). */
export async function saveSeason(input: SeasonWire): Promise<{ id: string; updatedAt: number }> {
  const r = await authed<{ id: string; updatedAt: number; error?: string }>("/api/season", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(r.data.error ?? "failed");
  return r.data;
}

/* ---------------- Proof (streak action) ---------------- */

export async function submitProof(
  input: SubmitWire
): Promise<{ status: SubmissionStatus; attempt: number; streak: number }> {
  const r = await authed<{ status: SubmissionStatus; attempt: number; streak: number; error?: string }>(
    "/api/submissions",
    { method: "POST", body: JSON.stringify(input) }
  );
  if (!r.ok) throw new Error(r.data.error ?? "failed");
  return r.data;
}

export async function reviewProof(input: ReviewWire): Promise<{ status: SubmissionStatus }> {
  const r = await authed<{ status: SubmissionStatus; error?: string }>("/api/submissions/review", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(r.data.error ?? "failed");
  return r.data;
}

/* ---------------- Google Calendar ---------------- */

export interface CalendarStatus {
  /** The OAuth client exists on the server at all. */
  configured: boolean;
  /** This member has connected an account. */
  connected: boolean;
  email: string;
  syncError: boolean;
}

export async function calendarStatus(): Promise<CalendarStatus> {
  const r = await authed<Partial<CalendarStatus>>("/api/google/status");
  if (!r.ok) throw new Error("calendar-status-failed");
  return {
    configured: !!r.data.configured,
    connected: !!r.data.connected,
    email: r.data.email ?? "",
    syncError: !!r.data.syncError,
  };
}

/** Kick off the connect flow: the browser leaves for Google and comes back to
 *  `returnTo` with ?calendar=connected. */
export async function connectCalendar(returnTo: string): Promise<void> {
  const r = await authed<{ url?: string; error?: string }>("/api/google/connect", {
    method: "POST",
    body: JSON.stringify({ returnTo }),
  });
  if (!r.ok || !r.data.url) throw new Error(r.data.error ?? "failed");
  window.location.assign(r.data.url);
}

export async function disconnectCalendar(): Promise<void> {
  const r = await authed<{ error?: string }>("/api/google/disconnect", { method: "POST" });
  if (!r.ok) throw new Error(r.data.error ?? "failed");
}

export async function syncCalendar(): Promise<void> {
  const r = await authed<{ error?: string }>("/api/google/sync", { method: "POST" });
  if (!r.ok) throw new Error(r.data.error ?? "sync-failed");
}
