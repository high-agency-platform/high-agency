"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../components/AuthProvider";
import {
  watchCohort,
  watchSubmissions,
  watchBuildLogs,
  watchApplications,
  submitMilestone,
  decideSubmission,
  addBuildLog,
  markRitual,
  decideApplication,
  getProfile,
} from "../../../lib/db";
import { TRACK, squadThreshold } from "../../../lib/milestones";
import { isoWeek } from "../../../lib/gamify";
import { DECLINE_LABELS } from "../../../lib/types";
import { Avatar, AvStack, CheckIcon, FlameIcon } from "../../../components/ui";
import type {
  Cohort,
  CohortApplication,
  MilestoneSubmission,
  BuildLog,
  Profile,
  DeclineReason,
} from "../../../lib/types";

export default function CohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, profile } = useAuth();
  const router = useRouter();

  const [cohort, setCohort] = useState<Cohort | null | undefined>(undefined);
  const [subs, setSubs] = useState<MilestoneSubmission[]>([]);
  const [logs, setLogs] = useState<BuildLog[]>([]);
  const [apps, setApps] = useState<CohortApplication[]>([]);

  // Applicant profile viewer (founder reviewing an application). The
  // application carries the squad-specific weekly hours, so we keep it
  // alongside the public profile while the modal is open.
  const [viewing, setViewing] = useState<Profile | null>(null);
  const [viewingApp, setViewingApp] = useState<CohortApplication | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);

  // Milestone the operator is submitting evidence for
  const [submitFor, setSubmitFor] = useState<number | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [note, setNote] = useState("");

  // Verification: return-with-reason editor (keyed by submission doc key)
  const [returning, setReturning] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");

  // Build log composer
  const [logText, setLogText] = useState("");
  const [busy, setBusy] = useState(false);

  const isMember = !!(user && cohort && cohort.memberUids.includes(user.uid));
  const isFounder = !!(user && cohort && cohort.founderUid === user.uid);
  const isPeerLead = !!(user && cohort && cohort.peerLeadUid === user.uid);
  const isMentor = profile?.role === "mentor";

  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    return watchCohort(id, setCohort);
  }, [user, id]);

  useEffect(() => {
    if (!isMember && !isMentor) return;
    return watchSubmissions(id, setSubs);
  }, [isMember, isMentor, id]);

  useEffect(() => {
    if (!isMember && !isMentor) return;
    return watchBuildLogs(id, setLogs);
  }, [isMember, isMentor, id]);

  useEffect(() => {
    if (!isMember) return;
    return watchApplications(id, setApps);
  }, [isMember, id]);

  const byMilestone = useMemo(() => {
    const map = new Map<number, MilestoneSubmission[]>();
    for (const s of subs) {
      const list = map.get(s.milestoneId) ?? [];
      list.push(s);
      map.set(s.milestoneId, list);
    }
    return map;
  }, [subs]);

  /** The squad's current milestone: first one not yet squad-complete. */
  const currentMilestoneId = useMemo(() => {
    if (!cohort) return 1;
    const threshold = squadThreshold(cohort.memberUids.length);
    for (const m of TRACK) {
      const verified = (byMilestone.get(m.id) ?? []).filter(
        (s) => s.status === "verified"
      ).length;
      if (verified < threshold) return m.id;
    }
    return TRACK.length;
  }, [cohort, byMilestone]);

  const ritualDone = cohort?.lastRitualWeek === isoWeek();

  async function sendSubmission(milestoneId: number) {
    if (!profile || !evidenceUrl.trim()) return;
    setBusy(true);
    try {
      await submitMilestone(id, profile, milestoneId, evidenceUrl.trim(), note.trim());
      setSubmitFor(null);
      setEvidenceUrl("");
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  async function decide(sub: MilestoneSubmission, verdict: "verified" | "returned") {
    if (!profile) return;
    setBusy(true);
    try {
      await decideSubmission(
        id,
        sub,
        profile,
        verdict,
        verdict === "returned" ? returnReason.trim() : null
      );
      setReturning(null);
      setReturnReason("");
    } finally {
      setBusy(false);
    }
  }

  async function postLog() {
    if (!profile || !logText.trim()) return;
    setBusy(true);
    try {
      await addBuildLog(id, profile, logText.trim());
      setLogText("");
    } finally {
      setBusy(false);
    }
  }

  if (!user || cohort === undefined) return null;

  if (cohort === null) {
    return (
      <div className="screen">
        <div className="empty">
          <p>This squad doesn&apos;t exist.</p>
          <Link href="/cohorts" className="btn btn--ghost">
            Back
          </Link>
        </div>
      </div>
    );
  }

  const threshold = squadThreshold(cohort.memberUids.length);
  const consentPending = profile?.consentStatus === "pending";

  return (
    <div className="screen">
      {/* ---- Squad header ---- */}
      <header className="screen__head">
        <div>
          <h1 className="h1">
            {cohort.name}
            {cohort.weeklyStreak > 0 && (
              <span className="hud__stat hud__stat--fire">
                <FlameIcon filled size={14} />
                {cohort.weeklyStreak}w
              </span>
            )}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <AvStack
              names={cohort.memberUids.map(
                (uid) =>
                  (cohort.memberNames[uid] ?? "?") +
                  (uid === cohort.peerLeadUid ? " (lead)" : "")
              )}
            />
            <span className="micro">
              {cohort.meetingSlot || "no slot"}
              {cohort.state === "forming" && " · forming"}
              {cohort.state === "stalled" && " · stalled"}
            </span>
          </div>
        </div>
        {isMember &&
          (ritualDone ? (
            <span className="badge badge--earned">
              <CheckIcon size={11} /> ritual done
            </span>
          ) : (
            <button
              className="btn btn--verify"
              disabled={busy || !profile}
              onClick={() => profile && markRitual(cohort, profile)}
            >
              We met <span className="num">+25</span>
            </button>
          ))}
      </header>

      {!isMember && !isMentor ? (
        <div className="empty">
          <p>You&apos;re not in this squad.</p>
          <Link href="/cohorts" className="btn btn--primary">
            Find squads
          </Link>
        </div>
      ) : (
        <div className="grid2 grid2--wide">
          {/* ---- The quest path ---- */}
          <section className="tile">
            <div className="tile__head">
              <h2 className="h3">The Track</h2>
              <span className="path__count">
                clears at {threshold}/{cohort.memberUids.length}
              </span>
            </div>

            <div className="path">
              {TRACK.map((m) => {
                const mySub = subs.find(
                  (s) => s.milestoneId === m.id && s.uid === user.uid
                );
                const all = byMilestone.get(m.id) ?? [];
                const verified = all.filter((s) => s.status === "verified").length;
                const squadDone = verified >= threshold;
                const isCurrent = m.id === currentMilestoneId;
                const canIVerify =
                  (m.verifier === "peer_lead" && (isPeerLead || isMentor)) ||
                  (m.verifier === "mentor" && isMentor);
                const queue = all.filter((s) => s.status === "submitted");
                const state = squadDone ? "done" : isCurrent ? "active" : "locked";

                return (
                  <div key={m.id} className={`path__item ${state}`}>
                    <span className="path__node">
                      {squadDone ? <CheckIcon size={18} /> : m.id}
                    </span>
                    <div className="path__body">
                      <div className="path__top">
                        <span className="path__name">{m.name}</span>
                        <div className="path__meta">
                          <span className="xp">+{m.xp}</span>
                          <span className="path__count">
                            {verified}/{cohort.memberUids.length}
                          </span>
                        </div>
                      </div>

                      {(isCurrent || mySub) && (
                        <div className="path__detail">
                          <p className="path__evidence">
                            <b>Proof:</b> {m.evidence}{" "}
                            <span className="muted">(~{m.effort})</span>
                          </p>

                          {/* My state on this milestone */}
                          {isMember && (
                            <>
                              {mySub?.status === "verified" && (
                                <span className="path__state path__state--ok pop">
                                  <CheckIcon size={12} /> Verified by {mySub.verifierName}
                                </span>
                              )}
                              {mySub?.status === "submitted" && (
                                <span className="path__state">
                                  In review — {m.verifier === "peer_lead" ? "peer lead" : "mentor"}
                                </span>
                              )}
                              {mySub?.status === "returned" && (
                                <>
                                  <span className="path__state path__state--warn">
                                    Returned: {mySub.returnReason}
                                  </span>
                                  {submitFor !== m.id && (
                                    <button
                                      className="btn btn--ghost btn--sm"
                                      onClick={() => {
                                        setSubmitFor(m.id);
                                        setEvidenceUrl(mySub.evidenceUrl);
                                        setNote(mySub.note);
                                      }}
                                    >
                                      Fix &amp; resend
                                    </button>
                                  )}
                                </>
                              )}
                              {!mySub && isCurrent && submitFor !== m.id && (
                                <button
                                  className="btn btn--primary btn--sm"
                                  disabled={consentPending}
                                  onClick={() => {
                                    setSubmitFor(m.id);
                                    setEvidenceUrl("");
                                    setNote("");
                                  }}
                                >
                                  Submit proof
                                </button>
                              )}
                              {submitFor === m.id && (
                                <div className="path__form">
                                  <input
                                    className="input"
                                    autoFocus
                                    value={evidenceUrl}
                                    onChange={(e) => setEvidenceUrl(e.target.value)}
                                    placeholder="Link your proof"
                                    maxLength={500}
                                  />
                                  <textarea
                                    className="input"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="What should they look at?"
                                    maxLength={500}
                                  />
                                  <div className="row-actions" style={{ marginTop: 0 }}>
                                    <button
                                      className="btn btn--ghost btn--sm"
                                      onClick={() => setSubmitFor(null)}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      className="btn btn--primary btn--sm"
                                      disabled={busy || !evidenceUrl.trim()}
                                      onClick={() => sendSubmission(m.id)}
                                    >
                                      {busy ? "…" : "Send"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* Verification queue for whoever can verify */}
                          {canIVerify && queue.length > 0 && (
                            <div className="path__queue">
                              {queue.map((s) => {
                                const key = `${s.milestoneId}_${s.uid}`;
                                return (
                                  <div key={key} className="path__queue-row">
                                    <div className="path__queue-who">
                                      <Avatar name={s.name} size="sm" />
                                      {s.name}
                                      <a href={s.evidenceUrl} target="_blank" rel="noreferrer">
                                        proof
                                      </a>
                                    </div>
                                    {s.note && <p className="path__queue-note">{s.note}</p>}
                                    {returning === key ? (
                                      <div className="path__form">
                                        <input
                                          className="input"
                                          autoFocus
                                          value={returnReason}
                                          onChange={(e) => setReturnReason(e.target.value)}
                                          placeholder="What's missing, specifically?"
                                          maxLength={300}
                                        />
                                        <div className="row-actions" style={{ marginTop: 0 }}>
                                          <button
                                            className="btn btn--ghost btn--sm"
                                            onClick={() => setReturning(null)}
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            className="btn btn--ink btn--sm"
                                            disabled={busy || !returnReason.trim()}
                                            onClick={() => decide(s, "returned")}
                                          >
                                            Return
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="row-actions" style={{ marginTop: 0 }}>
                                        <button
                                          className="btn btn--verify btn--sm"
                                          disabled={busy}
                                          onClick={() => decide(s, "verified")}
                                        >
                                          Verify <span className="num">+{m.xp}</span>
                                        </button>
                                        <button
                                          className="btn btn--ghost btn--sm"
                                          onClick={() => {
                                            setReturning(key);
                                            setReturnReason("");
                                          }}
                                        >
                                          Return
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="stack">
            {/* ---- Build log ---- */}
            <section className="tile">
              <div className="tile__head">
                <h2 className="h3">Build log</h2>
                <span className="xp">+10/day</span>
              </div>
              {isMember && (
                <div className="composer">
                  <input
                    className="input"
                    value={logText}
                    onChange={(e) => setLogText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !busy && logText.trim() && postLog()}
                    placeholder="One line. What shipped?"
                    maxLength={300}
                    disabled={consentPending}
                  />
                  <button
                    className="btn btn--primary"
                    disabled={busy || !logText.trim() || consentPending}
                    onClick={postLog}
                  >
                    Ship
                  </button>
                </div>
              )}
              {logs.length === 0 ? (
                <p className="empty" style={{ marginTop: 12 }}>
                  Quiet so far.
                </p>
              ) : (
                <div className="feed">
                  {logs.map((l) => (
                    <div key={l.id} className="feed__row">
                      <Avatar name={l.name} size="sm" />
                      <div className="feed__body">
                        <b>{l.name}</b> <span className="feed__day">{l.day}</span>
                        <p>{l.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ---- Applications ---- */}
            {isMember && apps.length > 0 && (
              <section className="tile tile--ember">
                <div className="tile__head">
                  <h2 className="h3">Wants in</h2>
                  <span className="badge badge--level">{apps.length}</span>
                </div>
                <div className="stack" style={{ gap: 14 }}>
                  {apps.map((a) => (
                    <div key={a.applicantUid}>
                      <div className="path__queue-who">
                        <Avatar name={a.applicantName} size="sm" />
                        <button
                          className="link-btn"
                          onClick={() => {
                            setViewingApp(a);
                            getProfile(a.applicantUid).then(setViewing).catch(() => {});
                          }}
                        >
                          {a.applicantName}
                        </button>
                        <span className="micro">{a.hours}h/wk</span>
                      </div>
                      {a.pitch && <p className="path__queue-note">{a.pitch}</p>}
                      {isFounder &&
                        (declining === a.applicantUid ? (
                          <div className="chip-row" style={{ marginTop: 8 }}>
                            {(Object.keys(DECLINE_LABELS) as DeclineReason[]).map((r) => (
                              <button
                                key={r}
                                className="pick"
                                onClick={() => {
                                  decideApplication(cohort, a, false, r);
                                  setDeclining(null);
                                }}
                              >
                                {DECLINE_LABELS[r]}
                              </button>
                            ))}
                            <button className="pick" onClick={() => setDeclining(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="row-actions" style={{ marginTop: 8 }}>
                            <button
                              className="btn btn--verify btn--sm"
                              disabled={cohort.memberUids.length >= 8}
                              onClick={() => decideApplication(cohort, a, true)}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => setDeclining(a.applicantUid)}
                            >
                              Decline
                            </button>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* ---- Applicant profile viewer ---- */}
      {viewing && (
        <div className="modal open" role="dialog" aria-modal="true">
          <div
            className="modal__scrim"
            onClick={() => {
              setViewing(null);
              setViewingApp(null);
            }}
          />
          <div className="modal__card">
            <button
              className="modal__close"
              onClick={() => {
                setViewing(null);
                setViewingApp(null);
              }}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <Avatar name={viewing.name} size="lg" />
              <div>
                <h3 style={{ marginBottom: 0 }}>{viewing.name}</h3>
                <span className="micro">
                  {viewing.ageBand} · {viewing.country}
                  {viewingApp ? ` · ${viewingApp.hours}h/wk` : ""} · {viewing.stage}
                </span>
              </div>
            </div>
            {viewing.headline && (
              <p style={{ fontWeight: 700, marginBottom: 14 }}>{viewing.headline}</p>
            )}
            {viewing.building && (
              <div className="field">
                <label>Building</label>
                <p className="muted" style={{ fontSize: 15 }}>{viewing.building}</p>
              </div>
            )}
            {viewing.proofUrl && (
              <div className="field">
                <label>Proof</label>
                <p style={{ fontSize: 15 }}>
                  <a href={viewing.proofUrl} target="_blank" rel="noreferrer" className="link-btn">
                    {viewing.proofUrl}
                  </a>
                  {viewing.proofNote && <span className="muted"> — {viewing.proofNote}</span>}
                </p>
              </div>
            )}
            <div className="field">
              <label>Into</label>
              <div className="chip-row">
                {viewing.skills.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            {viewing.bio && (
              <div className="field">
                <label>Bio</label>
                <p className="muted" style={{ fontSize: 15 }}>{viewing.bio}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
