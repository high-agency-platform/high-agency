"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "../../lib/firebase";
import { useAuth } from "../../components/AuthProvider";

export default function LoginPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already signed in → route past login. Profile decides the destination.
  useEffect(() => {
    if (user && profile !== undefined) {
      router.replace(profile ? "/dashboard" : "/onboarding");
    }
  }, [user, profile, router]);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(getFirebaseAuth(), googleProvider);
      // redirect handled by the effect above once profile resolves
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError("Sign-in failed. Try again.");
      }
      setBusy(false);
    }
  }

  return (
    <section className="auth-hero wrap">
      <div className="auth-hero__copy">
        <span className="eyebrow">
          <span className="dot" /> Operator access
        </span>
        <h1 className="display">
          Build with your <span className="strike">tribe.</span>
        </h1>
        <p className="lead">
          Join a cohort of operators, set real milestones, and ship together.
        </p>
        <div className="auth-hero__cta">
          <button className="btn btn--primary" onClick={signIn} disabled={busy}>
            {busy ? "Signing in…" : "Continue with Google"}
          </button>
          {error && <p className="form-err">{error}</p>}
        </div>
      </div>
    </section>
  );
}
