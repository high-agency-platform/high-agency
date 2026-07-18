"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Peek =
  | { status: "loading" }
  | { status: "valid"; childName: string }
  | { status: "used"; childName?: string }
  | { status: "expired"; childName?: string }
  | { status: "invalid" }
  | { status: "granted"; childName: string }
  | { status: "error" };

export default function ConsentApprovalPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [state, setState] = useState<Peek>({ status: "loading" });
  const [busy, setBusy] = useState(false);

  // Peek at the token to render who's being approved — without consuming it.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/consent/approve?token=${encodeURIComponent(token)}`
        );
        const data = (await res.json()) as {
          status: "valid" | "used" | "expired" | "invalid";
          childName?: string;
        };
        if (!live) return;
        switch (data.status) {
          case "valid":
            setState({ status: "valid", childName: data.childName ?? "your child" });
            break;
          case "used":
            setState({ status: "used", childName: data.childName });
            break;
          case "expired":
            setState({ status: "expired", childName: data.childName });
            break;
          default:
            setState({ status: "invalid" });
        }
      } catch {
        if (live) setState({ status: "error" });
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);

  async function approve() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/consent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as {
        status: "granted" | "used" | "expired" | "invalid";
        childName?: string;
      };
      switch (data.status) {
        case "granted":
          setState({ status: "granted", childName: data.childName ?? "your child" });
          break;
        case "used":
          setState({ status: "used", childName: data.childName });
          break;
        case "expired":
          setState({ status: "expired", childName: data.childName });
          break;
        default:
          setState({ status: "invalid" });
      }
    } catch {
      setState({ status: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="consent">
      <div className="consent__inner">
        <Link href="/" className="consent__brand">
          <span className="topbar__logo" aria-hidden="true">
            <img src="/brand/high-agency-mark.svg" alt="" />
          </span>
          High Agency
        </Link>

        <ConsentBody state={state} busy={busy} onApprove={approve} />
      </div>
    </main>
  );
}

function ConsentBody({
  state,
  busy,
  onApprove,
}: {
  state: Peek;
  busy: boolean;
  onApprove: () => void;
}) {
  if (state.status === "loading") {
    return <p className="lead">Checking your consent link…</p>;
  }

  if (state.status === "granted") {
    return (
      <div className="tile consent__card">
        <span className="eyebrow eyebrow--signal">
          <span className="dot" /> Approved
        </span>
        <h1 className="h2">Thank you — {state.childName} is all set.</h1>
        <p className="lead">
          Consent is recorded and {state.childName}&apos;s community access is now
          unlocked. You can close this page. There&apos;s nothing else you need to
          do.
        </p>
      </div>
    );
  }

  if (state.status === "valid") {
    return (
      <div className="tile consent__card">
        <span className="eyebrow">
          <span className="dot" /> Parental consent
        </span>
        <h1 className="h2">Approve {state.childName} to join High Agency</h1>
        <p className="lead consent__lead">
          {state.childName} signed up for High Agency — a live cohort program where
          ambitious young people (13–18) build real projects together in small,
          mentored squads. Because they&apos;re under 18, we need your approval
          before they can join a squad and take part in the community.
        </p>
        <ul className="consent__list">
          <li>Join a small accountability squad of other young builders.</li>
          <li>Work through real-world milestones — ship a project, get first users.</li>
          <li>Attend live expert workshops. Free for the founding batch.</li>
        </ul>
        <button
          className="btn btn--primary consent__btn"
          onClick={onApprove}
          disabled={busy}
        >
          {busy ? "Approving…" : `Approve ${state.childName}`}
        </button>
        <p className="consent__fine">
          This link is single-use and expires after 14 days. If you didn&apos;t
          expect this, you can safely ignore it — no access is granted without your
          approval.
        </p>
      </div>
    );
  }

  // used / expired / invalid / error → a calm, non-punitive dead-end with a path forward.
  const { title, body } = deadEndCopy(state.status, ("childName" in state && state.childName) || undefined);
  return (
    <div className="tile consent__card">
      <span className="eyebrow">
        <span className="dot" /> Parental consent
      </span>
      <h1 className="h2">{title}</h1>
      <p className="lead">{body}</p>
    </div>
  );
}

function deadEndCopy(
  status: "used" | "expired" | "invalid" | "error",
  childName?: string
): { title: string; body: string } {
  const who = childName ?? "your child";
  switch (status) {
    case "used":
      return {
        title: "This link was already used",
        body: `Consent for ${who} has already been recorded — nothing more to do. If you didn't do this and want to review access, reply to the email or contact info@high-agency.io.`,
      };
    case "expired":
      return {
        title: "This link has expired",
        body: `Consent links are valid for 14 days. Ask ${who} to request a fresh one from their dashboard, or email info@high-agency.io and we'll resend it.`,
      };
    case "error":
      return {
        title: "Something went wrong",
        body: "We couldn't process this link just now. Please try again in a moment, or email info@high-agency.io.",
      };
    default:
      return {
        title: "This link isn't valid",
        body: "We couldn't find a consent request for this link. Double-check you used the full link from the email, or email info@high-agency.io.",
      };
  }
}
