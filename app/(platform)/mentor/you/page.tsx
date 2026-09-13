"use client";

import { useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { useMentorGate } from "../../../components/mentorData";
import { CalendarConnect } from "../../../components/CalendarConnect";
import { ProfileCard } from "../../../components/ProfileCard";
import { ProfileDetails } from "../../../components/ProfileModal";

export default function MentorYouPage() {
  const { user, profile } = useMentorGate();
  const { logout } = useAuth();
  const [editing, setEditing] = useState(false);
  if (!user || !profile) return null;

  return (
    <div className="screen mentor-profile-page">
      <section className="tile">
        {editing ? <ProfileCard key={user.uid} uid={user.uid} profile={profile} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} /> : <>
          <ProfileDetails profile={profile} />
          <div className="profile-actions"><button className="link-btn" onClick={logout}>Sign out</button><button className="btn btn--primary" onClick={() => setEditing(true)}>Edit profile</button></div>
        </>}
      </section>
      <CalendarConnect returnTo="/mentor/you" />
    </div>
  );
}
