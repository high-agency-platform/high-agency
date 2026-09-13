"use client";

/* Mentor home: the work waiting on you. Proof to review is the daily job and
   sits first; then who's waiting on a parent, what you're running, and where
   everyone is on the track. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useMentorGate,
  useLiveSeason,
  useReviewQueue,
  useRoster,
  useConsentQueue,
} from "../../components/mentorData";
import { watchMyUpcomingWorkshops, grantConsent, requestConsentEmail } from "../../lib/db";
import { createWorkshop } from "../../lib/api";
import { workshopSpots, seasonProgress } from "../../lib/types";
import type { Profile, Submission, Workshop } from "../../lib/types";
import { Avatar, Bar, PlusIcon } from "../../components/ui";
import { CalendarConnect, useCalendarStatus } from "../../components/CalendarConnect";
import { WorkshopForm, blankDraft, draftToWire, type Draft } from "../../components/WorkshopForm";
import { ReviewQueue } from "../../components/ReviewQueue";
import { ProfileModal } from "../../components/ProfileModal";

function fmtWhen(d: Date): string {
  return (
    d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

function fmtSent(ts: { toDate: () => Date }): string {
  return ts.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MentorHomePage() {
  const { user, profile } = useMentorGate();
  const uid = user?.uid ?? null;

  const { season, loading: seasonLoading } = useLiveSeason(!!uid);
  const seasonId = season?.id ?? null;
  const { queue, truncated } = useReviewQueue(seasonId);
  const { operators, submissions } = useRoster(seasonId);
  const { pending, truncated: moreConsent } = useConsentQueue(!!uid);
  const { status: calendar } = useCalendarStatus();

  const [sessions, setSessions] = useState<Workshop[]>([]);
  const [viewing, setViewing] = useState<Profile | null>(null);
  const [resendState, setResendState] = useState<Record<string, string>>({});

  // The new-session composer, right here on the home screen.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) return;
    return watchMyUpcomingWorkshops(uid, setSessions);
  }, [uid]);

  const upcoming = useMemo(
    () => [...sessions].sort((a, b) => a.startsAt.toMillis() - b.startsAt.toMillis()).slice(0, 6),
    [sessions]
  );

  /** Every operator with their progress, A–Z. */
  const roster = useMemo(() => {
    if (!operators) return null;
    const byUid: Record<string, Submission[]> = {};
    for (const s of submissions) (byUid[s.uid] ??= []).push(s);
    return operators.map((p) => ({
      profile: p,
      progress: seasonProgress(season, byUid[p.uid] ?? []),
      waiting: (byUid[p.uid] ?? []).filter((s) => s.status === "submitted").length,
    }));
  }, [operators, submissions, season]);

  async function schedule() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const { calendar: linked } = await createWorkshop(draftToWire(draft));
      setDraft(null);
      setFlash(linked === "linked" ? "Scheduled. It's on your Google Calendar with a Meet room." : "Scheduled.");
      setTimeout(() => setFlash(""), 4000);
    } catch {
      setError("Couldn't schedule that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConsent(targetUid: string) {
    setResendState((s) => ({ ...s, [targetUid]: "Sending…" }));
    const r = await requestConsentEmail(targetUid).catch(() => ({ ok: false, error: "network" }));
    setResendState((s) => ({
      ...s,
      [targetUid]: r.ok ? "Email sent just now" : r.error === "rate-limited" ? "Sent recently — wait a minute" : "Couldn't send",
    }));
  }

  if (!user || !profile) return null;

  const first = profile.name.split(" ")[0];
  const onName = (sub: Submission) => {
    const p = operators?.find((o) => o.uid === sub.uid);
    if (p) setViewing(p);
  };

  /** The job, as counts. Zero-count queues aren't shown. */
  const counts = [
    { n: queue?.length ?? 0, label: (queue?.length ?? 0) === 1 ? "proof to review" : "proofs to review", href: "#review" },
    { n: pending?.length ?? 0, label: "waiting on a parent", href: "#consent" },
  ].filter((q) => q.n > 0);

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="h1">Hey, {first}.</h1>
        {!draft && (
          <button className="btn btn--primary" onClick={() => setDraft(blankDraft())}>
            <PlusIcon /> New workshop
          </button>
        )}
      </header>

      {draft && (
        <WorkshopForm
          draft={draft}
          setDraft={setDraft}
          taken={0}
          onSave={schedule}
          onCancel={() => setDraft(null)}
          busy={busy}
          title="New workshop"
          calendarLinked={!!calendar?.connected}
        />
      )}
      {error && <p className="form-err">{error}</p>}
      {flash && <p className="micro signal screen__block">{flash}</p>}

      <section className="screen__block">
        <CalendarConnect returnTo="/mentor" compact />
      </section>

      {!seasonLoading && !season && (
        <section className="tile tile--ember screen__block" style={{ alignItems: "flex-start" }}>
          <h2 className="h3">No season is live.</h2>
          <p className="muted" style={{ margin: "6px 0 12px" }}>Operators see an empty page until one is.</p>
          <Link href="/mentor/track" className="btn btn--primary">
            Write the track
          </Link>
        </section>
      )}

      <section className="screen__block">
        <div className="screen__label">
          <span className="micro">Needs you</span>
        </div>
        {counts.length === 0 ? (
          <p className="empty">Nothing waiting on you.</p>
        ) : (
          <div className="mq">
            {counts.map((q) => (
              <a key={q.label} href={q.href} className="tile tile--tap mq__item">
                <b className="mq__n">{q.n}</b>
                <span className="mq__label">{q.label}</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* ---- Proof to review ---- */}
      <section className="tile screen__block" id="review">
        <div className="tile__head">
          <h2 className="h3">Review</h2>
          <span className="micro">{queue ? `${queue.length} waiting` : "…"}</span>
        </div>
        {!seasonId ? (
          <p className="empty">Nothing to review without a live season.</p>
        ) : queue === null ? (
          <p className="empty">Loading…</p>
        ) : (
          <ReviewQueue seasonId={seasonId} queue={queue} truncated={truncated} onName={onName} />
        )}
      </section>

      <div className="grid2 grid2--wide">
        {/* ---- Where everyone is ---- */}
        <section className="tile">
          <div className="tile__head">
            <h2 className="h3">Operators</h2>
            <span className="micro">{roster ? `${roster.length}` : "…"}</span>
          </div>
          {roster === null ? (
            <p className="empty">Loading…</p>
          ) : roster.length === 0 ? (
            <p className="empty">Nobody has joined yet.</p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {roster.map(({ profile: p, progress, waiting }) => (
                <button key={p.uid} type="button" className="mrow" onClick={(e) => { e.currentTarget.focus(); setViewing(p); }} style={{ width: "100%", textAlign: "left", background: "none", border: 0 }}>
                  <span className="mrow__name" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    {waiting > 0 && <span className="chip chip--on">{waiting} in review</span>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ width: 90 }}>
                      <Bar value={progress.total ? progress.done / progress.total : 0} xs />
                    </span>
                    <span className="micro">
                      {progress.done}/{progress.total}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="stack">
          {/* ---- What you're running ---- */}
          <section className="tile">
            <div className="tile__head">
              <h2 className="h3">You&apos;re on</h2>
              <Link href="/mentor/workshops" className="screen__more">
                Calendar
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="empty">Nothing booked. Schedule a workshop above.</p>
            ) : (
              <div>
                {upcoming.map((w) => {
                  const when = w.startsAt.toDate();
                  const seats = workshopSpots(w);
                  return (
                    <div key={w.id} className="ses">
                      <div className="ses__date">
                        <b>{when.getDate()}</b>
                        <span>{when.toLocaleDateString(undefined, { month: "short" })}</span>
                      </div>
                      <div className="ses__body">
                        <span className="ses__title">{w.title}</span>
                        <span className="ses__meta">
                          {fmtWhen(when)} · {w.durationMins}m ·{" "}
                          {seats.capacity === null ? `${seats.taken} enrolled` : `${seats.taken}/${seats.capacity} seats`}
                        </span>
                      </div>
                      <div className="ses__act">
                        {w.meetLink ? (
                          <a className="btn btn--primary btn--sm" href={w.meetLink} target="_blank" rel="noreferrer">
                            Join
                          </a>
                        ) : (
                          <Link className="btn btn--ghost btn--sm" href="/mentor/workshops">
                            Open
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ---- Parental consent: an ops queue, not a daily surface ---- */}
          <details className="more tile" id="consent" open={(pending?.length ?? 0) > 0}>
            <summary className="more__toggle">
              Parental consent
              <span className="more__hint">
                {pending === null ? "…" : pending.length === 0 ? "queue clear" : `${pending.length}${moreConsent ? "+" : ""} waiting`}
              </span>
            </summary>
            <div className="more__body">
              {pending === null ? (
                <p className="empty">Loading…</p>
              ) : pending.length === 0 ? (
                <p className="empty">Nobody is waiting on a parent.</p>
              ) : (
                <>
                  {moreConsent && (
                    <p className="micro" style={{ marginBottom: 12 }}>
                      Showing the first {pending.length}. Clear these to load more.
                    </p>
                  )}
                  <div className="admin-list">
                    {pending.map((p) => (
                      <div key={p.uid} className="tile tile--flat admin-row">
                        <div className="admin-row__body">
                          <div className="admin-row__title">
                            <b>{p.name}</b>
                          </div>
                          <span className="admin-row__meta">
                            {p.ageBand} · {p.country}
                          </span>
                          <span className="admin-row__meta">
                            {resendState[p.uid]
                              ? resendState[p.uid]
                              : p.consentEmailSentAt
                                ? `Email sent ${fmtSent(p.consentEmailSentAt)}`
                                : "No consent email sent yet"}
                          </span>
                        </div>
                        <div className="row-actions" style={{ marginTop: 0 }}>
                          <button className="btn btn--ghost btn--sm" onClick={() => resendConsent(p.uid)}>
                            Resend
                          </button>
                          <button className="btn btn--verify btn--sm" onClick={() => grantConsent(p.uid).catch(() => {})}>
                            Grant
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </details>
        </div>
      </div>

      {viewing && <ProfileModal profile={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
