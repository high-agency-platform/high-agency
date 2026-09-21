"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import { watchMembers } from "../lib/db";
import type { Profile } from "../lib/types";
import { Avatar, SquadIcon } from "./ui";
import { ProfileModal } from "./ProfileModal";

export function MemberWorkspace({ children }: { children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const [preview, setPreview] = useState(false);
  const [focused, setFocused] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); }, []);
  const [members, setMembers] = useState<Profile[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const open = pinned || preview || focused || selected !== null;
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => watchMembers((profiles) => { setMembers(profiles); setFailed(false); }, () => setFailed(true)), [retry]);

  return (
    <div className={`workspace ${open ? "workspace--members" : ""} ${pinned ? "workspace--pinned" : ""}`}>
      <main>{children}</main>
      <aside className="member-roster" aria-label="Season members"
        onPointerEnter={(e) => { if (e.pointerType === "mouse") { if (leaveTimer.current) clearTimeout(leaveTimer.current); setPreview(true); } }}
        onPointerLeave={() => { leaveTimer.current = setTimeout(() => setPreview(false), 180); }}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}
        onKeyDown={(e) => { if (e.key === "Escape") { setPinned(false); setPreview(false); setFocused(false); } }}>

        <button className="member-roster__toggle" aria-expanded={open} aria-controls="season-members" onClick={() => { setPinned(!pinned); if (pinned) { setPreview(false); setFocused(false); } }} aria-label={pinned ? "Unpin members" : "Pin members"} title={pinned ? "Unpin members" : "Keep members open"}>
          <SquadIcon size={20} /><span>Members</span><span aria-hidden="true">{pinned ? "−" : "+"}</span>
        </button>
        {open && <div id="season-members" className="member-roster__list">
          {failed ? <div className="empty" role="alert">Couldn’t load members.<button className="link-btn" onClick={() => setRetry((n) => n + 1)}>Retry</button></div> : members === null ? <p className="empty">Loading…</p> : (["mentor", "operator"] as const).map((role) => {
            const group = members.filter((p) => p.role === role);
            const label = role === "mentor" ? (group.some((p) => p.staffTitle === "advisor") ? "Mentors & advisors" : "Mentors") : "Operators";
            return <section key={role} aria-label={label}>
              <h2 className="micro">{label}<span>{group.length}</span></h2>
              {group.map((member) => <button className="member-roster__person" key={member.uid} onClick={(e) => { e.currentTarget.focus(); setSelected(member.uid); }}>
                <Avatar name={member.name} photoUrl={member.photoUrl} size="sm" />
                <span><strong>{member.name}</strong>{member.staffTitle === "advisor" && <small className="member-roster__role">Advisor</small>}{member.headline && <small>{member.headline}</small>}</span>
              </button>)}
              {group.length === 0 && <p className="member-roster__empty">Joining soon.</p>}
            </section>;
          })}
        </div>}
      </aside>
      {selected && <ProfileModal profile={members?.find((p) => p.uid === selected) ?? null} onClose={() => { setFocused(true); setSelected(null); }} />}
    </div>
  );
}
