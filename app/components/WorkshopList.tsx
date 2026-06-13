"use client";

import type { Profile, Workshop } from "../lib/types";
import { canEnroll } from "../lib/gamify";

function fmt(ts: { toDate: () => Date }): string {
  const d = ts.toDate();
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Without a profile this is a plain schedule (dashboard sidebars).
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
    <div className="wlist">
      {workshops.map((w) => {
        const enrolled = profile?.enrolledWorkshops.includes(w.id) ?? false;
        const attended = profile?.attendedWorkshops.includes(w.id) ?? false;
        const gate = profile ? canEnroll(profile, w) : { ok: true, reason: "" };
        const started = w.startsAt.toDate().getTime() < Date.now() + w.durationMins * 60000;

        return (
          <div key={w.id} className="wrow">
            <div className="wrow__when">{fmt(w.startsAt)}</div>
            <div className="wrow__body">
              <span className="wrow__title">
                {w.title}
                {w.open && <span className="chip chip--open">Open to all</span>}
                {w.levelGate > 0 && (
                  <span className="chip chip--gate">L{w.levelGate}+</span>
                )}
              </span>
              <span className="wrow__mentor">
                {w.kind === "office_hours" ? "Office hours" : "Workshop"} ·{" "}
                {w.mentorName}
              </span>
            </div>
            {!profile ? (
              <a className="btn btn--ghost wrow__join" href={w.meetLink} target="_blank" rel="noreferrer">
                Join
              </a>
            ) : attended ? (
              <span className="wrow__attended">Attended ✓ +50 XP</span>
            ) : enrolled ? (
              <div className="wrow__actions">
                <a className="btn btn--primary wrow__join" href={w.meetLink} target="_blank" rel="noreferrer">
                  Join
                </a>
                {started && onAttend && (
                  <button className="btn btn--ghost wrow__join" onClick={() => onAttend(w)}>
                    I attended
                  </button>
                )}
              </div>
            ) : gate.ok ? (
              <button className="btn btn--ghost wrow__join" onClick={() => onEnroll?.(w)}>
                Enroll
              </button>
            ) : (
              <span className="wrow__locked" title={gate.reason}>
                {gate.reason}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
