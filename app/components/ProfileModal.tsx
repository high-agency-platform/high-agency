"use client";

/* Full public-profile overlay — the artifact an operator is judged by.
   Used by the squad roster (reading members before applying) and by the
   founder's application review on the cohort page. Renders only Profile
   fields (privacy-lean by construction — never PrivateProfile data). */

import type { Profile, WeeklyHours } from "../lib/types";
import { Avatar } from "./ui";

export function ProfileModal({
  profile,
  hours,
  onClose,
}: {
  profile: Profile;
  /** Squad-specific weekly commitment (from an application), if known. */
  hours?: WeeklyHours;
  onClose: () => void;
}) {
  return (
    <div className="modal open" role="dialog" aria-modal="true">
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__card">
        <button className="modal__close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <Avatar name={profile.name} size="lg" />
          <div>
            <h3 style={{ marginBottom: 0 }}>{profile.name}</h3>
            <span className="micro">
              {profile.ageBand} · {profile.country}
              {hours ? ` · ${hours}h/wk` : ""} · {profile.stage}
            </span>
          </div>
        </div>
        {profile.headline && (
          <p style={{ fontWeight: 700, marginBottom: 14 }}>{profile.headline}</p>
        )}
        {profile.building && (
          <div className="field">
            <label>Building</label>
            <p className="muted" style={{ fontSize: 15 }}>{profile.building}</p>
          </div>
        )}
        {profile.proofUrl && (
          <div className="field">
            <label>Proof</label>
            <p style={{ fontSize: 15 }}>
              <a href={profile.proofUrl} target="_blank" rel="noreferrer" className="link-btn">
                {profile.proofUrl}
              </a>
              {profile.proofNote && <span className="muted"> — {profile.proofNote}</span>}
            </p>
          </div>
        )}
        <div className="field">
          <label>Into</label>
          <div className="chip-row">
            {profile.skills.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
        </div>
        {profile.bio && (
          <div className="field">
            <label>Bio</label>
            <p className="muted" style={{ fontSize: 15 }}>{profile.bio}</p>
          </div>
        )}
      </div>
    </div>
  );
}
