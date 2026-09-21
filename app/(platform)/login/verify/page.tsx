"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isSignInWithEmailLink, signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../../lib/firebase";
import { verificationInvite } from "../../../lib/accessLink";
import {
  claimAccess,
  completeEmailLink,
  restoredLinkUser,
  createApprovedMentorProfile,
  ACCESS_EMAIL_KEY,
} from "../../../lib/accessClient";
import { MentorOnboarding } from "../../../components/MentorOnboarding";
import type { MentorSignupInput } from "../../../lib/types";

type Phase =
  /** Completing the sign-in. */
  | "working"
  /** Link opened on another device — Firebase needs the email back. */
  | "need-email"
  /** Allowlisted mentor with no profile: run mentor onboarding here. */
  | "mentor-onboarding"
  /** Signed in, but the supplied invite is unavailable. */
  | "not-approved"
  /** Link expired, already used, or isn't a sign-in link at all. */
  | "bad-link"
  | "error";

function readStoredEmail(): string {
  try {
    return window.localStorage.getItem(ACCESS_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

function clearStoredEmail(): void {
  try {
    window.localStorage.removeItem(ACCESS_EMAIL_KEY);
  } catch {
    /* storage disabled — nothing to clean up */
  }
}

export default function VerifyPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("working");
  const [promptEmail, setPromptEmail] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submitting = useRef(false);

  const finishAccess = useCallback(async () => {
    const claim = await claimAccess(verificationInvite(window.location.href));
    if (!claim.ok) {
      await signOut(getFirebaseAuth());
      setPhase("not-approved");
    } else if (claim.hasProfile) {
      router.replace(claim.role === "mentor" ? "/mentor" : "/dashboard");
    } else if (claim.role === "mentor") {
      setDisplayName(getFirebaseAuth().currentUser?.displayName ?? null);
      setPhase("mentor-onboarding");
    } else {
      router.replace("/onboarding");
    }
  }, [router]);

  const complete = useCallback(async (email: string) => {
    try {
      const user = await completeEmailLink(email, window.location.href);
      clearStoredEmail();
      setDisplayName(user.displayName);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/expired-action-code") {
        setPhase("bad-link");
      } else if (code === "auth/invalid-email" || code === "auth/invalid-action-code") {
        setError("Enter the email this link was sent to. If you requested another link, open the newest email.");
        setPhase("need-email");
      } else {
        setError("We couldn't connect. Please try again.");
        setPhase("error");
      }
      return;
    }
    try { await finishAccess(); }
    catch { setPhase("error"); }
  }, [finishAccess]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const auth = getFirebaseAuth();
      await auth.authStateReady();
      if (cancelled) return;
      const link = window.location.href;
      const isLink = isSignInWithEmailLink(auth, link);
      // A verified member may return before completing their profile.
      if ((!isLink && auth.currentUser?.emailVerified) || await restoredLinkUser(link)) {
        if (!cancelled) await finishAccess();
        return;
      }
      if (cancelled) return;
      if (!isLink) { setPhase("bad-link"); return; }
      const email = readStoredEmail();
      if (!email) { setPhase("need-email"); return; }
      await complete(email);
    }
    void run().catch(() => { if (!cancelled) setPhase("error"); });
    return () => { cancelled = true; };
  }, [complete, finishAccess]);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    const email = promptEmail.trim();
    if (!email) { setError("Enter the email the link was sent to."); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    setPhase("working");
    try { await complete(email); }
    finally { submitting.current = false; setBusy(false); }
  }

  function requestNewLink() {
    const invite = verificationInvite(window.location.href);
    router.push(invite ? `/join?invite=${encodeURIComponent(invite)}` : "/login");
  }

  /** Mentor onboarding submit — the allowlist twin of redeeming an invite. */
  async function createMentor(input: MentorSignupInput): Promise<string | null> {
    try {
      const res = await createApprovedMentorProfile(input);
      if (res.ok) {
        router.replace("/mentor");
        return null;
      }
      if (res.error === "not-approved") {
        return "Your mentor access couldn't be confirmed. Ask the team for a fresh invite.";
      }
      return "Couldn't finish signup. Try again.";
    } catch {
      return "Couldn't finish signup. Try again.";
    }
  }

  /* ---------------- Mentor onboarding ---------------- */

  if (phase === "mentor-onboarding") {
    return (
      <MentorOnboarding
        prefillName={displayName}
        submitLabel="Finish setup"
        onSubmit={createMentor}
      />
    );
  }

  /* ---------------- Not on the list ---------------- */

  if (phase === "not-approved") {
    return (
      <section className="gate">
        <div className="gate__inner">
          <span className="gate__logo" aria-hidden="true">
            <img src="/brand/high-agency-mark.svg" alt="" />
          </span>
          <h1 className="h1">Your invite is unavailable.</h1>
          <p className="gate__sub">
            Ask your mentor for a fresh Season 1 invite, then verify your email again.
          </p>
          <button
            className="btn btn--primary btn--block"
            onClick={() => router.push("/")}
          >
            Apply to join
          </button>
        </div>
      </section>
    );
  }

  /* ---------------- Expired / invalid link ---------------- */

  if (phase === "bad-link" || phase === "error") {
    return (
      <section className="gate">
        <div className="gate__inner">
          <span className="gate__logo" aria-hidden="true">
            <img src="/brand/high-agency-mark.svg" alt="" />
          </span>
          <h1 className="h1">
            {phase === "bad-link" ? "This link has expired." : "Something went wrong."}
          </h1>
          <p className="gate__sub">
            {phase === "bad-link"
              ? "Open the newest sign-in email, or request a new link."
              : "We couldn't finish signing you in. Please try again."}
          </p>
          <button
            className="btn btn--primary btn--block"
            onClick={phase === "error" ? () => window.location.reload() : requestNewLink}
          >
            {phase === "error" ? "Try again" : "Get a new link"}
          </button>
        </div>
      </section>
    );
  }

  /* ---------------- Ask for the email ---------------- */

  if (phase === "need-email") {
    return (
      <section className="gate">
        <div className="gate__inner">
          <span className="gate__logo" aria-hidden="true">
            <img src="/brand/high-agency-mark.svg" alt="" />
          </span>
          <h1 className="h1">One more thing.</h1>
          <p className="gate__sub">
            It looks like you opened this link on a different device. Confirm
            the email you requested it with and we&apos;ll finish signing you in.
          </p>
          <form onSubmit={submitEmail}>
            <div className="field">
              <label htmlFor="verify-email">Email</label>
              <input
                id="verify-email"
                type="email"
                autoComplete="email"
                value={promptEmail}
                onChange={(e) => setPromptEmail(e.target.value)}
                placeholder="you@email.com"
                maxLength={254}
                autoFocus
              />
            </div>
            <button
              className="btn btn--primary btn--block"
              type="submit"
              disabled={busy}
            >
              {busy ? "…" : "Finish signing in"}
            </button>
          </form>
          {error && <p className="form-err">{error}</p>}
          <button type="button" className="link-btn" onClick={requestNewLink}>Get a new link</button>
        </div>
      </section>
    );
  }

  /* ---------------- Working ---------------- */

  return (
    <section className="gate">
      <div className="gate__inner">
        <span className="gate__logo" aria-hidden="true">
          <img src="/brand/high-agency-mark.svg" alt="" />
        </span>
        <h1 className="h1">Signing you in…</h1>
        <p className="gate__sub">One moment.</p>
      </div>
    </section>
  );
}
