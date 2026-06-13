"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { getUpcomingWorkshops, enrollWorkshop, markAttended } from "../../lib/db";
import { TRACK } from "../../lib/milestones";
import type { Workshop } from "../../lib/types";
import { WorkshopList } from "../../components/WorkshopList";

export default function LearnPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [workshops, setWorkshops] = useState<Workshop[] | null>(null);

  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (user && profile === null) router.replace("/onboarding");
  }, [user, profile, router]);

  useEffect(() => {
    if (!user) return;
    getUpcomingWorkshops().then(setWorkshops).catch(() => setWorkshops([]));
  }, [user]);

  if (!user || !profile) return null;

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead__index">
          <span className="eyebrow">
            <span className="dot" /> Live, not lectures
          </span>
        </div>
        <h1 className="masthead__title">Workshops</h1>
        <div className="masthead__sub">
          <p className="lead">
            One live workshop per track milestone, taught by practitioners.
            Attend live for +50 XP — recordings land here after each session.
          </p>
        </div>
      </header>

      <section className="page__block">
        <h2 className="h3 page__subhead">Upcoming sessions</h2>
        <div className="panel">
          {workshops === null ? (
            <p className="dash__empty">Loading…</p>
          ) : workshops.length === 0 ? (
            <p className="dash__empty">Nothing scheduled.</p>
          ) : (
            <WorkshopList
              workshops={workshops}
              profile={profile}
              onEnroll={(w) => enrollWorkshop(profile.uid, w.id).catch(() => {})}
              onAttend={(w) => markAttended(profile, w.id).catch(() => {})}
            />
          )}
        </div>
      </section>

      <section className="page__block">
        <h2 className="h3 page__subhead">The season map</h2>
        <p className="dash__empty page__note">
          Eight weeks, seven milestones. Each workshop teaches the milestone
          you&apos;re about to hit.
        </p>
        <div className="season-map">
          {TRACK.map((m) => {
            const linked = (workshops ?? []).find((w) => w.milestoneId === m.id);
            return (
              <div key={m.id} className="season-map__row">
                <span className="season-map__week">{m.week}</span>
                <div className="season-map__body">
                  <b>{m.name}</b>
                  <small>{m.why}</small>
                  {linked && (
                    <small className="season-map__ws">
                      Workshop: {linked.title} · {linked.mentorName}
                    </small>
                  )}
                </div>
                <span className="season-map__xp">{m.xp} XP</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
