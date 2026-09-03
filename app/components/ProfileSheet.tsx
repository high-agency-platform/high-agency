"use client";

/* Your card, as a sheet over the operator page. Opens from the avatar in the
   top bar (or `?you=1`); closing it leaves you exactly where you were. */

import type { Profile } from "../lib/types";
import { ProfileCard } from "./ProfileCard";

export function ProfileSheet({
  uid,
  profile,
  onClose,
}: {
  uid: string;
  profile: Profile;
  onClose: () => void;
}) {
  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-label="Your card">
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__card modal__card--wide modal__card--sheet">
        <button className="modal__close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <ProfileCard key={uid} uid={uid} profile={profile} />
      </div>
    </div>
  );
}
