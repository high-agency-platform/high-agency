import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

// Applicants notionally ahead of #1, so early queue numbers don't read
// "#1, #2" while the founding batch fills. Set to 0 for a true raw count.
const QUEUE_BASE = 46;

// Firebase web config is public by design, gating happens via Firestore
// security rules, not by hiding these keys. Values can be overridden per
// environment with NEXT_PUBLIC_FIREBASE_* vars; the literals are the default.
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyDq6kG7N-UpYJxfQX6xNjRdsfmJcPByksw",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "canary-os.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "canary-os",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "canary-os.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "234056429065",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:234056429065:web:d58397feb5e4f7cbdc92d8",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-RLHTDXDB72",
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

export function getDb(): Firestore {
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!db) db = getFirestore(app);
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!auth) auth = getAuth(app);
  return auth;
}

export const googleProvider = new GoogleAuthProvider();

export const WAITLIST_COLLECTION = "applications";

export interface ApplicationInput {
  name: string;
  email: string;
  age: string;
  building: string;
  boldest: string;
}

export interface ApplicationRecord extends ApplicationInput {
  opId: string;
  queuePos: number;
  submitted: true;
  ts: number;
}

/**
 * Persist a founding-batch application to Firestore. The queue position is the
 * real number of applications on record (QUEUE_BASE + existing count + 1), not
 * a random value, so it's stable and grows by one with each genuine signup.
 * Returns the local record (operator id + queue position) used to render the
 * success step. Throws on write failure so the caller can fall back gracefully.
 */
export async function submitApplication(
  input: ApplicationInput
): Promise<ApplicationRecord> {
  const db = getDb();
  const col = collection(db, WAITLIST_COLLECTION);
  // Single public counter doc — the only readable thing. Application docs stay
  // create-only so applicant PII is never exposed. The transaction makes the
  // position monotonic even under concurrent submissions.
  const counterRef = doc(db, "meta", "waitlist");

  const { opId, queuePos } = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = (snap.exists() ? snap.data().count : 0) || 0;
    const pos = QUEUE_BASE + current + 1;
    const id = "HA-" + String(pos).padStart(3, "0");

    const appRef = doc(col); // new auto-id within the create-only collection
    tx.set(appRef, {
      name: input.name,
      email: input.email,
      age: input.age,
      building: input.building,
      boldest: input.boldest,
      opId: id,
      queuePos: pos,
      createdAt: serverTimestamp(),
      source: "waitlist",
    });
    tx.set(
      counterRef,
      { count: current + 1, updatedAt: serverTimestamp() },
      { merge: true }
    );

    return { opId: id, queuePos: pos };
  });

  return {
    ...input,
    opId,
    queuePos,
    submitted: true,
    ts: Date.now(),
  };
}
