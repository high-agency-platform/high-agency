import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

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

function getDb(): Firestore {
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!db) db = getFirestore(app);
  return db;
}

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
 * Persist a founding-batch application to Firestore. Returns the local
 * record (operator id + queue position) used to render the success step.
 * Throws on write failure so the caller can fall back gracefully.
 */
export async function submitApplication(
  input: ApplicationInput
): Promise<ApplicationRecord> {
  const opId = "HA-" + String(Math.floor(Math.random() * 900) + 100);
  const queuePos = Math.floor(Math.random() * 40) + 47; // 47–86
  const record: ApplicationRecord = {
    ...input,
    opId,
    queuePos,
    submitted: true,
    ts: Date.now(),
  };

  await addDoc(collection(getDb(), WAITLIST_COLLECTION), {
    name: input.name,
    email: input.email,
    age: input.age,
    building: input.building,
    boldest: input.boldest,
    opId,
    queuePos,
    createdAt: serverTimestamp(),
    source: "waitlist",
  });

  return record;
}
