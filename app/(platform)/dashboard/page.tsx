"use client";

/* The operator's whole app, on one page. Reading order is the priority
   order: where you are in the season → the daily move (ship one line) → the
   weekly move (the track) → what's on (sessions) → the room (the feed).
   Desktop puts the daily move, sessions and feed in a sticky column beside
   the track; mobile stacks them in that same order. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import {
  watchLiveSeason,
  watchMySubmissions,
  watchOpenSubmissions,
  watchBuildLogs,
  removeBuildLog,
  getUpcomingWorkshops,
  getPastWorkshops,
} from "../../lib/db";
import { enrollWorkshop, leaveWorkshop } from "../../lib/api";
import { seasonProgress } from "../../lib/types";
import type { BuildLog, Season, Submission, Workshop } from "../../lib/types";
import { Avatar, Bar, LockIcon } from "../../components/ui";
import { ConsentResend } from "../../components/ConsentResend";
import { ShipLine } from "../../components/ShipLine";
import { SeasonPath } from "../../components/Season";
import { WorkshopList } from "../../components/WorkshopList";

export default function HomePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [seasonSnap, setSeasonSnap] = useState<{ season: Season | null } | null>(null);
  // Tagged with the season they came from, so a season change can never
  // briefly show the previous season's rows.
  const [mineSnap, setMineSnap] = useState<{ seasonId: string; subs: Submission[] } | null>(null);
  const [wallSnap, setWallSnap] = useState<{ seasonId: string; subs: Submission[] } | null>(null);
  const [logs, setLogs] = useState<BuildLog[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[] | null>(null);
  const [recordings, setRecordings] = useState<Workshop[]>([]);
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
    return watchLiveSeason((season) => setSeasonSnap({ season }));
  }, [uid]);

  const season = seasonSnap?.season ?? null;
  const seasonId = season?.id ?? null;

  useEffect(() => {
    if (!uid || !seasonId) return;
    return watchMySubmissions(seasonId, uid, (subs) => setMineSnap({ seasonId, subs }));
  }, [uid, seasonId]);

  useEffect(() => {
    if (!uid || !seasonId) return;
    return watchOpenSubmissions(seasonId, (subs) => setWallSnap({ seasonId, subs }));
  }, [uid, seasonId]);

  useEffect(() => {
    if (!uid) return;
    return watchBuildLogs(setLogs);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    getUpcomingWorkshops().then(setWorkshops).catch(() => setWorkshops([]));
    getPastWorkshops().then(setRecordings).catch(() => setRecordings([]));
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
  const wall = wallSnap && wallSnap.seasonId === seasonId ? wallSnap.subs : [];
  const consentPending = profile.consentStatus === "pending";
  const progress = seasonProgress(season, mine);

  return (
    <div className="screen">
      {/* ---- Where you are ---- */}
      <header className="screen__block">
        {season ? (
          <>
            <span className="micro">
              Season 1{season.category ? ` · ${season.category}` : ""}
              {season.duration ? ` · ${season.duration}` : ""}
            </span>
            <h1 className="h1" style={{ marginTop: 4 }}>{season.name}</h1>
            {progress.total > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, maxWidth: 560 }}>
                <Bar value={progress.done / progress.total} />
                <span className="num" style={{ whiteSpace: "nowrap" }}>
                  {progress.done} / {progress.total}
                </span>
              </div>
            )}
            {(season.overview || season.outcome || season.tagline) && (
              <details className="more" style={{ marginTop: 14, maxWidth: 720 }}>
                <summary className="more__toggle">
                  About this season
                  <span className="more__hint">{season.tagline ? "" : "read"}</span>
                </summary>
                <div className="more__body">
                  {season.tagline && <p style={{ fontWeight: 700 }}>{season.tagline}</p>}
                  {season.overview && <p className="muted">{season.overview}</p>}
                  {season.outcome && (
                    <p className="path__evidence" style={{ marginTop: 6 }}>
                      <b>By the end:</b> {season.outcome}
                    </p>
                  )}
                </div>
              </details>
            )}
          </>
        ) : (
          <h1 className="h1">Yo, {profile.name.split(" ")[0]}.</h1>
        )}
      </header>

      {consentPending && (
        <div className="notice screen__block">
          <LockIcon size={20} />
          <span>
            Waiting on your parent&apos;s OK.
            <small>They got an email — everything unlocks after.</small>
          </span>
          <ConsentResend sentAtMs={profile.consentEmailSentAt?.toMillis()} />
        </div>
      )}

      <div className="grid2 grid2--wide">
        {/* ---- The weekly move: the track ---- */}
        <section className="tile">
          <div className="tile__head">
            <h2 className="h3">The track</h2>
            {season && (
              <span className="micro">{season.milestones.length} steps</span>
            )}
          </div>
          {seasonSnap === null ? (
            <p className="empty">Loading…</p>
          ) : !season ? (
            <p className="empty">The track lands soon.</p>
          ) : (
            <SeasonPath season={season} mine={mine} wall={wall} profile={profile} consentPending={consentPending} />
          )}
        </section>

        {/* ---- The daily move, what's on, and the room ---- */}
        <div className="stack side--sticky">
          <ShipLine profile={profile} consentPending={consentPending} />

          <section className="tile">
            <div className="tile__head">
              <h2 className="h3">Next sessions</h2>
            </div>
            {workshops === null ? (
              <p className="empty">Loading…</p>
            ) : workshops.length === 0 ? (
              <p className="empty">Nothing scheduled yet.</p>
            ) : (
              <WorkshopList workshops={workshops.slice(0, 6)} profile={profile} onEnroll={enroll} onLeave={leave} />
            )}
            {seatErr && <p className="form-err">{seatErr}</p>}
            {recordings.length > 0 && (
              <details className="more" style={{ marginTop: 10 }}>
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
                          <span className="ses__meta">{w.mentorName}</span>
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

          <section className="tile">
            <div className="tile__head">
              <h2 className="h3">The feed</h2>
              <span className="micro">everyone&apos;s lines</span>
            </div>
            {logs.length === 0 ? (
              <p className="empty">Ship the first line.</p>
            ) : (
              <div className="feed" style={{ marginTop: 0 }}>
                {logs.map((l) => (
                  <div key={l.id} className="feed__row">
                    <Avatar name={l.name} size="sm" />
                    <div className="feed__body">
                      <b>{l.name}</b> <span className="feed__day">{l.day}</span>
                      {l.uid === profile.uid && (
                        <button
                          type="button"
                          className="link-btn micro"
                          style={{ marginLeft: 8 }}
                          onClick={() => removeBuildLog(l.id).catch(() => {})}
                        >
                          remove
                        </button>
                      )}
                      <p>{l.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
