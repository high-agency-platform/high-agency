/** Idempotent, explicit launch configuration; never deletes member or proof data. */
import nextEnv from "@next/env";
import { Timestamp } from "firebase-admin/firestore";
import { WELCOME_MILESTONE } from "../app/lib/program";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const production = process.argv.includes("--production");
const apply = process.argv.includes("--apply");
if (production ? !!process.env.FIRESTORE_EMULATOR_HOST : !process.env.FIRESTORE_EMULATOR_HOST) throw Error("Select live production explicitly or use an emulator");
const { adminDb, adminAuth } = await import("../app/lib/firebaseAdmin");
const db = adminDb();
const start = new Date("2026-09-21T23:00:00.000Z"); // 7 PM America/Toronto.
const host = await adminAuth().getUserByEmail(production ? "josh@high-agency.io" : "mentor@example.test");
const advisor = production ? await adminAuth().getUserByEmail("saiamartya19@gmail.com") : host;
const profiles = await db.collection("profiles").get();
const hiddenIds = new Set<string>();
if (production) for (const p of profiles.docs) {
  let email = "";
  if (!p.id.startsWith("seed-")) try { email = (await adminAuth().getUser(p.id)).email ?? ""; } catch {}
  if (p.id.startsWith("seed-") || /^saiamartya19\+qa-(operator|mentor)@gmail\.com$/i.test(email)) hiddenIds.add(p.id);
}
hiddenIds.delete(host.uid); hiddenIds.delete(advisor.uid);
const workshops = await db.collection("workshops").get();
const fixtureSessions = production ? workshops.docs.filter(d => d.id.startsWith("seed-") || hiddenIds.has(d.data().mentorUid) || /\b(QA|test)\b/i.test(String(d.data().title))) : [];
const sessionRef = db.collection("workshops").doc("s1-welcome-2026-09-21");
const trackRef = db.collection("seasons").doc("s1");
if (apply) await db.runTransaction(async tx => {
  const [track, session, hostProfile, advisorProfile] = await Promise.all([tx.get(trackRef), tx.get(sessionRef), tx.get(db.collection("profiles").doc(host.uid)), tx.get(db.collection("profiles").doc(advisor.uid))]);
  if (!track.exists || !hostProfile.exists || !advisorProfile.exists) throw Error("Expected existing track and staff profiles");
  const existing = track.data()!.milestones as {id:string; released?:boolean}[];
  tx.update(trackRef, { milestones: [WELCOME_MILESTONE, ...existing.filter(m => m.id !== WELCOME_MILESTONE.id).map(m => ({ ...m, released: false }))], state: "live", updatedAt: Timestamp.now(), updatedByUid: advisor.uid, updatedByName: String(advisorProfile.data()!.name) });
  tx.update(hostProfile.ref, {role:"mentor",hidden:false,updatedAt:Timestamp.now()});
  if(production) tx.update(advisorProfile.ref,{role:"mentor",staffTitle:"advisor",hidden:false,updatedAt:Timestamp.now()});
  for(const uid of hiddenIds) tx.update(db.collection("profiles").doc(uid),{hidden:true});
  for(const s of fixtureSessions) tx.update(s.ref,{hidden:true});
  tx.set(sessionRef, {title:"High Agency | Cohort 1 (Americas)",description:"Welcome to Season 1. Meet the cohort, get oriented on the platform, and take your first step: introduce yourself in Slack.",mentorUid:host.uid,mentorName:String(hostProfile.data()!.name),kind:"workshop",startsAt:Timestamp.fromDate(start),durationMins:90,capacity:50,meetLink:"https://meet.google.com/rja-mtxx-eqo",recordingUrl:"",hidden:false,...(!session.exists?{enrolledUids:[],calendarEventId:"",calendarHtmlLink:"",createdAt:Timestamp.now()}:{}),updatedAt:Timestamp.now()},{merge:true});
  if(production) for(const email of ["josh@high-agency.io","saiamartya19@gmail.com"]) tx.set(db.collection("approvedMembers").doc(email),{role:"mentor"},{merge:true});
});
console.log(JSON.stringify({applied:apply,environment:production?"production":"emulator",hiddenProfiles:hiddenIds.size,hiddenSessions:fixtureSessions.length,startsAt:start.toISOString(),welcomeOnlyOpen:true,existingProofPreserved:true}));
