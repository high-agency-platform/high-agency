"use client";

/* The season track, as the operator walks it: the `.path` spine as an
   accordion — one milestone open at a time, the one you're on open by
   default. Each open row carries the mentor's why, the proof spec, the
   submit form, your own status, and (for open-verifier steps) everyone
   else's proof. Nothing is gated: any step can be submitted in any order. */

import { useState } from "react";
import type { Profile, Season, SeasonMilestone, Submission } from "../lib/types";
import { byMilestone, nextMilestone, SUBMISSION_URL_MAX, SUBMISSION_NOTE_MAX } from "../lib/types";
import { submitProof } from "../lib/api";
import { CheckIcon } from "./ui";
import { ProofRow } from "./ReviewQueue";

const ERRORS: Record<string, string> = {
  "proof-required": "Paste a link that starts with http.",
  "consent-pending": "Waiting on your parent's OK first.",
  "already-approved": "This one's already approved.",
  "season-closed": "This season is closed.",
  "unknown-milestone": "That step just changed — reload.",
};

export function SeasonPath({
  season,
  mine,
  wall,
  profile,
  consentPending,
}: {
  season: Season;
  /** My own rows, every verifier kind. */
  mine: Submission[];
  /** Everyone's open-verifier rows. */
  wall: Submission[];
  profile: Profile;
  consentPending: boolean;
}) {
  const next = nextMilestone(season, mine);
  // undefined = follow the live "next" milestone; a tap forks a local choice.
  // Resetting to undefined after an approval is what auto-opens the next step.
  const [openEdit, setOpenEdit] = useState<string | null | undefined>(undefined);
  const openId = openEdit === undefined ? (next?.id ?? null) : openEdit;

  const [formFor, setFormFor] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [popId, setPopId] = useState<string | null>(null);

  const subs = byMilestone(mine);

  function toggle(id: string) {
    setOpenEdit(openId === id ? null : id);
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

  if (season.milestones.length === 0) {
    return <p className="empty">The track lands soon.</p>;
  }

  return (
    <div className="path">
      {season.milestones.map((m, i) => {
        const sub = subs[m.id];
        const done = sub?.status === "approved";
        const isOpen = openId === m.id;
        const state = done ? "done" : isOpen ? "active" : "locked";
        const peers = m.verifier === "open" ? wall.filter((s) => s.milestoneId === m.id && s.uid !== profile.uid) : [];
        const collapsed = done
          ? "approved"
          : sub?.status === "submitted"
            ? "in review"
            : sub?.status === "returned"
              ? "sent back"
              : m.effort;

        return (
          <div key={m.id} className={`path__item ${state}${popId === m.id ? " pop" : ""}`}>
            <span className="path__node">{done ? <CheckIcon size={18} /> : i + 1}</span>
            <div className="path__body">
              <button
                type="button"
                className="path__toggle"
                onClick={() => toggle(m.id)}
                aria-expanded={isOpen}
              >
                <div className="path__top">
                  <span className="path__name">{m.title}</span>
                  <div className="path__meta">
                    <span
                      className={`path__count${sub?.status === "returned" && !done ? " path__state--warn" : ""}`}
                    >
                      {collapsed}
                    </span>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="path__detail">
                  {m.why && <p className="path__evidence">{m.why}</p>}
                  {m.proof && (
                    <p className="path__evidence">
                      <b>Proof:</b> {m.proof}
                      {m.effort && <span className="muted"> (~{m.effort})</span>}
                    </p>
                  )}
                  <div className="chip-row">
                    <span className="chip chip--mute">
                      {m.verifier === "mentor" ? "mentor reviews" : "open — everyone sees it"}
                    </span>
                    {m.sessions.map((s) => (
                      <span key={s} className="chip chip--want">
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* ---- your own state ---- */}
                  {done && sub && (
                    <div className="path__meta">
                      <span className="path__state path__state--ok">
                        <CheckIcon size={12} />{" "}
                        {m.verifier === "mentor" && sub.reviewedByName
                          ? `Approved by ${sub.reviewedByName}`
                          : "Posted"}
                      </span>
                      <a href={sub.proofUrl} target="_blank" rel="noreferrer" className="link-btn">
                        your proof
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
                      <span className="path__state">In review</span>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => startForm(m, sub)}>
                        Edit
                      </button>
                    </div>
                  )}
                  {!done && sub?.status === "returned" && formFor !== m.id && (
                    <div className="path__meta">
                      <span className="path__state path__state--warn">Sent back — {sub.reviewNote}</span>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={consentPending}
                        onClick={() => startForm(m, sub)}
                      >
                        Fix &amp; resend
                      </button>
                    </div>
                  )}
                  {!done && !sub && formFor !== m.id && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={consentPending}
                      onClick={() => startForm(m)}
                    >
                      Post proof
                    </button>
                  )}

                  {formFor === m.id && (
                    <div className="path__form">
                      <input
                        className="input"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Link your proof"
                        maxLength={SUBMISSION_URL_MAX}
                        autoFocus
                      />
                      <textarea
                        className="input"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What should we look at?"
                        maxLength={SUBMISSION_NOTE_MAX}
                      />
                      {err && <p className="form-err">{err}</p>}
                      <div className="row-actions" style={{ marginTop: 0 }}>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFormFor(null)} disabled={busy}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          disabled={busy || !url.trim() || consentPending}
                          onClick={() => send(m)}
                        >
                          {busy ? "…" : "Post it"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ---- everyone else's proof (open steps only) ---- */}
                  {peers.length > 0 && (
                    <details className="more" style={{ width: "100%" }}>
                      <summary className="more__toggle">
                        {peers.length} posted
                        <span className="more__hint">see</span>
                      </summary>
                      <div className="more__body path__queue" style={{ borderTop: 0, paddingTop: 4 }}>
                        {peers.map((s) => (
                          <ProofRow key={s.id} sub={s} />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
