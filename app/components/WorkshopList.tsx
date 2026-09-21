"use client";

import { useEffect, useState } from "react";
import type { Profile, Workshop } from "../lib/types";
import { workshopSpots, workshopCalendarUrl, workshopIsUpcoming } from "../lib/types";
import { CalendarIcon } from "./ui";
import { MemberButton } from "./MemberButton";

/** Seats left, shown everywhere a session renders. Silent when the session
 *  is uncapped (legacy docs only) or the viewer already holds a seat. */
export function SeatChip({ w }: { w: Workshop }) {
  const { left, full } = workshopSpots(w);
  if (left === null) return null;
  if (full) return <span className="chip chip--mute">Full</span>;
  return <span className="chip chip--want">{left} left</span>;
}

function dateParts(ts: { toDate: () => Date }): { day: string; mon: string; weekday: string; time: string } {
  const d = ts.toDate();
  return {
    day: String(d.getDate()),
    mon: d.toLocaleDateString(undefined, { month: "short" }),
    weekday: d.toLocaleDateString(undefined, { weekday: "long" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
  };
}

export function isEnrolled(w: Workshop, profile: Profile): boolean {
  // The workshop doc is authoritative for seats; the profile mirror is the
  // fallback for legacy enrollments made before the roster moved onto the doc.
  return (w.enrolledUids ?? []).includes(profile.uid) || profile.enrolledWorkshops.includes(w.id);
}

/** The action cluster for one workshop: join/leave when enrolled, enroll
 *  otherwise, "full" when there's no seat. Every surface that lists sessions
 *  renders this — never a bare Join link. */
export function SessionAction({
  w,
  profile,
  onEnroll,
  onLeave,
}: {
  w: Workshop;
  profile: Profile;
  onEnroll?: (w: Workshop) => void;
  onLeave?: (w: Workshop) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const enrolled = isEnrolled(w, profile);
  const full = workshopSpots(w).full;
  const started = w.startsAt.toDate().getTime() <= now;

  if (!workshopIsUpcoming(w, now)) return <span className="micro">Ended</span>;
  if (enrolled)
    return (
      <>
        {w.meetLink ? (
          <a className="btn btn--primary btn--sm" href={w.meetLink} target="_blank" rel="noreferrer">
            Join
          </a>
        ) : (
          <span className="micro">link coming</span>
        )}
        {!started && onLeave && (
          <button className="btn btn--ghost btn--sm" onClick={() => onLeave(w)} title="Give the seat back">
            Leave
          </button>
        )}
      </>
    );
  if (full) return <span className="ses__lock" title="Every seat is taken">Full</span>;
  return (
    <button className="btn btn--ghost btn--sm" onClick={() => onEnroll?.(w)}>
      Enroll
    </button>
  );
}

/** Upcoming sessions on the operator dashboard. */
export function WorkshopList({
  workshops,
  profile,
  onEnroll,
  onLeave,
}: {
  workshops: Workshop[];
  profile: Profile;
  onEnroll?: (w: Workshop) => void;
  onLeave?: (w: Workshop) => void;
}) {
  return (
    <div>
      {workshops.map((w) => {
        const enrolled = isEnrolled(w, profile);
        const { day, mon, weekday, time } = dateParts(w.startsAt);
        const { left, full } = workshopSpots(w);

        return (
          <article key={w.id} className="session-card">
            <div className="session-card__when">
              <div className={`ses__date ${enrolled ? "ses__date--live" : ""}`}>
                <b>{day}</b>
                <span>{mon}</span>
              </div>
              <div>
                <span className="session-card__weekday">{weekday}</span>
                <span className="session-card__time">{time} <span>· {w.durationMins} min</span></span>
              </div>
            </div>
            <h3 className="session-card__title">{w.title}</h3>
            <div className="session-card__mentor"><MemberButton uid={w.mentorUid} name={w.mentorName} /></div>
            {w.description && (
              <details className="more session-card__details">
                <summary className="more__toggle">Session details</summary>
                <div className="more__body"><p>{w.description}</p></div>
              </details>
            )}
            <div className="session-card__footer">
              <span className="session-card__seats">
                {enrolled ? (
                  "You're enrolled"
                ) : !full && left !== null ? `${left} seats left` : null}
              </span>
              <div className="ses__act">
                <SessionAction w={w} profile={profile} onEnroll={onEnroll} onLeave={onLeave} />
              </div>
            </div>
            {enrolled && <a className="session-card__calendar" href={workshopCalendarUrl(w)} target="_blank" rel="noreferrer"><CalendarIcon size={16} /> Add to Google Calendar <span aria-hidden="true">↗</span></a>}
          </article>
        );
      })}
    </div>
  );
}
