"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "../components/AuthProvider";
import {
  Hud,
  HomeIcon,
  SquadIcon,
  ZapIcon,
  UserIcon,
  WrenchIcon,
} from "../components/ui";

const TABS = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/cohorts", label: "Squads", icon: SquadIcon },
  { href: "/learn", label: "Learn", icon: ZapIcon },
  { href: "/profile", label: "You", icon: UserIcon },
];

function useTabs() {
  const { profile } = useAuth();
  const pathname = usePathname();
  const tabs =
    profile?.role === "mentor"
      ? [...TABS, { href: "/admin", label: "Admin", icon: WrenchIcon }]
      : TABS;
  const isOn = (href: string) =>
    pathname === href || (href === "/cohorts" && pathname.startsWith("/cohorts"));
  return { tabs, isOn };
}

/** Desktop: slim left rail — logo, icon tabs, HUD at the bottom. */
function Rail() {
  const { profile, logout } = useAuth();
  const { tabs, isOn } = useTabs();

  return (
    <aside className="rail">
      <Link href="/dashboard" className="rail__logo" aria-label="High Agency home">
        H
      </Link>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rail__tab ${isOn(t.href) ? "rail__tab--on" : ""}`}
        >
          <t.icon />
          {t.label}
        </Link>
      ))}
      <div className="rail__foot">
        {profile && <Hud profile={profile} col />}
        <button className="rail__out" onClick={logout}>
          Exit
        </button>
      </div>
    </aside>
  );
}

/** Mobile: sticky top bar with brand + HUD. */
function TopBar() {
  const { profile } = useAuth();
  return (
    <header className="topbar">
      <Link href="/dashboard" className="topbar__logo" aria-label="High Agency home">
        H
      </Link>
      {profile && <Hud profile={profile} />}
    </header>
  );
}

/** Mobile: fixed bottom tab bar — the game console controls. */
function TabBar() {
  const { tabs, isOn } = useTabs();
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`tabbar__tab ${isOn(t.href) ? "tabbar__tab--on" : ""}`}
        >
          <t.icon />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const bare = pathname === "/login" || pathname === "/onboarding";

  if (bare || !user) return <main>{children}</main>;

  return (
    <div className="shell">
      <Rail />
      <div className="shell__main">
        <TopBar />
        <main>{children}</main>
      </div>
      <TabBar />
    </div>
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
