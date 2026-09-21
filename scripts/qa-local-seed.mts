import { WELCOME_MILESTONE } from "../app/lib/program";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../app/lib/firebaseAdmin";
import { createSeasonInvite } from "../app/lib/accessGate";

if (process.env.FIREBASE_PROJECT_ID !== "demo-highagency" || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("Emulators required");
const db = adminDb();
const track = JSON.parse(readFileSync(new URL("./season-content.json", import.meta.url), "utf8"));
await db.collection("seasons").doc("s1").set({ ...track, milestones: [WELCOME_MILESTONE, ...track.milestones.map((m: Record<string, unknown>) => ({ ...m, released: false }))], updatedAt: Timestamp.now(), createdAt: Timestamp.now() });
for (const role of ["operator", "mentor"]) {
  const uid = `qa-${role}`;
  await adminAuth().createUser({ uid, email: `${role}@example.test`, emailVerified: true });
  await db.collection("profiles").doc(uid).set({ uid, role, name: role === "mentor" ? "QA Mentor" : "QA Student", ageBand: "18+", country: "Canada", timezone: "America/Toronto", headline: "Here to build", building: "", stage: "idea", domains: [], skills: [], links: {}, bio: "", consentStatus: "granted", plan: "free", streak: 0, streakFreezes: 0, lastActiveDay: new Date().toISOString().slice(0, 10), lastBuildLogDay: "", enrolledWorkshops: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
}
const invite = await createSeasonInvite(50);
await db.collection("qaConfig").doc("invite").set({ code: invite });
console.log("Isolated QA ready: http://localhost:3001/qa and http://127.0.0.1:3001/qa");
