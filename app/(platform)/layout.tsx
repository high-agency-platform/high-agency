"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { AuthProvider, useAuth } from "../components/AuthProvider";
import { MemberWorkspace } from "../components/MemberWorkspace";
import { ProfileSheet } from "../components/ProfileSheet";
import type { Profile } from "../lib/types";
import {
  Hud,
  Avatar,
  HomeIcon,
  PathIcon,
  UserIcon,
  CalendarIcon,
} from "../components/ui";

type Tab = {
  href: string;
  label: string;
  icon: (p: { size?: number }) => React.ReactElement;
};

/** Mentors: the job. Home is the queue, Track is the season they write,
 *  Workshops is the calendar, You is their card + Google connection. */
const MENTOR_TABS: Tab[] = [
  { href: "/mentor", label: "Home", icon: HomeIcon },
  { href: "/mentor/track", label: "Track", icon: PathIcon },
  { href: "/mentor/workshops", label: "Workshops", icon: CalendarIcon },
  { href: "/mentor/you", label: "You", icon: UserIcon },
];

/* ------------------------------------------------------------------ */
/* Mentor shell — rail on desktop, top bar + tab bar on mobile          */
/* ------------------------------------------------------------------ */

function Rail() {
  const { logout } = useAuth();
  const pathname = usePathname();
  return (
    <aside className="rail">
      <Link href="/mentor" className="rail__logo" aria-label="High Agency home">
        <img src="/brand/high-agency-mark.svg" alt="" />
      </Link>
      {MENTOR_TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`rail__tab ${pathname === t.href ? "rail__tab--on" : ""}`}>
          <t.icon />
          {t.label}
        </Link>
      ))}
      <div className="rail__foot">
        <button className="rail__out" onClick={logout}>
          Exit
        </button>
      </div>
    </aside>
  );
}

function MentorTopBar() {
  return (
    <header className="topbar">
      <Link href="/mentor" className="topbar__logo" aria-label="High Agency home">
        <img src="/brand/high-agency-mark.svg" alt="" />
      </Link>
    </header>
  );
}

function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar">
      {MENTOR_TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`tabbar__tab ${pathname === t.href ? "tabbar__tab--on" : ""}`}>
          <t.icon />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Operator shell — one page, no navigation                            */
/* ------------------------------------------------------------------ */

// `?you=1` opens the card sheet on arrival (onboarding and the consent flow
// deep-link to it). Read once, at first render, through a module latch — a
// store, not an effect writing state.
let landedYou: boolean | null = null;
function readLandedYou(): boolean {
  if (landedYou === null) {
    landedYou = new URL(window.location.href).searchParams.get("you") === "1";
  }
  return landedYou;
}

/** The only chrome an operator gets: brand, the flame, their avatar. Shown at
 *  every width — there is no rail and no tab bar, because there is nowhere
 *  else to go. */
function OperatorShell({
  uid,
  profile,
  children,
}: {
  uid: string;
  profile: Profile;
  children: React.ReactNode;
}) {
  const landed = useSyncExternalStore(() => () => {}, readLandedYou, () => false);
  const [youEdit, setYouEdit] = useState<boolean | null>(null);
  const you = youEdit ?? landed;

  function close() {
    setYouEdit(false);
    const u = new URL(window.location.href);
    if (u.searchParams.has("you")) {
      u.searchParams.delete("you");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
  }

  return (
    <div className="solo">
      <header className="topbar topbar--solo">
        <Link href="/dashboard" className="topbar__logo" aria-label="High Agency home">
          <img src="/brand/high-agency-mark.svg" alt="" />
        </Link>
        <div className="topbar__right">
          <Hud profile={profile} />
          <button type="button" className="topbar__you" onClick={(e) => { e.currentTarget.focus(); setYouEdit(true); }} aria-label="Your card">
            <Avatar name={profile.name} photoUrl={profile.photoUrl} />
          </button>
        </div>
      </header>
      <MemberWorkspace>{children}</MemberWorkspace>
      {you && <ProfileSheet uid={uid} profile={profile} onClose={close} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Shell({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  // Sign-in, onboarding and the invite-only mentor signup render bare: each
  // completes a flow the shell would otherwise appear in the middle of.
  const bare =
    pathname === "/qa" ||
    pathname === "/join" ||
    pathname === "/login" ||
    pathname === "/login/verify" ||
    pathname === "/onboarding" ||
    pathname === "/mentor/join";

  if (bare || !user || !profile) return <main>{children}</main>;

  if (profile.role === "mentor") {
    return (
      <div className="shell">
        <Rail />
        <div className="shell__main">
          <MentorTopBar />
          <MemberWorkspace>{children}</MemberWorkspace>
        </div>
        <TabBar />
      </div>
    );
  }

  return (
    <OperatorShell uid={user.uid} profile={profile}>
      {children}
    </OperatorShell>
  );
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
