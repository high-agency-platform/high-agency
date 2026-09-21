import { beforeEach, after, test, mock } from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest } from "next/server";

if (!process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_PROJECT_ID !== "demo-calendar-tests") throw new Error("Use the isolated demo-calendar-tests emulator project");
process.env.GOOGLE_CLIENT_ID = "synthetic-client";
process.env.GOOGLE_CLIENT_SECRET = "synthetic-secret";
process.env.GOOGLE_TOKEN_KEY = "01".repeat(32);
process.env.NEXT_PUBLIC_FIREBASE_EMULATORS = "false";

const { adminDb, adminAuth } = await import("../app/lib/firebaseAdmin.ts");
const { completeConnect, connectionStatus, signState, verifyState, calendarReturnTo, redirectUri, isCalendarConfigured } = await import("../app/lib/googleCalendar.ts");
const { enroll, leave, updateWorkshop, deleteWorkshop, syncMemberCalendar, restoreMemberInvitations } = await import("../app/lib/workshopServer.ts");
const { POST: disconnectRoute } = await import("../app/api/google/disconnect/route.ts");
const { GET: callback } = await import("../app/api/google/callback/route.ts");
const db = adminDb();
const realFetch = globalThis.fetch;
const events = new Map<string, Map<string, Record<string, unknown>>>();
const calls: { method: string; owner: string; id: string }[] = [];
let failCalendar = false;
let failHost = false;
let revokedStudent = false;
mock.method(adminAuth(), "getUsers", async () => ({ users: [{ email: "student@example.test" }], notFound: [] }));
mock.method(adminAuth(), "verifyIdToken", async () => ({ uid: "student", email: "student@example.test" }));
let pauseInsert: (() => Promise<void>) | null = null;
const calendar = (owner: string) => {
  if (!events.has(owner)) events.set(owner, new Map());
  return events.get(owner)!;
};
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.href === "https://oauth2.googleapis.com/token") {
    const values = new URLSearchParams(String(init?.body));
    const owner = values.get("code") ?? values.get("refresh_token")?.replace("refresh-", "") ?? "student";
    if (values.has("refresh_token") && owner === "student" && revokedStudent) return Response.json({ error: "invalid_grant" }, { status: 400 });
    return Response.json({ access_token: owner, refresh_token: `refresh-${owner}`, expires_in: 3600 });
  }
  if (url.origin === "https://oauth2.googleapis.com" && url.pathname === "/revoke") return Response.json({});
  assert.equal(url.origin, "https://www.googleapis.com", "No external fetch is permitted by this test");
  const owner = new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "") ?? "";
  const method = init?.method ?? "GET";
  const id = url.pathname.split("/events/")[1] ?? "";
  calls.push({ owner, method, id });
  if (failCalendar || (failHost && owner === "host")) return Response.json({ error: "synthetic failure" }, { status: 503 });
  const data = calendar(owner);
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (method === "GET") return Response.json({ items: [...data].map(([id, v]) => ({ id, ...v })) });
  if (method === "POST") {
    if (owner === "student" && pauseInsert) { const pause = pauseInsert; pauseInsert = null; await pause(); }
    if (data.has(body.id)) return Response.json({}, { status: 409 });
    data.set(body.id, body);
    return Response.json(body);
  }
  if (method === "PATCH") {
    if (!data.has(id)) return Response.json({}, { status: 404 });
    data.set(id, { ...data.get(id), ...body });
    return Response.json(data.get(id));
  }
  if (method === "DELETE") { data.delete(id); return new Response(null, { status: 204 }); }
  throw new Error("Unexpected request");
};
after(() => { globalThis.fetch = realFetch; mock.restoreAll(); });
beforeEach(async () => {
  events.clear(); calls.length = 0; failCalendar = false; failHost = false; revokedStudent = false;
  for (const name of ["profiles", "workshops", "googleTokens"]) await db.recursiveDelete(db.collection(name));
  await db.collection("profiles").doc("student").set({ role: "operator", enrolledWorkshops: [] });
  await db.collection("profiles").doc("host").set({ role: "mentor", name: "QA Mentor", timezone: "UTC" });
  await completeConnect("student", "student", "http://localhost:3001");
  await completeConnect("host", "host", "http://localhost:3001");
  calendar("host").set("host-event", { attendees: [{ email: "synthetic@example.test" }] });
  await db.collection("workshops").doc("session").set({
    title: "Test session", description: "Build something", mentorUid: "host", mentorName: "QA Mentor", calendarEventId: "host-event",
    startsAt: Timestamp.fromMillis(Date.now() + 86_400_000), durationMins: 60, capacity: 20, meetLink: "https://example.test/meet", recordingUrl: "", enrolledUids: [],
  });
});

test("Enrolled sessions sync on connect and enrollment; repeat sync does not duplicate or invite connected members", async () => {
  assert.equal(await enroll("session", "student"), "enrolled");
  assert.equal(calendar("student").size, 1);
  assert.deepEqual(calendar("host").get("host-event")?.attendees, []);
  const firstInsert = calls.findIndex(c => c.owner === "student" && c.method === "POST");
  assert.ok(calls.slice(0, firstInsert).some(c => c.owner === "host" && c.method === "PATCH"));
  assert.equal(await syncMemberCalendar("student"), true);
  assert.equal(await enroll("session", "student"), "already");
  assert.equal(calendar("student").size, 1);
  const copy = [...calendar("student").values()][0];
  assert.equal(copy.location, "https://example.test/meet");
  assert.equal(copy.attendees, undefined, "No member email is copied to another calendar");
});

