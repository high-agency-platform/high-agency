"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";
import {
  watchCohorts,
  applyToCohort,
  getMyApplication,
  createCohort,
  reconcilePendingApplications,
  MAX_PENDING_APPLICATIONS,
} from "../../lib/db";
import { rankCohorts } from "../../lib/match";
import { DOMAINS, SKILLS, DECLINE_LABELS } from "../../lib/types";
import type { Cohort, CohortApplication } from "../../lib/types";

export default function CohortsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[] | null>(null);
  const [applied, setApplied] = useState<Record<string, CohortApplication>>({});
  const [filter, setFilter] = useState<string | null>(null);

  const [applyId, setApplyId] = useState<string | null>(null);
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMission, setNewMission] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newLookingFor, setNewLookingFor] = useState<string[]>([]);
  const [newSlot, setNewSlot] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (user && profile === null) router.replace("/onboarding");
  }, [user, profile, router]);

  useEffect(() => {
    if (!user) return;
    return watchCohorts(setCohorts);
  }, [user]);

  // Free up application slots for anything that's been decided.
  useEffect(() => {
    if (profile) reconcilePendingApplications(profile).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  const myCohorts = useMemo(
    () => (cohorts ?? []).filter((c) => user && c.memberUids.includes(user.uid)),
    [cohorts, user]
  );

  const matches = useMemo(() => {
    if (!profile || !cohorts) return [];
    const open = cohorts.filter(
      (c) =>
        !c.memberUids.includes(profile.uid) &&
        c.state !== "archived" &&
        (!filter || c.tags.includes(filter))
    );
    return rankCohorts(profile, open);
  }, [cohorts, profile, filter]);

  useEffect(() => {
    if (!user || !cohorts) return;
    let stale = false;
    Promise.all(
      cohorts
        .filter((c) => !c.memberUids.includes(user.uid))
        .map(async (c) => {
          const a = await getMyApplication(c.id, user.uid).catch(() => null);
          return [c.id, a] as const;
        })
    ).then((pairs) => {
      if (stale) return;
      const next: Record<string, CohortApplication> = {};
      for (const [id, app] of pairs) if (app) next[id] = app;
      setApplied(next);
    });
    return () => {
      stale = true;
    };
  }, [user, cohorts]);

  const consentPending = profile?.consentStatus === "pending";
  const pendingCount = profile?.pendingApplications.length ?? 0;
  const atCap = pendingCount >= MAX_PENDING_APPLICATIONS;

  async function submitApplication(cohortId: string) {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      await applyToCohort(cohortId, profile, pitch.trim());
      setApplied((p) => ({
        ...p,
        [cohortId]: {
          applicantUid: profile.uid,
          applicantName: profile.name,
          pitch,
          status: "pending",
          declineReason: null,
        },
      }));
      setApplyId(null);
      setPitch("");
    } catch (e) {
      setError(
        e instanceof Error && e.message === "max-pending"
          ? `You have ${MAX_PENDING_APPLICATIONS} applications out — wait for a decision or withdraw one.`
          : "Application failed. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitCohort() {
    if (!profile) return;
    if (!newName.trim() || !newMission.trim() || !newSlot.trim()) {
      setError("A squad needs a name, a mission, and a committed weekly slot.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const id = await createCohort(profile, {
        name: newName.trim(),
        mission: newMission.trim(),
        tags: newTags,
        lookingFor: newLookingFor,
        meetingSlot: newSlot.trim(),
      });
      router.push(`/cohorts/${id}`);
    } catch {
      setError("Couldn't create the squad. Try again.");
      setBusy(false);
    }
  }

  if (!user || !profile) return null;

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead__index">
          <span className="eyebrow">
            <span className="dot" /> Find your squad
          </span>
          {!creating && myCohorts.length === 0 && !consentPending && (
            <button className="btn btn--accent" onClick={() => setCreating(true)}>
              Start a squad
            </button>
          )}
        </div>
        <h1 className="masthead__title">Cohorts</h1>
        <div className="masthead__sub">
          <p className="lead">
            Small crews of operators building in parallel. Find the one whose
            mission rhymes with yours.
          </p>
        </div>
      </header>

      {consentPending && (
        <div className="panel notice page__block">
          <b>Waiting on parental consent.</b> We&apos;ve flagged your parent or
          guardian — you can browse squads, but applying and posting unlock
          once they approve.
        </div>
      )}

      {creating && (
        <div className="panel create-panel page__block">
          <div className="field">
            <label htmlFor="nc-name">Squad name</label>
            <input
              id="nc-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Night Shift"
              maxLength={60}
            />
          </div>
          <div className="field">
            <label htmlFor="nc-mission">Mission — one line</label>
            <input
              id="nc-mission"
              value={newMission}
              onChange={(e) => setNewMission(e.target.value)}
              placeholder="What is this crew about?"
              maxLength={140}
            />
          </div>
          <div className="field">
            <label htmlFor="nc-slot">Weekly meeting slot — the ritual</label>
            <input
              id="nc-slot"
              value={newSlot}
              onChange={(e) => setNewSlot(e.target.value)}
              placeholder="e.g. Sundays 7pm ET"
              maxLength={80}
            />
            <small className="field__hint">
              Required on purpose: commit to the cadence before you recruit.
            </small>
          </div>
          <div className="field">
            <label>Focus</label>
            <div className="chip-row">
              {DOMAINS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`pick ${newTags.includes(t) ? "sel" : ""}`}
                  onClick={() =>
                    setNewTags((p) =>
                      p.includes(t) ? p.filter((x) => x !== t) : [...p, t]
                    )
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Looking for (skills)</label>
            <div className="chip-row">
              {SKILLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pick ${newLookingFor.includes(s) ? "sel" : ""}`}
                  onClick={() =>
                    setNewLookingFor((p) =>
                      p.includes(s) ? p.filter((x) => x !== s) : [...p, s]
                    )
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="form-err">{error}</p>}
          <div className="row-actions">
            <button className="btn btn--ghost" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={submitCohort} disabled={busy}>
              {busy ? "Creating…" : "Create squad"}
            </button>
          </div>
        </div>
      )}

      {myCohorts.length > 0 && (
        <section className="page__block">
          <h2 className="h3 page__subhead">Yours</h2>
          <div className="cohort-grid">
            {myCohorts.map((c) => (
              <Link key={c.id} href={`/cohorts/${c.id}`} className="ccard ccard--mine">
                <div className="ccard__top">
                  <h3 className="h3">{c.name}</h3>
                  <span className="ccard__count">{c.memberUids.length} members</span>
                </div>
                <p className="ccard__mission">{c.mission}</p>
                <span className="ccard__go">Open workspace</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="page__block">
        <div className="page__subrow">
          <h2 className="h3 page__subhead">Squads building things like yours</h2>
          {atCap && (
            <span className="kicker">
              {pendingCount}/{MAX_PENDING_APPLICATIONS} applications out
            </span>
          )}
        </div>

        <div className="chip-row page__filters">
          <button
            type="button"
            className={`pick ${filter === null ? "sel" : ""}`}
            onClick={() => setFilter(null)}
          >
            All
          </button>
          {DOMAINS.map((d) => (
            <button
              key={d}
              type="button"
              className={`pick ${filter === d ? "sel" : ""}`}
              onClick={() => setFilter(filter === d ? null : d)}
            >
              {d}
            </button>
          ))}
        </div>

        {cohorts === null ? (
          <p className="dash__empty">Loading squads…</p>
        ) : matches.length === 0 ? (
          <p className="dash__empty">
            No open squads match yet. Start one — or clear the filter.
          </p>
        ) : (
          <div className="cohort-grid">
            {matches.map(({ cohort: c, why }) => {
              const app = applied[c.id];
              return (
                <article key={c.id} className="ccard">
                  <div className="ccard__top">
                    <h3 className="h3">{c.name}</h3>
                    <span className="ccard__count">
                      {c.memberUids.length} members
                      {c.state === "forming" ? " · forming" : ""}
                    </span>
                  </div>
                  <p className="ccard__mission">{c.mission}</p>
                  {why.length > 0 && (
                    <div className="ccard__tags">
                      {why.map((w) => (
                        <span key={w} className="chip chip--why">
                          {w}
                        </span>
                      ))}
                    </div>
                  )}
                  {(c.tags.length > 0 || (c.lookingFor ?? []).length > 0) && (
                    <div className="ccard__tags">
                      {c.tags.map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                      {(c.lookingFor ?? []).map((s) => (
                        <span key={s} className="chip chip--want">
                          wants {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="ccard__foot">
                    <span className="ccard__founder">
                      {c.meetingSlot ? `Meets ${c.meetingSlot}` : `By ${c.founderName}`}
                    </span>
                    {app?.status === "pending" ? (
                      <span className="ccard__status">Applied</span>
                    ) : app?.status === "declined" ? (
                      <span className="ccard__status ccard__status--mute">
                        {app.declineReason
                          ? DECLINE_LABELS[app.declineReason]
                          : "Declined"}
                      </span>
                    ) : applyId === c.id ? null : (
                      <button
                        className="btn btn--ghost ccard__apply"
                        disabled={consentPending || atCap}
                        title={
                          consentPending
                            ? "Waiting on parental consent"
                            : atCap
                              ? "Application cap reached"
                              : ""
                        }
                        onClick={() => {
                          setApplyId(c.id);
                          setPitch("");
                          setError("");
                        }}
                      >
                        Apply
                      </button>
                    )}
                  </div>
                  {applyId === c.id && (
                    <div className="apply-inline">
                      <p className="apply-inline__note">
                        Your profile goes with this automatically.
                      </p>
                      <textarea
                        value={pitch}
                        onChange={(e) => setPitch(e.target.value)}
                        placeholder="Why this squad, and what do you bring?"
                        maxLength={300}
                      />
                      {error && <p className="form-err">{error}</p>}
                      <div className="row-actions">
                        <button className="btn btn--ghost" onClick={() => setApplyId(null)}>
                          Cancel
                        </button>
                        <button
                          className="btn btn--primary"
                          onClick={() => submitApplication(c.id)}
                          disabled={busy || !pitch.trim()}
                        >
                          {busy ? "Sending…" : "Send application"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
