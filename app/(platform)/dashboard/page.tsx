"use client";

/* One workspace: the track first, then sessions and resources. */

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import {
  watchReleasedSeason,
  watchMySubmissions,
  getUpcomingWorkshops,
  watchUpcomingWorkshops,
  getPastWorkshops,
} from "../../lib/db";
import { enrollWorkshop, leaveWorkshop } from "../../lib/api";
import { SLACK_URL } from "../../lib/program";
import { seasonProgress } from "../../lib/types";
import type { Season, Submission, Workshop } from "../../lib/types";
import { Bar } from "../../components/ui";
import { MemberButton } from "../../components/MemberButton";
import { CalendarConnect } from "../../components/CalendarConnect";
import { SeasonPath } from "../../components/Season";
import { WorkshopList } from "../../components/WorkshopList";

export default function HomePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [seasonSnap, setSeasonSnap] = useState<{ season: Season | null } | null>(null);
  // Tagged with the season they came from, so a season change can never
  // briefly show the previous season's rows.
  const [mineSnap, setMineSnap] = useState<{ seasonId: string; subs: Submission[] } | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[] | null>(null);
  const [recordings, setRecordings] = useState<Workshop[]>([]);
  const [seasonError, setSeasonError] = useState("");
  const [seatErr, setSeatErr] = useState("");

  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (user && profile === null) router.replace("/onboarding");
    // The operator app is the streak and the track. A mentor's job is
    // elsewhere, so they never land here.
    else if (profile?.role === "mentor") router.replace("/mentor");
  }, [user, profile, router]);

  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) return;
    return watchReleasedSeason((season) => { setSeasonSnap({ season }); setSeasonError(""); }, () => setSeasonError("Couldn’t load the track. Reconnecting…"));
  }, [uid]);

  const season = seasonSnap?.season ?? null;
  const seasonId = season?.id ?? null;

  useEffect(() => {
    if (!uid || !seasonId) return;
    return watchMySubmissions(seasonId, uid, (subs) => setMineSnap({ seasonId, subs }));
  }, [uid, seasonId]);

  useEffect(() => {
    if (!uid) return;
    const stop = watchUpcomingWorkshops(setWorkshops, () => setSeatErr("Couldn’t load sessions. Please refresh."));
    getPastWorkshops().then(setRecordings).catch(() => setRecordings([]));
    return stop;
  }, [uid]);

  /** Claim a seat, then reflect it locally — sessions are fetched once, not
   *  watched. A "full" result means someone else took the last seat. */
  async function enroll(w: Workshop) {
    if (!profile) return;
    setSeatErr("");
    try {
      const result = await enrollWorkshop(w.id);
      if (result === "full") {
        setSeatErr(`"${w.title}" just filled up.`);
        getUpcomingWorkshops().then(setWorkshops).catch(() => {});
        return;
      }
      setWorkshops((prev) =>
        (prev ?? []).map((x) =>
          x.id === w.id ? { ...x, enrolledUids: [...(x.enrolledUids ?? []), profile.uid] } : x
        )
      );
    } catch {
      setSeatErr("Couldn't get you in. Try again.");
    }
  }

  async function leave(w: Workshop) {
    if (!profile) return;
    setSeatErr("");
    try {
      await leaveWorkshop(w.id);
      setWorkshops((prev) =>
        (prev ?? []).map((x) =>
          x.id === w.id
            ? { ...x, enrolledUids: (x.enrolledUids ?? []).filter((u) => u !== profile.uid) }
            : x
        )
      );
    } catch {
      setSeatErr("Couldn't give the seat back. Try again.");
    }
  }

  if (!user || !profile) return null;

  const mine = mineSnap && mineSnap.seasonId === seasonId ? mineSnap.subs : [];
  const progress = seasonProgress(season, mine);

  return (
    <div className="screen dashboard">
      <header className="dashboard__header">
        {season ? (
          <>
            <div>
              <span className="micro">Season 1</span>
              <h1 className="h1">{season.name}</h1>
            </div>
          </>
        ) : (
          <h1 className="h1">Yo, {profile.name.split(" ")[0]}.</h1>
        )}
      </header>

      <div className="dashboard__grid">
        <section className="tile dashboard__track" aria-labelledby="track-title">
          <div className="tile__head">
            <h2 className="h3" id="track-title">Your track</h2>
            {progress.total > 0 && (
              <span className="dashboard__progress">
                <b className="num">{progress.done}/{progress.total}</b> complete
              </span>
            )}
          </div>
          {progress.total > 0 && <Bar value={progress.done / progress.total} />}
          {seasonError && <p className="form-err" role="alert">{seasonError}</p>}
          {seasonSnap === null ? (
            <p className="empty">Loading…</p>
          ) : !season ? (
            <p className="empty">The track lands soon.</p>
          ) : (
            <SeasonPath key={season.id} season={season} mine={mine} />
          )}
        </section>

        <section className="tile dashboard__sessions" aria-labelledby="sessions-title">
          <div className="tile__head">
            <h2 className="h3" id="sessions-title">Sessions</h2>
          </div>
          <CalendarConnect returnTo="/dashboard" compact />
          {workshops === null ? (
            <p className="empty">Loading…</p>
          ) : workshops.length === 0 ? (
            <p className="empty">Nothing scheduled yet.</p>
          ) : (
            <WorkshopList workshops={workshops.slice(0, 6)} profile={profile} onEnroll={enroll} onLeave={leave} />
          )}
          {seatErr && <p className="form-err">{seatErr}</p>}
          {recordings.length > 0 && (
            <details className="more dashboard__replays">
              <summary className="more__toggle">
                Replays
                <span className="more__hint">{recordings.length}</span>
              </summary>
              <div className="more__body">
                {recordings.map((w) => {
                  const d = w.startsAt.toDate();
                  return (
                    <div key={w.id} className="ses">
                      <div className="ses__date">
                        <b>{d.getDate()}</b>
                        <span>{d.toLocaleDateString(undefined, { month: "short" })}</span>
                      </div>
                      <div className="ses__body">
                        <span className="ses__title">{w.title}</span>
                        <MemberButton uid={w.mentorUid} name={w.mentorName} />
                      </div>
                      <div className="ses__act">
                        <a className="btn btn--ghost btn--sm" href={w.recordingUrl} target="_blank" rel="noreferrer">
                          Watch
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </section>

        <section className="tile dashboard__resources" aria-labelledby="resources-title">
          <div className="tile__head"><h2 className="h3" id="resources-title">Resources</h2></div>
          <a className="resource-link" href={SLACK_URL} target="_blank" rel="noreferrer">
            <span className="resource-link__mark" aria-hidden="true"><Image src="/brand/slack.svg" alt="" width="28" height="28" /></span>
            <span><strong>Slack</strong><small>Conversations, questions, and small wins.</small></span>
            <span aria-hidden="true">↗</span>
          </a>
          <a className="resource-link" href="/resources/high-agency-structure.pdf" target="_blank" rel="noreferrer">
            <span className="resource-link__mark" aria-hidden="true"><svg width="26" height="30" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 1h10l6 6v20H4zM14 1v7h6M8 14h8M8 19h6" /></svg></span>
            <span><strong>High Agency structure</strong><small>The vision, the skills, and the people.</small></span>
            <span className="micro">PDF ↗</span>
          </a>
        </section>
      </div>
    </div>
  );
}