test("Move, leave, rejoin and deletion reconcile the connected calendar", async () => {
  await enroll("session", "student");
  const originalId = [...calendar("student").keys()][0];
  await updateWorkshop("session", "host", { name: "QA Mentor", timezone: "UTC" }, {
    title: "Moved session", description: "Changed", startsAt: new Date(Date.now() + 172_800_000).toISOString(), durationMins: 90, capacity: 20, meetLink: "", recordingUrl: "",
  });
  assert.equal(calendar("student").get(originalId)?.summary, "Moved session");
  await leave("session", "student");
  assert.equal(calendar("student").size, 0);
  await enroll("session", "student");
  assert.equal(calendar("student").size, 1);
  assert.notEqual([...calendar("student").keys()][0], originalId, "Rejoining does not reuse Google's deleted event id");
  await deleteWorkshop("session", "host");
  assert.equal(calendar("student").size, 0);
});

test("Provider failure keeps the seat, shows retry state, and retries without duplicates", async () => {
  failCalendar = true;
  assert.equal(await enroll("session", "student"), "enrolled");
  assert.equal((await connectionStatus("student")).syncError, true);
  assert.equal(calendar("student").size, 0);
  failCalendar = false;
  assert.equal(await syncMemberCalendar("student"), true);
  assert.equal((await connectionStatus("student")).syncError, false);
  assert.equal(calendar("student").size, 1);
});

test("OAuth state is tamper resistant, return paths are local, callback requires browser cookie", async () => {
  assert.equal(calendarReturnTo("//attacker.example"), "/dashboard");
  const state = signState("student", "/dashboard");
  assert.equal(verifyState(state)?.uid, "student");
  assert.equal(verifyState(`${state}changed`), null);
  const response = await callback(new NextRequest(`http://localhost:3001/api/google/callback?code=student&state=${state}`));
  assert.equal(response.headers.get("location"), "http://localhost:3001/dashboard?calendar=error");
  assert.equal(redirectUri("http://localhost:3001"), "http://localhost:3001/api/google/callback");
  process.env.NEXT_PUBLIC_FIREBASE_EMULATORS = "true";
  assert.equal(isCalendarConfigured(), false);
  await assert.rejects(completeConnect("student", "student", "http://localhost:3001"), /calendar-unavailable/);
  process.env.NEXT_PUBLIC_FIREBASE_EMULATORS = "false";
});


test("A concurrent leave queues reconciliation and cannot leave a stale session copy", async () => {
  let release!: () => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  pauseInsert = async () => { started(); await gate; };
  const enrollment = enroll("session", "student");
  await ready;
  assert.equal(await leave("session", "student"), "left");
  release();
  await enrollment;
  assert.equal(calendar("student").size, 0);
  assert.equal((await connectionStatus("student")).syncError, false);
});


test("Disconnect reports failed invitation restoration and disconnected users can retry", async () => {
  await enroll("session", "student");
  failHost = true;
  const response = await disconnectRoute(new NextRequest("http://localhost:3001/api/google/disconnect", { method: "POST", headers: { authorization: "Bearer synthetic" } }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, "invitation-sync-incomplete");
  assert.equal(calendar("student").size, 0);
  assert.equal((await connectionStatus("student")).connected, false);
  assert.equal((await connectionStatus("student")).syncError, true);
  failHost = false;
  assert.equal(await syncMemberCalendar("student"), true);
  assert.deepEqual(calendar("host").get("host-event")?.attendees, [{ email: "student@example.test" }]);
  assert.equal((await connectionStatus("student")).syncError, false);
});

test("Externally revoked grants restore invitations, and host failures remain retryable", async () => {
  await enroll("session", "student");
  await db.collection("googleTokens").doc("student").update({ accessExpiresAt: 0 });
  revokedStudent = true;
  failHost = true;
  assert.equal(await syncMemberCalendar("student"), false);
  assert.equal((await connectionStatus("student")).connected, false);
  assert.equal((await connectionStatus("student")).syncError, true);
  failHost = false;
  assert.equal(await syncMemberCalendar("student"), true);
  assert.deepEqual(calendar("host").get("host-event")?.attendees, [{ email: "student@example.test" }]);
  assert.equal((await connectionStatus("student")).syncError, false);
});

test("Failed host cancellation preserves the workshop so deletion can be retried", async () => {
  await enroll("session", "student");
  failHost = true;
  await assert.rejects(deleteWorkshop("session", "host"), /google-calendar:503/);
  assert.equal((await db.collection("workshops").doc("session").get()).exists, true);
  assert.equal(calendar("student").size, 1);
  failHost = false;
  await deleteWorkshop("session", "host");
  assert.equal((await db.collection("workshops").doc("session").get()).exists, false);
  assert.equal(calendar("student").size, 0);
});


test("Hidden future fixtures are neither synced nor invited, and existing future copies are removed", async () => {
  await enroll("session", "student");
  assert.equal(calendar("student").size, 1);
  await db.collection("workshops").doc("session").update({ hidden: true });
  calls.length = 0;
  assert.equal(await syncMemberCalendar("student"), true);
  assert.equal(calendar("student").size, 0);
  assert.equal(await restoreMemberInvitations("student"), true);
  await enroll("session", "student");
  assert.equal(calls.filter(c => c.owner === "host").length, 0, "Hidden fixtures never mutate or invite on the host calendar");
  assert.equal(calendar("student").size, 0);
});
