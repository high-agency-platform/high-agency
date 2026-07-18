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
import { AvStack, FlameIcon, LockIcon } from "../../components/ui";
import { SquadRoster } from "../../components/SquadRoster";
import type { Cohort, CohortApplication, WeeklyHours } from "../../lib/types";

const HOURS: WeeklyHours[] = ["<3", "3-5", "5-10", "10+"];

export default function CohortsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[] | null>(null);
  const [applied, setApplied] = useState<Record<string, CohortApplication>>({});
  const [filter, setFilter] = useState<string | null>(null);

  const [applyId, setApplyId] = useState<string | null>(null);
  const [pitch, setPitch] = useState("");
  const [applyHours, setApplyHours] = useState<WeeklyHours | null>(null);
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
    if (!profile || !applyHours) return;
    setBusy(true);
    setError("");
    try {
      await applyToCohort(cohortId, profile, pitch.trim(), applyHours);
      setApplied((p) => ({
        ...p,
        [cohortId]: {
          applicantUid: profile.uid,
          applicantName: profile.name,
          pitch,
          hours: applyHours,
          status: "pending",
          declineReason: null,
        },
      }));
      setApplyId(null);
      setPitch("");
      setApplyHours(null);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "max-pending"
          ? `Max ${MAX_PENDING_APPLICATIONS} applications out at once.`
          : "Didn't send. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitCohort() {
    if (!profile) return;
    if (!newName.trim() || !newMission.trim() || !newSlot.trim()) {
      setError("Name, mission, and a weekly slot — all three.");
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
      setError("Couldn't create it. Try again.");
      setBusy(false);
    }
  }

  if (!user || !profile) return null;

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="h1">Squads</h1>
        {!creating && myCohorts.length === 0 && !consentPending && (
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            Start one
          </button>
        )}
      </header>

      {consentPending && (
        <div className="notice screen__block">
          <LockIcon size={20} />
          <span>
            Browse away — applying unlocks after your parent&apos;s OK.
          </span>
        </div>
      )}

      {creating && (
        <div className="tile screen__block">
          <div className="tile__head">
            <h2 className="h3">New squad</h2>
          </div>
          <div className="field">
            <label htmlFor="nc-name">Name</label>
            <input
              id="nc-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Night Shift"
              maxLength={60}
            />
          </div>
          <div className="field">
            <label htmlFor="nc-mission">Mission</label>
            <input
              id="nc-mission"
              value={newMission}
              onChange={(e) => setNewMission(e.target.value)}
              placeholder="What's this crew about?"
              maxLength={140}
            />
          </div>
          <div className="field">
            <label htmlFor="nc-slot">Weekly ritual</label>
            <input
              id="nc-slot"
              value={newSlot}
              onChange={(e) => setNewSlot(e.target.value)}
              placeholder="Sundays 7pm ET"
              maxLength={80}
            />
            <small className="field__hint">Commit to the cadence first.</small>
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
            <label>Recruiting</label>
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
              {busy ? "…" : "Create"}
            </button>
          </div>
        </div>
      )}

      {myCohorts.length > 0 && (
        <section className="screen__block">
          <div className="screen__label">
            <span className="micro">Yours</span>
          </div>
          <div className="squads">
            {myCohorts.map((c) => (
              <Link key={c.id} href={`/cohorts/${c.id}`} className="tile tile--tap tile--ember sq">
                <div className="sq__top">
                  <span className="sq__name">{c.name}</span>
                  {c.weeklyStreak > 0 && (
                    <span className="hud__stat hud__stat--fire">
                      <FlameIcon size={14} />
                      {c.weeklyStreak}w
                    </span>
                  )}
                </div>
                <AvStack names={c.memberUids.map((u) => c.memberNames[u] ?? "?")} />
                <p className="sq__mission">{c.mission}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="screen__block">
        <div className="screen__label">
          <span className="micro">Open squads</span>
          {atCap && (
            <span className="micro">
              {pendingCount}/{MAX_PENDING_APPLICATIONS} out
            </span>
          )}
        </div>

        <div className="chip-row screen__block" style={{ marginBottom: 16 }}>
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
          <p className="empty">Loading…</p>
        ) : matches.length === 0 ? (
          <div className="empty">
            <p>Nothing matches.</p>
            {!consentPending && (
              <button className="btn btn--ghost" onClick={() => setCreating(true)}>
                Start one
              </button>
            )}
          </div>
        ) : (
          <div className="squads">
            {matches.map(({ cohort: c, why }) => {
              const app = applied[c.id];
              return (
                <article key={c.id} className="tile sq">
                  <div className="sq__top">
                    <span className="sq__name">{c.name}</span>
                    <SquadRoster uids={c.memberUids} names={c.memberNames} />
                  </div>
                  <p className="sq__mission">{c.mission}</p>
                  {(why.length > 0 || c.tags.length > 0 || (c.lookingFor ?? []).length > 0) && (
                    <div className="sq__tags">
                      {why.map((w) => (
                        <span key={w} className="chip chip--why">
                          {w}
                        </span>
                      ))}
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
                  <div className="sq__foot">
                    <span className="sq__slot">
                      {c.meetingSlot || c.founderName}
                      {c.state === "forming" && " · forming"}
                    </span>
                    {app?.status === "pending" ? (
                      <span className="sq__status">Applied</span>
                    ) : app?.status === "declined" ? (
                      <span className="sq__status sq__status--mute">
                        {app.declineReason
                          ? DECLINE_LABELS[app.declineReason]
                          : "Declined"}
                      </span>
                    ) : applyId === c.id ? null : (
                      <button
                        className="btn btn--primary btn--sm"
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
                          setApplyHours(null);
                          setError("");
                        }}
                      >
                        Apply
                      </button>
                    )}
                  </div>
                  {applyId === c.id && (
                    <div className="apply-box">
                      <textarea
                        className="input"
                        value={pitch}
                        onChange={(e) => setPitch(e.target.value)}
                        placeholder="Why you? Your profile goes along too."
                        maxLength={300}
                      />
                      <div>
                        <span className="micro" style={{ display: "block", marginBottom: 8 }}>
                          Hours / week
                        </span>
                        <div className="chip-row">
                          {HOURS.map((h) => (
                            <button
                              key={h}
                              type="button"
                              className={`pick ${applyHours === h ? "sel" : ""}`}
                              onClick={() => setApplyHours(h)}
                            >
                              {h === "<3" ? "<3" : h}
                            </button>
                          ))}
                        </div>
                      </div>
                      {error && <p className="form-err">{error}</p>}
                      <div className="row-actions" style={{ marginTop: 0 }}>
                        <button className="btn btn--ghost btn--sm" onClick={() => setApplyId(null)}>
                          Cancel
                        </button>
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => submitApplication(c.id)}
                          disabled={busy || !pitch.trim() || !applyHours}
                        >
                          {busy ? "…" : "Send"}
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
