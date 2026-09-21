"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Profile } from "../lib/types";
import { normalizeLink } from "../lib/types";
import { Avatar } from "./ui";

export function ProfileDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={ref} className="profile-dialog" aria-label={title} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => {
      if (e.target !== e.currentTarget) return;
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
    }}>
      <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
      {children}
    </dialog>
  );
}

export function ProfileDetails({ profile }: { profile: Profile }) {
  const mentor = profile.role === "mentor";
  const links = [
    { label: "Website", url: profile.links?.site },
    { label: "LinkedIn", url: profile.links?.linkedin },
    { label: "GitHub", url: profile.links?.github },
  ].filter((link) => link.url?.trim());

  return (
    <article className="member-profile">
      <header className="member-profile__header">
        <Avatar name={profile.name} photoUrl={profile.photoUrl} size="lg" />
        <span className="micro">{mentor ? (profile.staffTitle === "advisor" ? "Advisor" : "Mentor") : "Operator"}{profile.country ? ` · ${profile.country}` : ""}</span>
        <h2>{profile.name}</h2>
        {profile.headline && <p className="member-profile__headline">{profile.headline}</p>}
      </header>
      <div className="member-profile__body">
        {profile.building && (
          <section>
            <h3>{mentor ? "Working on" : "Building"}</h3>
            <p>{profile.building}</p>
            {!mentor && <span className="member-profile__stage">{{ idea: "Idea stage", building: "In progress", launched: "Launched", revenue: "Earning revenue" }[profile.stage]}</span>}
          </section>
        )}
        {profile.bio && <section><h3>About</h3><p>{profile.bio}</p></section>}
        {(profile.domains.length > 0 || profile.skills.length > 0) && (
          <div className="member-profile__columns">
            {profile.domains.length > 0 && <section><h3>{mentor ? "Expertise" : "Interests"}</h3><p>{profile.domains.join(" · ")}</p></section>}
            {profile.skills.length > 0 && <section><h3>{mentor ? "Can help with" : "Skills"}</h3><p>{profile.skills.join(" · ")}</p></section>}
          </div>
        )}
        {profile.proofUrl && (
          <section className="member-profile__work">
            <h3>Selected work</h3>
            {profile.proofNote && <p>{profile.proofNote}</p>}
            <a className="link-btn" href={normalizeLink(profile.proofUrl)} target="_blank" rel="noreferrer">View work <span aria-hidden="true">↗</span></a>
          </section>
        )}
        {links.length > 0 && <nav className="member-profile__links" aria-label="Profile links">
          {links.map((link) => <a key={link.label} href={normalizeLink(link.url ?? "")} target="_blank" rel="noreferrer">{link.label} <span aria-hidden="true">↗</span></a>)}
        </nav>}
      </div>
    </article>
  );
}

export function ProfileModal({ profile, onClose }: { profile: Profile | null | undefined; onClose: () => void }) {
  const visibleProfile = profile?.hidden ? null : profile;
  return (
    <ProfileDialog title={visibleProfile ? `${visibleProfile.name}'s profile` : "Member profile"} onClose={onClose}>
      {visibleProfile ? <ProfileDetails profile={visibleProfile} /> : <p className="empty" role="status">{visibleProfile === undefined ? "Loading profile…" : "This profile is unavailable."}</p>}
    </ProfileDialog>
  );
}
