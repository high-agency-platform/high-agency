/**
 * Server-only. Everything that changes a workshop — authoring, enrolling,
 * leaving — lives here, behind the Route Handlers in app/api/workshops/**.
 * Clients never write `workshops/*` directly (the rules say so), because a
 * change to a session may also have to reach the host's Google Calendar.
 *
 * Calendar is best-effort on top of Firestore: the seat is always the truth,
 * and a calendar hiccup never costs anyone a place. When the mentor hasn't
 * connected Google, the session is a plain doc with whatever link they typed.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./firebaseAdmin";
import { HttpError } from "./serverAuth";
import {
  accessTokenFor,
  createMeetEvent,
  updateEvent,
  setAttendees,
  deleteEvent,
  GOOGLE_TOKENS,
  memberEventId,
  syncMemberEvent,
  pruneMemberEvents,
} from "./googleCalendar";
import {
  WORKSHOP_MIN_CAPACITY,
  WORKSHOP_MAX_CAPACITY,
  WORKSHOP_MAX_DURATION_MINS,
} from "./types";

export interface WorkshopWire {
  title: string;
  description: string;
  /** ISO datetime. */
  startsAt: string;
  durationMins: number;
  capacity: number;
  /** Used only when the host has no calendar connected. */
  meetLink: string;
  recordingUrl: string;
}

