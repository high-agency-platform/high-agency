"use client";

import { useEffect, useState } from "react";
import type { Profile } from "../lib/types";
import { watchProfile } from "../lib/db";
import { Avatar } from "./ui";
import { ProfileModal } from "./ProfileModal";

export function MemberButton({ uid, name, onClick }: { uid?: string; name: string; onClick?: () => void }) {
  const [snapshot, setSnapshot] = useState<{ uid: string; profile: Profile | null } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!uid) return;
    return watchProfile(uid, (profile) => setSnapshot({ uid, profile }), () => setSnapshot({ uid, profile: null }));
  }, [uid]);
  const profile = snapshot?.uid === uid ? snapshot?.profile : undefined;
  const content = <><Avatar name={profile?.name ?? name} photoUrl={profile?.photoUrl} size="sm" /><span>{profile?.name ?? name}</span></>;

  return (
    <>
      {uid ? <button type="button" className="member-button" onClick={(e) => { e.currentTarget.focus(); if (onClick) onClick(); else setOpen(true); }} aria-label={`View ${profile?.name ?? name}'s profile`}>{content}</button>
        : <span className="member-button member-button--static">{content}</span>}
      {open && <ProfileModal profile={profile} onClose={() => setOpen(false)} />}
    </>
  );
}
