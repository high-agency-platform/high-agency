"use client";

import type { Profile, Workshop } from "../lib/types";
import { canEnroll } from "../lib/gamify";
import { CheckIcon, LockIcon } from "./ui";

function dateParts(ts: { toDate: () => Date }): { day: string; mon: string; time: string } {
  const d = ts.toDate();
  return {
    day: String(d.getDate()),
    mon: d.toLocaleDateString(undefined, { month: "short" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

/** The action cluster for one workshop: attended → enrolled/join → enroll → locked.
 *  Every surface that lists sessions must render this — never a bare Join link. */
export function SessionAction({
  w,
  profile,
  onEnroll,
  onAttend,
}: {
  w: Workshop;
  profile: Profile;
  onEnroll?: (w: Workshop) => void;
  onAttend?: (w: Workshop) => void;
}) {
  const enrolled = profile.enrolledWorkshops.includes(w.id);
  const attended = profile.attendedWorkshops.includes(w.id);
  const gate = canEnroll(profile, w);
  const started = w.startsAt.toDate().getTime() < Date.now() + w.durationMins * 60000;

  if (attended)
    return (
      <span className="ses__done">
        <CheckIcon size={12} /> +50
      </span>
    );
  if (enrolled)
    return (
      <>
        <a className="btn btn--primary btn--sm" href={w.meetLink} target="_blank" rel="noreferrer">
          Join
        </a>
        {started && onAttend && (
          <button className="btn btn--verify btn--sm" onClick={() => onAttend(w)}>
            I went
          </button>
        )}
      </>
    );
  if (gate.ok)
    return (
      <button className="btn btn--ghost btn--sm" onClick={() => onEnroll?.(w)}>
        Enroll
      </button>
    );
  return (
    <span className="ses__lock" title={gate.reason}>
      <LockIcon /> L{w.levelGate}
    </span>
  );
}

/** The enrollable session catalog (Learn page). */
export function WorkshopList({
  workshops,
  profile,
  onEnroll,
  onAttend,
}: {
  workshops: Workshop[];
  profile: Profile;
  onEnroll?: (w: Workshop) => void;
  onAttend?: (w: Workshop) => void;
}) {
  return (
    <div>
      {workshops.map((w) => {
        const enrolled = profile.enrolledWorkshops.includes(w.id);
        const attended = profile.attendedWorkshops.includes(w.id);
        const { day, mon, time } = dateParts(w.startsAt);

        return (
          <div key={w.id} className="ses">
            <div className={`ses__date ${enrolled && !attended ? "ses__date--live" : ""}`}>
              <b>{day}</b>
              <span>{mon}</span>
            </div>
            <div className="ses__body">
              <span className="ses__title">
                {w.title}
                {w.levelGate > 0 && <span className="chip chip--on">L{w.levelGate}+</span>}
              </span>
              <span className="ses__meta">
                {time} · {w.mentorName}
              </span>
            </div>
            <div className="ses__act">
              <SessionAction w={w} profile={profile} onEnroll={onEnroll} onAttend={onAttend} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
