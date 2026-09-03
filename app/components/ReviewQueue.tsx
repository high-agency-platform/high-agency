"use client";

/* Proof, as a row — and the mentor's queue of it.
   - ProofRow: one submission (who, the link, the note). Used under an open
     milestone on the operator page and in the mentor's queue.
   - ReviewQueue: everything waiting on a mentor, grouped by milestone, with
     Approve / Return. A return has to say what to fix. */

import { useState } from "react";
import type { Submission } from "../lib/types";
import { REVIEW_NOTE_MAX } from "../lib/types";
import { reviewProof } from "../lib/api";
import { Avatar } from "./ui";

function fmtWhen(s: Submission): string {
  const d = s.updatedAt?.toDate();
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}

export function ProofRow({
  sub,
  onName,
  children,
}: {
  sub: Submission;
  /** Tap the name to open their card. */
  onName?: (sub: Submission) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="path__queue-row">
      <div className="path__queue-who">
        <Avatar name={sub.name} size="sm" />
        {onName ? (
          <button type="button" className="link-btn" onClick={() => onName(sub)}>
            {sub.name}
          </button>
        ) : (
          sub.name
        )}
        <a href={sub.proofUrl} target="_blank" rel="noreferrer">
          proof
        </a>
        {sub.attempt > 1 && <span className="micro">attempt {sub.attempt}</span>}
        <span className="micro" style={{ marginLeft: "auto" }}>
          {fmtWhen(sub)}
        </span>
      </div>
      {sub.note && <p className="path__queue-note">{sub.note}</p>}
      {children}
    </div>
  );
}

export function ReviewQueue({
  seasonId,
  queue,
  truncated,
  onName,
}: {
  seasonId: string;
  queue: Submission[];
  truncated: boolean;
  onName?: (sub: Submission) => void;
}) {
  const [returning, setReturning] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Grouped by milestone, in the order proof first arrived.
  const groups: { title: string; rows: Submission[] }[] = [];
  for (const s of queue) {
    const g = groups.find((x) => x.title === s.milestoneTitle);
    if (g) g.rows.push(s);
    else groups.push({ title: s.milestoneTitle, rows: [s] });
  }

  async function decide(sub: Submission, decision: "approve" | "return") {
    setBusy(sub.id);
    setError("");
    try {
      await reviewProof({ seasonId, submissionId: sub.id, decision, note: note.trim() });
      setReturning(null);
      setNote("");
    } catch (e) {
      const code = (e as Error).message;
      setError(
        code === "note-required"
          ? "Say what's missing — that's the whole point of a return."
          : code === "not-reviewable"
            ? "Already handled."
            : "Couldn't save that. Try again."
      );
    } finally {
      setBusy(null);
    }
  }

  if (queue.length === 0) return <p className="empty">Nothing waiting on you.</p>;

  return (
    <div className="path">
      {truncated && (
        <p className="micro" style={{ marginBottom: 8 }}>
          Showing the first {queue.length}. Clear these to load more.
        </p>
      )}
      {groups.map((g) => (
        <div key={g.title} className="path__item">
          <span className="path__node">{g.rows.length}</span>
          <div className="path__body">
            <span className="path__name">{g.title}</span>
            <div className="path__queue">
              {g.rows.map((s) => (
                <ProofRow key={s.id} sub={s} onName={onName}>
                  {returning === s.id ? (
                    <div className="path__form">
                      <textarea
                        className="input"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What's missing, specifically?"
                        maxLength={REVIEW_NOTE_MAX}
                        autoFocus
                      />
                      <div className="row-actions" style={{ marginTop: 0 }}>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            setReturning(null);
                            setNote("");
                          }}
                          disabled={busy === s.id}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn--ink btn--sm"
                          disabled={busy === s.id || !note.trim()}
                          onClick={() => decide(s, "return")}
                        >
                          {busy === s.id ? "…" : "Return"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="row-actions" style={{ marginTop: 0 }}>
                      <button
                        type="button"
                        className="btn btn--verify btn--sm"
                        disabled={busy === s.id}
                        onClick={() => decide(s, "approve")}
                      >
                        {busy === s.id ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busy === s.id}
                        onClick={() => {
                          setReturning(s.id);
                          setNote("");
                          setError("");
                        }}
                      >
                        Return
                      </button>
                    </div>
                  )}
                </ProofRow>
              ))}
            </div>
          </div>
        </div>
      ))}
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
