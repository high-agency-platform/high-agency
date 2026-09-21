"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { requestAccessLink, ACCESS_EMAIL_KEY } from "../lib/accessClient";

type GateState = "idle" | "sent" | "not-approved" | "error";

export default function AccessForm({ invite = "" }: { invite?: string }) {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [state, setState] = useState<GateState>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** The address we actually sent to, so the confirmation can name it even if
   *  the input is later edited. */
  const [qaUrl, setQaUrl] = useState("");
  const [sentTo, setSentTo] = useState("");

  // Already signed in → route past login. Unchanged from before the gate:
  // no profile means onboarding, and mentors get their own app.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("mode") === "signIn" && url.searchParams.has("oobCode")) {
      router.replace(`/login/verify${url.search}`);
      return;
    }
    if (user && profile) {
      router.replace(
        !profile ? "/onboarding" : profile.role === "mentor" ? "/mentor" : "/dashboard"
      );
    }
  }, [user, profile, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email.");
      return;
    }
    setBusy(true);
    setError("");

    const res = await requestAccessLink(trimmed, invite);

    if (res.status === "sent") {
      // Firebase needs this address back to complete the sign-in on /verify.
      try {
        window.localStorage.setItem(ACCESS_EMAIL_KEY, trimmed.toLowerCase());
      } catch {
        // Private mode / storage disabled — /verify falls back to asking.
      }
      setQaUrl(res.qaUrl ?? "");
      setSentTo(trimmed);
      setState("sent");
    } else if (res.status === "not-approved") {
      setState("not-approved");
    } else {
      setState("error");
      setError(
        res.message ??
          (res.status === "bad-email"
            ? "That doesn't look like a valid email."
            : "Something went wrong. Try again shortly.")
      );
    }
    setBusy(false);
  }

  function reset() {
    setState("idle");
    setError("");
    setSentTo("");
  }

  /* ---------------- Not in the batch ---------------- */

  if (state === "not-approved") {
    return (
      <section className="gate">
        <div className="gate__inner">
          <span className="gate__logo" aria-hidden="true">
            <img src="/brand/high-agency-mark.svg" alt="" />
          </span>
          <h1 className="h1">{invite ? "This invite is unavailable." : "You need an invite."}</h1>
          <p className="gate__sub">
            {invite ? "The link may have expired or filled up. Ask your mentor for a new invite." : "Open your Season 1 invite to join, or sign in with the email you used before."}
          </p>
          <button
            className="btn btn--primary btn--block"
            onClick={() => router.push("/")}
          >
            Apply to join
          </button>
          <p className="auth-switch">
            Wrong email?{" "}
            <button type="button" className="link-btn" onClick={reset}>
              Try another
            </button>
          </p>
        </div>
      </section>
    );
  }

  /* ---------------- Link sent ---------------- */

  if (state === "sent") {
    return (
      <section className="gate">
        <div className="gate__inner">
          <span className="gate__logo" aria-hidden="true">
            <img src="/brand/high-agency-mark.svg" alt="" />
          </span>
          <h1 className="h1">{qaUrl ? "Your QA inbox." : "Check your inbox."}</h1>
          <p className="gate__sub">
            {qaUrl ? "A test verification link is ready for" : "We sent a sign-in link to"} <strong>{sentTo}</strong>. It&apos;s
            single-use and expires shortly — open it on this device if you can.
          </p>
          {qaUrl && <a href={qaUrl} className="btn btn--primary btn--block">Verify test email</a>}
          <p className="auth-switch">
            Didn&apos;t arrive? Check spam, or{" "}
            <button type="button" className="link-btn" onClick={reset}>
              use a different email
            </button>
            .
          </p>
        </div>
      </section>
    );
  }

  /* ---------------- The gate ---------------- */

  return (
    <section className="gate">
      <div className="gate__inner">
        <span className="gate__logo" aria-hidden="true">
          <img src="/brand/high-agency-mark.svg" alt="" />
        </span>
        <span className="micro">Season 1</span>
        <h1 className="h1">{invite ? "Your next chapter." : "Welcome back."}</h1>
        <p className="gate__sub">
          {invite ? "Choose your email, verify it, and make your profile. Your season starts here." : "Enter your account email. We’ll send a secure sign-in link."}
        </p>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="gate-email">Email</label>
            <input
              id="gate-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              maxLength={254}
              autoFocus
            />
          </div>
          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? "Checking…" : "Email me a link"}
          </button>
        </form>

        {error && <p className="form-err">{error}</p>}

        <p className="auth-switch">
          Not in the batch?{" "}
          <button type="button" className="link-btn" onClick={() => router.push("/")}>
            Apply to join
          </button>
        </p>
      </div>
    </section>
  );
}
