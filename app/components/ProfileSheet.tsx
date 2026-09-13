"use client";

import { useState } from "react";
import type { Profile } from "../lib/types";
import { useAuth } from "./AuthProvider";
import { ProfileCard } from "./ProfileCard";
import { ProfileDetails, ProfileDialog } from "./ProfileModal";

export function ProfileSheet({ uid, profile, onClose }: { uid: string; profile: Profile; onClose: () => void }) {
  const { logout } = useAuth();
  const [editing, setEditing] = useState(false);
  return (
    <ProfileDialog title={editing ? "Edit your profile" : "Your profile"} onClose={onClose}>
      {editing ? <ProfileCard key={uid} uid={uid} profile={profile} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} /> : <>
        <ProfileDetails profile={profile} />
        <div className="profile-owner-meta"><span>{profile.streak}-day streak</span>{profile.streakFreezes > 0 && <span>{profile.streakFreezes} freezes</span>}</div>
        <div className="profile-actions"><button type="button" className="link-btn" onClick={logout}>Sign out</button><button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>Edit profile</button></div>
      </>}
    </ProfileDialog>
  );
}
