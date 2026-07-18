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

/** Without a profile this is a plain schedule (dashboard tiles).
 *  With profile + handlers it becomes the enrollable catalog. */
export function WorkshopList({
  workshops,
  profile,
  onEnroll,
  onAttend,
}: {
  workshops: Workshop[];
  profile?: Profile;
  onEnroll?: (w: Workshop) => void;
  onAttend?: (w: Workshop) => void;
}) {
  return (
    <div>
      {workshops.map((w) => {
        const enrolled = profile?.enrolledWorkshops.includes(w.id) ?? false;
        const attended = profile?.attendedWorkshops.includes(w.id) ?? false;
        const gate = profile ? canEnroll(profile, w) : { ok: true, reason: "" };
        const started = w.startsAt.toDate().getTime() < Date.now() + w.durationMins * 60000;
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
              {!profile ? (
                <a className="btn btn--ghost btn--sm" href={w.meetLink} target="_blank" rel="noreferrer">
                  Join
                </a>
              ) : attended ? (
                <span className="ses__done">
                  <CheckIcon size={12} /> +50
                </span>
              ) : enrolled ? (
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
              ) : gate.ok ? (
                <button className="btn btn--ghost btn--sm" onClick={() => onEnroll?.(w)}>
                  Enroll
                </button>
              ) : (
                <span className="ses__lock" title={gate.reason}>
                  <LockIcon /> L{w.levelGate}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
