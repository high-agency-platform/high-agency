"use client";

/* Any released milestone can be opened; the next unfinished one opens by default. */

import { useState } from "react";
import type { Season, SeasonMilestone, Submission } from "../lib/types";
import { byMilestone, nextMilestone, SUBMISSION_URL_MAX, SUBMISSION_NOTE_MAX } from "../lib/types";
import { SLACK_URL, WELCOME_MILESTONE } from "../lib/program";
import { submitProof } from "../lib/api";
import { CheckIcon, LockIcon } from "./ui";
import { MemberButton } from "./MemberButton";

const ERRORS: Record<string, string> = {
  "milestone-locked": "Your mentor hasn’t released this milestone yet.",
  "proof-required": "Paste a link that starts with http.",
  "already-approved": "This one's already approved.",
  "season-closed": "This season is closed.",
  "unknown-milestone": "That step just changed — reload.",
};

export function SeasonPath({
  season,
  mine,
}: {
  season: Season;
  /** My own rows, every verifier kind. */
  mine: Submission[];
}) {
  const next = nextMilestone(season, mine);
  // undefined = follow the live "next" milestone; a tap forks a local choice.
  // Resetting to undefined after an approval is what auto-opens the next step.
  const [openEdit, setOpenEdit] = useState<string | undefined>(undefined);
  const openId = season.milestones.some((m) => m.id === openEdit) ? openEdit : (next?.id ?? null);

  const [formFor, setFormFor] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [popId, setPopId] = useState<string | null>(null);

  const subs = byMilestone(mine);

  function toggle(id: string) {
    setOpenEdit(id);
    setFormFor(null);
    setErr("");
  }

  function startForm(m: SeasonMilestone, from?: Submission) {
    setFormFor(m.id);
    setUrl(from?.proofUrl ?? "");
    setNote(from?.note ?? "");
    setErr("");
  }

  async function send(m: SeasonMilestone) {
    setBusy(true);
    setErr("");
    try {
      const r = await submitProof({
        seasonId: season.id,
        milestoneId: m.id,
        proofUrl: url.trim(),
        note: note.trim(),
      });
      setFormFor(null);
      setUrl("");
      setNote("");
      if (r.status === "approved") {
        setPopId(m.id);
        setOpenEdit(undefined);
      }
    } catch (e) {
      setErr(ERRORS[(e as Error).message] ?? "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const steps = season.milestonePreviews ?? season.milestones.map((m) => ({ ...m, released: true }));

  if (steps.length === 0) {
    return <p className="empty">Your mentor will release the first milestone soon.</p>;
  }

  return (
    <div className="path">
      <nav className="milestone-nav" aria-label="Milestones">
        {steps.map((m, i) => {
          const status = subs[m.id]?.status;
          const label = !m.released ? "Locked" : status === "approved" ? "Complete" : status === "submitted" ? "In review" : status === "returned" ? "Needs revision" : "Not submitted";
          return <button key={m.id} type="button" className={`milestone-nav__step ${!m.released ? "is-locked" : ""} ${status === "approved" ? "is-complete" : ""}`} aria-pressed={openId === m.id} aria-label={`${m.title} — ${label}`} disabled={busy || !m.released} title={!m.released ? "Your mentor will unlock this step" : undefined} onClick={() => toggle(m.id)}>
            <span className="milestone-nav__number" aria-hidden="true">{!m.released ? <LockIcon size={14} /> : status === "approved" ? <CheckIcon size={14} /> : String(i + 1).padStart(2, "0")}</span>
            <span>{m.title}</span>
          </button>;
        })}
      </nav>
      {!openId && <div className="milestone-complete"><CheckIcon size={22} /><h3>{season.hasUpcoming ? "You’re up to date" : "Track complete"}</h3><p>{season.hasUpcoming ? "Your mentor will release the next milestone." : "Revisit any milestone above."}</p></div>}
      {season.milestones.filter((m) => m.id === openId).map((m) => {
        const sub = subs[m.id];
        const done = sub?.status === "approved";
        return (
          <section key={m.id} className={`milestone-focus${popId === m.id ? " pop" : ""}`} aria-label={m.title}>
            <header className="milestone-focus__head">
              <h3>{m.title}</h3>
              {sub && <span className={`path__state ${done ? "path__state--ok" : sub.status === "returned" ? "path__state--warn" : ""}`}>{done ? "Complete" : sub.status === "submitted" ? "In review" : "Needs revision"}</span>}
            </header>
            <div className="path__detail">
              {m.proof && (
                <div className="path__requirement">
                  <span className="micro">To complete</span>
                  <p>{m.proof}</p>
                  {m.id === WELCOME_MILESTONE.id && <a className="link-btn" href={SLACK_URL} target="_blank" rel="noreferrer">Introduce yourself in Slack ↗</a>}
                </div>
              )}

              {/* ---- your own state ---- */}
              {done && sub && (
                <div className="path__meta">
                  {m.verifier === "mentor" && sub.reviewedByName && (
                    <span className="path__state path__state--ok">Reviewed by <MemberButton uid={sub.reviewedByUid} name={sub.reviewedByName} /></span>
                  )}
                  <a href={sub.proofUrl} target="_blank" rel="noreferrer" className="link-btn">
                    View proof
                  </a>
                  {m.verifier === "open" && formFor !== m.id && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => startForm(m, sub)}>
                      Update
                    </button>
                  )}
                </div>
              )}
              {!done && sub?.status === "submitted" && formFor !== m.id && (
                <div className="path__meta">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => startForm(m, sub)}>
                    Edit
                  </button>
                </div>
              )}
              {!done && sub?.status === "returned" && formFor !== m.id && (
                <div className="path__meta">
                  <span className="path__state path__state--warn">{sub.reviewNote}</span>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => startForm(m, sub)}
                  >
                    Revise proof
                  </button>
                </div>
              )}
              {!done && !sub && formFor !== m.id && (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => startForm(m)}
                >
                  Post proof
                </button>
              )}

              {formFor === m.id && (
                <div className="path__form">
                  <p className="path__visibility">
                    Visible only to you and mentors.
                  </p>
                  <input
                    className="input"
                    aria-label="Proof link"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Link your proof"
                    maxLength={SUBMISSION_URL_MAX}
                    autoFocus
                  />
                  <textarea
                    className="input"
                    aria-label="Proof note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What should we look at?"
                    maxLength={SUBMISSION_NOTE_MAX}
                  />
                  {err && <p className="form-err" role="alert">{err}</p>}
                  <div className="row-actions" style={{ marginTop: 0 }}>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFormFor(null)} disabled={busy}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={busy || !url.trim()}
                      onClick={() => send(m)}
                    >
                      {busy ? "Posting…" : "Post proof"}
                    </button>
                  </div>
                </div>
              )}

              {(m.why || m.sessions.length > 0) && (
                <details className="more path__brief">
                  <summary className="more__toggle">Read the brief</summary>
                  <div className="more__body">
                    {m.why && <p>{m.why}</p>}
                    {m.sessions.length > 0 && (
                      <div className="path__guidance">
                        <b>Related guidance</b>
                        <ul>{m.sessions.map((s) => <li key={s}>{s}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
