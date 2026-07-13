/**
 * Firebase Admin SDK — server-only. The Admin SDK bypasses Firestore security
 * rules, so it is the one place we can *authoritatively* grant parental consent
 * on behalf of a parent who is not (and must never be) a signed-in user.
 *
 * NEVER import this from a client component. It is only used by Route Handlers
 * under `app/api/**`, which always run server-side on Node.
 *
 * Credentials are resolved from env (see the parental-consent section of the
 * README / handoff for what Sai must set in Vercel):
 *   1. FIREBASE_SERVICE_ACCOUNT — the full service-account JSON as a string.
 *   2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY — the split-field variant
 *      that's easier to paste into Vercel (escaped "\n" in the key are fixed up).
 *   3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS) — local.
 *   4. If FIRESTORE_EMULATOR_HOST is set, no credentials are needed — the Admin
 *      SDK talks to the emulator with a stub identity (used by the rules tests).
 */
import {
  getApps,
  initializeApp,
  cert,
  type App,
  type AppOptions,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  "highagency-62e67";

function serviceAccountCredential(): AppOptions["credential"] | undefined {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    const parsed = JSON.parse(json);
    if (parsed.private_key) {
      parsed.private_key = String(parsed.private_key).replace(/\\n/g, "\n");
    }
    return cert(parsed);
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return cert({
      projectId: PROJECT_ID,
      clientEmail,
      // Vercel stores the key with literal "\n"; restore real newlines.
      privateKey: privateKey.replace(/\\n/g, "\n"),
    });
  }
  // No explicit credential — rely on the emulator (FIRESTORE_EMULATOR_HOST)
  // or Application Default Credentials.
  return undefined;
}

let app: App | undefined;

function adminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const credential = serviceAccountCredential();
  app = initializeApp({
    projectId: PROJECT_ID,
    ...(credential ? { credential } : {}),
  });
  return app;
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
