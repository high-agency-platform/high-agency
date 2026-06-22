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
      <div className="page">
        <p className="dash__empty">This squad doesn&apos;t exist.</p>
        <Link href="/cohorts" className="btn btn--ghost">
          Back to cohorts
        </Link>
      </div>
    );
  }

  const threshold = squadThreshold(cohort.memberUids.length);
  const consentPending = profile?.consentStatus === "pending";

  return (
    <div className="page">
      <section className="dash__section cohort-head">
        <div>
          <span className="eyebrow">
            <span className="dot" /> Squad workspace
            {cohort.state === "forming" && " · forming"}
            {cohort.state === "stalled" && " · stalled"}
          </span>
          <h1 className="h2">{cohort.name}</h1>
          <p className="lead">{cohort.mission}</p>
          <p className="cohort-head__slot">
            Meets {cohort.meetingSlot || "TBD"}
            {cohort.weeklyStreak > 0 &&
              ` · ${cohort.weeklyStreak}-week squad streak`}
          </p>
        </div>
        <div className="cohort-head__members">
          <span className="kicker">Squad</span>
          <div className="chip-row">
            {cohort.memberUids.map((uid) => (
              <span
                key={uid}
                className={`chip ${uid === cohort.peerLeadUid ? "chip--on" : ""}`}
              >
                {cohort.memberNames[uid] ?? "Operator"}
                {uid === cohort.peerLeadUid ? " · lead" : ""}
              </span>
            ))}
          </div>
          {isMember && (
            <button
              className={`btn ${ritualDone ? "btn--ghost" : "btn--primary"} cohort-head__ritual`}
              disabled={ritualDone || busy || !profile}
              onClick={() => profile && markRitual(cohort, profile)}
            >
              {ritualDone ? "Ritual held this week ✓" : "We held our weekly ritual"}
            </button>
          )}
        </div>
      </section>

      {!isMember && !isMentor ? (
        <section className="dash__section">
          <p className="dash__empty">
            You&apos;re not in this squad. Apply from the{" "}
            <Link href="/cohorts" className="accent">
              cohort list
            </Link>
            .
          </p>
        </section>
      ) : (
        <div className="cohort-grid2">
          {/* ---- The Ignition Track ---- */}
          <section className="panel">
            <div className="panel__head">
              <h2 className="h3">Ignition Track</h2>
              <span className="kicker">
                squad completes at {threshold}/{cohort.memberUids.length} verified
              </span>
            </div>

            <div className="track">
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

                return (
                  <div
                    key={m.id}
                    className={`track__item ${squadDone ? "done" : isCurrent ? "active" : ""}`}
                  >
                    <div className="track__rail">
                      <span className="track__dot">
                        {squadDone ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          m.id
                        )}
                      </span>
                    </div>
                    <div className="track__body">
                      <div className="track__top">
                        <b>{m.name}</b>
                        <span className="track__meta">
                          {m.week} · {m.xp} XP ·{" "}
                          {m.verifier === "peer_lead" ? "peer-lead verifies" : "mentor verifies"}
                        </span>
                      </div>
                      <p className="track__why">{m.why}</p>

                      {(isCurrent || mySub) && (
                        <p className="track__evidence">
                          <b>Evidence:</b> {m.evidence}{" "}
                          <span className="track__effort">(~{m.effort})</span>
                        </p>
                      )}

                      <div className="track__squad">
                        {verified}/{cohort.memberUids.length} verified
                        {all.filter((s) => s.status === "submitted").length > 0 &&
                          ` · ${all.filter((s) => s.status === "submitted").length} awaiting review`}
                      </div>

                      {/* My state on this milestone */}
                      {isMember && (
                        <>
                          {mySub?.status === "verified" && (
                            <span className="track__mine track__mine--ok">
                              Verified by {mySub.verifierName} · +{m.xp} XP — share your proof card
                            </span>
                          )}
                          {mySub?.status === "submitted" && (
                            <span className="track__mine">
                              Submitted — awaiting {m.verifier === "peer_lead" ? "peer-lead" : "mentor"} review (48h SLA)
                            </span>
                          )}
                          {mySub?.status === "returned" && (
                            <div className="track__returned">
                              <span>
                                Returned — not rejected: <i>{mySub.returnReason}</i>
                              </span>
                              {submitFor !== m.id && (
                                <button
                                  className="btn btn--ghost track__btn"
                                  onClick={() => {
                                    setSubmitFor(m.id);
                                    setEvidenceUrl(mySub.evidenceUrl);
                                    setNote(mySub.note);
                                  }}
                                >
                                  Resubmit
                                </button>
                              )}
                            </div>
                          )}
                          {!mySub && isCurrent && submitFor !== m.id && (
                            <button
                              className="btn btn--primary track__btn"
                              disabled={consentPending}
                              onClick={() => {
                                setSubmitFor(m.id);
                                setEvidenceUrl("");
                                setNote("");
                              }}
                            >
                              Submit evidence
                            </button>
                          )}
                          {submitFor === m.id && (
                            <div className="track__form">
                              <input
                                autoFocus
                                value={evidenceUrl}
                                onChange={(e) => setEvidenceUrl(e.target.value)}
                                placeholder="Link to your evidence (doc, screenshots, live URL)"
                                maxLength={500}
                              />
                              <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="What should the verifier look at?"
                                maxLength={500}
                              />
                              <div className="row-actions">
                                <button className="btn btn--ghost" onClick={() => setSubmitFor(null)}>
                                  Cancel
                                </button>
                                <button
                                  className="btn btn--primary"
                                  disabled={busy || !evidenceUrl.trim()}
                                  onClick={() => sendSubmission(m.id)}
                                >
                                  {busy ? "Sending…" : "Submit for verification"}
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Verification queue for whoever can verify */}
                      {canIVerify && queue.length > 0 && (
                        <div className="track__queue">
                          {queue.map((s) => {
                            const key = `${s.milestoneId}_${s.uid}`;
                            return (
                              <div key={key} className="track__queue-row">
                                <div className="track__queue-body">
                                  <b>{s.name}</b>
                                  <a href={s.evidenceUrl} target="_blank" rel="noreferrer" className="accent">
                                    evidence
                                  </a>
                                  {s.note && <p>{s.note}</p>}
                                </div>
                                {returning === key ? (
                                  <div className="track__form">
                                    <input
                                      autoFocus
                                      value={returnReason}
                                      onChange={(e) => setReturnReason(e.target.value)}
                                      placeholder="What's missing, specifically?"
                                      maxLength={300}
                                    />
                                    <div className="row-actions">
                                      <button className="btn btn--ghost" onClick={() => setReturning(null)}>
                                        Cancel
                                      </button>
                                      <button
                                        className="btn btn--primary"
                                        disabled={busy || !returnReason.trim()}
                                        onClick={() => decide(s, "returned")}
                                      >
                                        Return with reason
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="row-actions">
                                    <button
                                      className="btn btn--primary track__btn"
                                      disabled={busy}
                                      onClick={() => decide(s, "verified")}
                                    >
                                      Verify · +{m.xp} XP
                                    </button>
                                    <button
                                      className="btn btn--ghost track__btn"
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
                  </div>
                );
              })}
            </div>
          </section>

          <div className="cohort-side">
            {/* ---- Build log ---- */}
            <section className="panel">
              <div className="panel__head">
                <h2 className="h3">Build log</h2>
                <span className="kicker">+10 XP · keeps your streak alive</span>
              </div>
              {isMember && (
                <div className="log-composer">
                  <textarea
                    value={logText}
                    onChange={(e) => setLogText(e.target.value)}
                    placeholder="What did you do today? One line counts."
                    maxLength={300}
                    disabled={consentPending}
                  />
                  <button
                    className="btn btn--primary"
                    disabled={busy || !logText.trim() || consentPending}
                    onClick={postLog}
                  >
                    Post
                  </button>
                </div>
              )}
              {logs.length === 0 ? (
                <p className="dash__empty">
                  Nothing yet. The squad&apos;s pulse shows up here.
                </p>
              ) : (
                <div className="log-feed">
                  {logs.map((l) => (
                    <div key={l.id} className="log-row">
                      <span className="side__av" aria-hidden="true">
                        {l.name.slice(0, 1)}
                      </span>
                      <div>
                        <b>{l.name}</b>
                        <span className="log-row__day"> · {l.day}</span>
                        <p>{l.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ---- Applications ---- */}
            {isMember && apps.length > 0 && (
              <section className="panel">
                <div className="panel__head">
                  <h2 className="h3">Applications</h2>
                  <span className="kicker">{apps.length} pending</span>
                </div>
                <div className="app-list">
                  {apps.map((a) => (
                    <div key={a.applicantUid} className="app-row">
                      <div className="app-row__body">
                        <button
                          className="app-row__name"
                          onClick={() => {
                            setViewingApp(a);
                            getProfile(a.applicantUid).then(setViewing).catch(() => {});
                          }}
                        >
                          {a.applicantName}
                        </button>
                        <span className="app-row__hours kicker">
                          {a.hours} hrs/week
                        </span>
                        {a.pitch && <p className="app-row__pitch">{a.pitch}</p>}
                      </div>
                      {isFounder &&
                        (declining === a.applicantUid ? (
                          <div className="chip-row">
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
                          <div className="app-row__actions">
                            <button
                              className="btn btn--primary app-row__btn"
                              disabled={cohort.memberUids.length >= 8}
                              onClick={() => decideApplication(cohort, a, true)}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn--ghost app-row__btn"
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
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <h3>{viewing.name}</h3>
            <p className="modal__sub">
              {viewing.ageBand} · {viewing.country}
              {viewingApp ? ` · ${viewingApp.hours} hrs/week` : ""} ·{" "}
              {viewing.stage}
            </p>
            {viewing.headline && <p className="profile-view__headline">{viewing.headline}</p>}
            <div className="field">
              <label>Building</label>
              <p className="profile-view__text">{viewing.building}</p>
            </div>
            {viewing.proofUrl && (
              <div className="field">
                <label>Proof of work</label>
                <p className="profile-view__text">
                  <a href={viewing.proofUrl} target="_blank" rel="noreferrer" className="accent">
                    {viewing.proofUrl}
                  </a>
                  {viewing.proofNote && <> — {viewing.proofNote}</>}
                </p>
              </div>
            )}
            <div className="field">
              <label>Interests</label>
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
                <p className="profile-view__text">{viewing.bio}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
