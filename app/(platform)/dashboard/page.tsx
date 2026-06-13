"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";
import {
  watchMyCohorts,
  watchSubmissions,
  watchBuildLogs,
  addBuildLog,
  getUpcomingWorkshops,
} from "../../lib/db";
import { levelOf, nextLevel, levelProgress, localDay } from "../../lib/gamify";
import { TRACK } from "../../lib/milestones";
import type { Cohort, MilestoneSubmission, BuildLog, Workshop } from "../../lib/types";
import { WorkshopList } from "../../components/WorkshopList";

export default function HomePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [myCohorts, setMyCohorts] = useState<Cohort[] | null>(null);
  const [subs, setSubs] = useState<MilestoneSubmission[]>([]);
  const [logs, setLogs] = useState<BuildLog[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [logText, setLogText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (user && profile === null) router.replace("/onboarding");
  }, [user, profile, router]);

  useEffect(() => {
    if (!user) return;
    return watchMyCohorts(user.uid, setMyCohorts);
  }, [user]);

  const cohort = myCohorts?.[0] ?? null;

  useEffect(() => {
    if (!cohort) {
      setSubs([]);
      setLogs([]);
      return;
    }
    const u1 = watchSubmissions(cohort.id, setSubs);
    const u2 = watchBuildLogs(cohort.id, setLogs);
    return () => {
      u1();
      u2();
    };
  }, [cohort?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    getUpcomingWorkshops().then(setWorkshops).catch(() => {});
  }, [user]);

  async function postLog() {
    if (!profile || !cohort || !logText.trim()) return;
    setBusy(true);
    try {
      await addBuildLog(cohort.id, profile, logText.trim());
      setLogText("");
    } finally {
      setBusy(false);
    }
  }

  if (!user || !profile) return null;

  const lvl = levelOf(profile.xp);
  const next = nextLevel(profile.xp);
  const pct = Math.round(levelProgress(profile.xp) * 100);

  const myVerified = subs.filter(
    (s) => s.uid === profile.uid && s.status === "verified"
  ).length;
  const myCurrent = TRACK.find(
    (m) =>
      !subs.some(
        (s) => s.uid === profile.uid && s.milestoneId === m.id && s.status === "verified"
      )
  );
  const nextSession = workshops[0];
  const loggedToday = profile.lastBuildLogDay === localDay();
  const consentPending = profile.consentStatus === "pending";

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead__index">
          <span className="eyebrow">
            <span className="dot" /> Operator console
          </span>
          <span className="masthead__meta">
            L{lvl.level} {lvl.name} · <b>{profile.xp} XP</b>
          </span>
        </div>
        <h1 className="masthead__title">
          {profile.name.split(" ")[0]},<br />
          ship something <span className="accent">today.</span>
        </h1>
      </header>

      {consentPending && (
        <div className="panel notice page__block">
          <b>Waiting on parental consent.</b> We&apos;ve flagged your parent or
          guardian. Community features unlock once they approve.
        </div>
      )}

      {/* ---- Stats ---- */}
      <div className="stats">
        <div className="panel stat-card">
          <span className="stat-card__label">Streak</span>
          <span className="stat-card__n">
            {profile.streak}
            <small> {profile.streak === 1 ? "day" : "days"}</small>
          </span>
          <span className="stat-card__hint">
            {profile.streakFreezes > 0
              ? `${profile.streakFreezes} freeze${profile.streakFreezes > 1 ? "s" : ""} banked`
              : loggedToday
                ? "Counted today."
                : "Post a build log to keep it alive."}
          </span>
        </div>

        <div className="panel stat-card">
          <span className="stat-card__label">
            L{lvl.level} {lvl.name}
          </span>
          <span className="stat-card__n">
            {profile.xp}
            <small> xp</small>
          </span>
          <span className="meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="stat-card__hint">
            {next
              ? `${next.xp - profile.xp} xp to L${next.level} ${next.name}`
              : "Top of the ladder."}
          </span>
        </div>

        <div className="panel stat-card">
          <span className="stat-card__label">Track</span>
          <span className="stat-card__n">
            {myVerified}
            <small> / {TRACK.length} verified</small>
          </span>
          <span className="stat-card__hint">
            {cohort
              ? myCurrent
                ? `Now: ${myCurrent.name}`
                : "Season complete."
              : "Join a squad to start the track."}
          </span>
        </div>

        <div className="panel stat-card">
          <span className="stat-card__label">Next session</span>
          <span className="stat-card__n stat-card__n--sm">
            {nextSession
              ? nextSession.startsAt.toDate().toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </span>
          <span className="stat-card__hint">
            {nextSession
              ? `${nextSession.title} · ${nextSession.mentorName}`
              : "Nothing scheduled."}
          </span>
        </div>
      </div>

      <div className="home-grid">
        {/* ---- My squad + build log ---- */}
        <section>
          <h2 className="h3 page__subhead">Your squad</h2>
          {myCohorts === null ? null : cohort ? (
            <>
              <Link href={`/cohorts/${cohort.id}`} className="ccard ccard--mine">
                <div className="ccard__top">
                  <h3 className="h3">{cohort.name}</h3>
                  <span className="ccard__count">
                    {cohort.memberUids.length} members
                    {cohort.weeklyStreak > 0 && ` · ${cohort.weeklyStreak}wk streak`}
                  </span>
                </div>
                <p className="ccard__mission">{cohort.mission}</p>
                {myCurrent && (
                  <span className="meter meter--wide">
                    <i style={{ width: `${Math.round((myVerified / TRACK.length) * 100)}%` }} />
                  </span>
                )}
                <span className="ccard__go">Open workspace</span>
              </Link>

              <div className="panel log-quick">
                <div className="panel__head">
                  <h3 className="h3">Build log</h3>
                  <span className="kicker">
                    {loggedToday ? "logged today ✓" : "+10 XP · feeds your streak"}
                  </span>
                </div>
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
                {logs.slice(0, 3).map((l) => (
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
            </>
          ) : (
            <div className="panel empty-cta">
              <p className="dash__empty">
                You&apos;re not in a squad yet — that&apos;s the whole point of
                this place.
              </p>
              <Link href="/cohorts" className="btn btn--primary">
                Find your squad
              </Link>
            </div>
          )}
        </section>

        {/* ---- This week ---- */}
        <section>
          <div className="page__subrow">
            <h2 className="h3 page__subhead">This week</h2>
            <Link href="/learn" className="page__more">
              All sessions
            </Link>
          </div>
          <div className="panel">
            {workshops.length === 0 ? (
              <p className="dash__empty">Nothing scheduled.</p>
            ) : (
              <WorkshopList workshops={workshops.slice(0, 3)} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