interface Clean {
  title: string;
  description: string;
  startsAt: Date;
  durationMins: number;
  capacity: number;
  meetLink: string;
  recordingUrl: string;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function urlish(v: unknown, max: number): string {
  const s = str(v, max);
  return s === "" || /^https?:\/\//i.test(s) ? s : "";
}

/** Bound every field the way the old rules did. Throws 400 on anything that
 *  can't be a session. */
export function cleanWorkshop(input: Partial<WorkshopWire>): Clean {
  const title = str(input.title, 120);
  if (!title) throw new HttpError(400, "title-required");
  const startsAt = new Date(typeof input.startsAt === "string" ? input.startsAt : NaN);
  if (isNaN(startsAt.getTime())) throw new HttpError(400, "bad-start");
  const durationMins = Math.round(Number(input.durationMins));
  if (!(durationMins > 0 && durationMins <= WORKSHOP_MAX_DURATION_MINS)) throw new HttpError(400, "bad-duration");
  const capacity = Math.round(Number(input.capacity));
  if (!(capacity >= WORKSHOP_MIN_CAPACITY && capacity <= WORKSHOP_MAX_CAPACITY)) {
    throw new HttpError(400, "bad-capacity");
  }
  return {
    title,
    description: str(input.description, 1000),
    startsAt,
    durationMins,
    capacity,
    meetLink: urlish(input.meetLink, 500),
    recordingUrl: urlish(input.recordingUrl, 500),
  };
}

/** Sign-in emails for a set of uids — what goes on the guest list. */
async function emailsFor(uids: string[]): Promise<string[]> {
  if (uids.length === 0) return [];
  const linked = await adminDb().getAll(...uids.map(uid => adminDb().collection(GOOGLE_TOKENS).doc(uid)));
  uids = uids.filter((_, i) => !linked[i].data()?.refreshTokenEnc);
  const out: string[] = [];
  for (let i = 0; i < uids.length; i += 100) {
    const res = await adminAuth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    for (const u of res.users) if (u.email) out.push(u.email);
  }
  return out;
}

function eventInput(c: Clean, mentorName: string, timezone: string, attendees: string[]) {
  return {
    summary: c.title,
    description: `${c.description}\n\nHigh Agency workshop with ${mentorName}.`.trim(),
    start: c.startsAt,
    end: new Date(c.startsAt.getTime() + c.durationMins * 60_000),
    timezone,
    attendees,
  };
}

export async function createWorkshop(
  mentorUid: string,
  mentor: Record<string, unknown>,
  input: Partial<WorkshopWire>
): Promise<{ id: string; calendar: "linked" | "manual" }> {
  const c = cleanWorkshop(input);
  const mentorName = String(mentor.name ?? "Mentor");
  const timezone = String(mentor.timezone ?? "UTC");

  let meetLink = c.meetLink;
  let calendarEventId = "";
  const token = await accessTokenFor(mentorUid);
  if (token) {
    const ev = await createMeetEvent(token, eventInput(c, mentorName, timezone, []));
    meetLink = ev.meetLink || meetLink;
    calendarEventId = ev.eventId;
  }

  const ref = await adminDb().collection("workshops").add({
    title: c.title,
    mentorName,
    mentorUid,
    description: c.description,
    startsAt: Timestamp.fromDate(c.startsAt),
    durationMins: c.durationMins,
    capacity: c.capacity,
    meetLink,
    recordingUrl: c.recordingUrl,
    enrolledUids: [],
    ...(calendarEventId ? { calendarEventId } : {}),
  });
  return { id: ref.id, calendar: calendarEventId ? "linked" : "manual" };
}

async function ownedWorkshop(id: string, mentorUid: string) {
  const ref = adminDb().collection("workshops").doc(id);
  const snap = await ref.get();
  const data = snap.data();
  if (!data) throw new HttpError(404, "not-found");
  if (data.mentorUid !== mentorUid) throw new HttpError(403, "forbidden");
  return { ref, data };
}

export async function updateWorkshop(
  id: string,
  mentorUid: string,
  mentor: Record<string, unknown>,
  input: Partial<WorkshopWire>
): Promise<void> {
  const { ref, data } = await ownedWorkshop(id, mentorUid);
  const c = cleanWorkshop(input);
  const taken = Array.isArray(data.enrolledUids) ? data.enrolledUids.length : 0;
  if (c.capacity < taken) throw new HttpError(400, "capacity-below-taken");

  const mentorName = String(mentor.name ?? data.mentorName ?? "Mentor");
  const timezone = String(mentor.timezone ?? "UTC");
  let meetLink = data.calendarEventId ? String(data.meetLink ?? "") : c.meetLink;

  const token = await accessTokenFor(mentorUid);
  if (token && typeof data.calendarEventId === "string" && data.calendarEventId) {
    await updateEvent(token, data.calendarEventId, eventInput(c, mentorName, timezone, []));
  } else if (token && !data.calendarEventId) {
    // Connected since this session was made: link it now.
    const ev = await createMeetEvent(
      token,
      eventInput(c, mentorName, timezone, await emailsFor(data.enrolledUids ?? []))
    );
    meetLink = ev.meetLink || meetLink;
    await ref.update({ calendarEventId: ev.eventId });
  }

  await ref.update({
    title: c.title,
    description: c.description,
    startsAt: Timestamp.fromDate(c.startsAt),
    durationMins: c.durationMins,
    capacity: c.capacity,
    meetLink,
    recordingUrl: c.recordingUrl,
    mentorName,
  });
  await Promise.all(((data.enrolledUids as string[]) ?? []).map(syncMemberCalendar));
}

export async function deleteWorkshop(id: string, mentorUid: string): Promise<void> {
  const { ref, data } = await ownedWorkshop(id, mentorUid);
  const token = await accessTokenFor(mentorUid);
  if (typeof data.calendarEventId === "string" && data.calendarEventId) {
    if (!token) throw new HttpError(409, "calendar-reconnect-required");
    await deleteEvent(token, data.calendarEventId);
  }
  const db = adminDb();
  const batch = db.batch();
  for (const uid of (data.enrolledUids as string[] | undefined) ?? []) {
    batch.update(db.collection("profiles").doc(uid), {
      enrolledWorkshops: FieldValue.arrayRemove(id),
    });
  }
  batch.delete(ref);
  await batch.commit();
  await Promise.all(((data.enrolledUids as string[]) ?? []).map(syncMemberCalendar));
}

export type SeatResult = "enrolled" | "already" | "full" | "left" | "not-enrolled";

/** Keep the calendar guest list equal to the roster. Never throws — a
 *  calendar failure must not undo a seat. */
async function syncGuests(workshopId: string): Promise<boolean> {
  try {
    const snap = await adminDb().collection("workshops").doc(workshopId).get();
    const data = snap.data();
    if (data?.hidden === true || !data?.calendarEventId || typeof data.mentorUid !== "string") return true;
    const token = await accessTokenFor(data.mentorUid);
    if (!token) throw new Error("host-calendar-disconnected");
    await setAttendees(token, data.calendarEventId, await emailsFor(data.enrolledUids ?? []));
    return true;
  } catch {
    console.warn("[workshops] guest sync failed");
    return false;
  }
}

/** Claim a seat atomically; then invite the operator to the calendar event. */
export async function enroll(workshopId: string, uid: string): Promise<SeatResult> {
  const db = adminDb();
  const wRef = db.collection("workshops").doc(workshopId);
  const pRef = db.collection("profiles").doc(uid);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(wRef);
    const w = snap.data();
    if (!w) throw new HttpError(404, "not-found");
    const roster: string[] = Array.isArray(w.enrolledUids) ? w.enrolledUids : [];
    if (roster.includes(uid)) {
      tx.update(pRef, { enrolledWorkshops: FieldValue.arrayUnion(workshopId) });
      return "already" as const;
    }
    if (typeof w.capacity === "number" && roster.length >= w.capacity) return "full" as const;
    tx.update(wRef, { enrolledUids: FieldValue.arrayUnion(uid), enrollmentKeys: { ...(w.enrollmentKeys ?? {}), [uid]: `${Date.now()}-${Math.random().toString(36).slice(2)}` } });
    tx.update(pRef, {
      enrolledWorkshops: FieldValue.arrayUnion(workshopId),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return "enrolled" as const;
  });
  if (result === "enrolled" || result === "already") {
    await syncGuests(workshopId);
    await syncMemberCalendar(uid);
  }
  return result;
}

/** Give the seat back; drop the operator from the guest list. */
export async function leave(workshopId: string, uid: string): Promise<SeatResult> {
  const db = adminDb();
  const wRef = db.collection("workshops").doc(workshopId);
  const pRef = db.collection("profiles").doc(uid);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(wRef);
    const w = snap.data();
    if (!w) throw new HttpError(404, "not-found");
    const roster: string[] = Array.isArray(w.enrolledUids) ? w.enrolledUids : [];
    tx.update(pRef, {
      enrolledWorkshops: FieldValue.arrayRemove(workshopId),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (!roster.includes(uid)) return "not-enrolled" as const;
    tx.update(wRef, { enrolledUids: FieldValue.arrayRemove(uid) });
    return "left" as const;
  });
  if (result === "left" || result === "not-enrolled") {
    await syncGuests(workshopId);
    await syncMemberCalendar(uid);
  }
  return result;
}


/** Reconcile from the current roster, including existing enrollments after OAuth. */
async function reconcileMemberCalendar(uid: string): Promise<boolean> {
  const db = adminDb();
  const tokenRef = db.collection(GOOGLE_TOKENS).doc(uid);
  try {
    const token = await accessTokenFor(uid);
    if (!token) return restoreMemberInvitations(uid);
    const sessions = await db.collection("workshops").where("enrolledUids", "array-contains", uid).get();
    const keep = new Set<string>();
    for (const snap of sessions.docs) {
      const w = snap.data();
      if (w.hidden === true || w.mentorUid === uid) continue;
      const start = w.startsAt.toDate() as Date;
      const end = new Date(start.getTime() + Number(w.durationMins) * 60_000);
      if (end.getTime() <= Date.now()) continue;
      // Cancel any old email invitation before inserting the private copy.
      if (!await syncGuests(snap.id)) throw new Error("guest-sync-failed");
      const id = memberEventId(snap.id, String(w.enrollmentKeys?.[uid] ?? "legacy"));
      keep.add(id);
      await syncMemberEvent(token, id, {
        summary: String(w.title), description: `${w.description ?? ""}\n\nHigh Agency workshop with ${w.mentorName ?? "your mentor"}.\n${w.meetLink ?? ""}`.trim(),
        start, end, timezone: "UTC",
      }, String(w.meetLink ?? ""));
    }
    await pruneMemberEvents(token, keep);
    await tokenRef.update({ syncError: false });
    return true;
  } catch {
    // Persist a visible retry state without logging provider payloads or member data.
    if ((await tokenRef.get()).exists) await tokenRef.update({ syncError: true });
    console.warn("[workshops] member calendar sync incomplete");
    return false;
  }
}

export async function restoreMemberInvitations(uid: string): Promise<boolean> {
  const db = adminDb();
  const sessions = await db.collection("workshops").where("enrolledUids", "array-contains", uid).get();
  const results = await Promise.all(sessions.docs.filter(s => s.data().hidden !== true).map(s => syncGuests(s.id)));
  const ok = results.every(Boolean);
  await db.collection(GOOGLE_TOKENS).doc(uid).set({ invitationSyncPending: !ok, syncError: !ok }, { merge: true });
  return ok;
}


/** A Firestore lease serializes reconciliation across concurrent server instances. */
export async function syncMemberCalendar(uid: string): Promise<boolean> {
  const db = adminDb();
  const ref = db.collection(GOOGLE_TOKENS).doc(uid);
  const acquired = await db.runTransaction(async tx => {
    const data = (await tx.get(ref)).data();
    if (!data?.refreshTokenEnc) return data?.invitationSyncPending === true ? "restore" : "disconnected";
    if (Number(data.syncLockUntil ?? 0) > Date.now()) {
      tx.update(ref, { syncRequested: true, syncError: true });
      return "busy";
    }
    tx.update(ref, { syncLockUntil: Date.now() + 300_000, syncRequested: false });
    return "acquired";
  });
  if (acquired === "restore") return restoreMemberInvitations(uid);
  if (acquired !== "acquired") return acquired === "disconnected";
  let ok = false;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      ok = await reconcileMemberCalendar(uid);
      const again = await db.runTransaction(async tx => {
        const data = (await tx.get(ref)).data();
        if (!data) return false;
        const pending = data.syncRequested === true;
        if (pending && attempt < 2) tx.update(ref, { syncRequested: false });
        return pending;
      });
      if (!again || !ok) break;
    }
  } finally {
    await db.runTransaction(async tx => {
      const data = (await tx.get(ref)).data();
      if (data) {
        ok = ok && data.syncRequested !== true;
        tx.update(ref, { syncLockUntil: 0, syncError: !ok });
      }
    });
  }
  return ok;
}
