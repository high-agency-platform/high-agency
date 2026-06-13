"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "../components/AuthProvider";
import { levelOf } from "../lib/gamify";

const NAV = [
  {
    group: "Operate",
    items: [
      {
        href: "/dashboard",
        label: "Home",
        icon: (
          <path d="M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5" />
        ),
      },
      {
        href: "/cohorts",
        label: "Cohorts",
        icon: (
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        ),
      },
    ],
  },
  {
    group: "Sharpen",
    items: [
      {
        href: "/learn",
        label: "Learn",
        icon: (
          <path d="M2 4h7a4 4 0 014 4v12a3 3 0 00-3-3H2V4zm20 0h-7a4 4 0 00-4 4v12a3 3 0 013-3h8V4z" />
        ),
      },
    ],
  },
];

function Sidebar() {
  const { user, profile, logout } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  return (
    <aside className="side">
      <Link href="/dashboard" className="brand side__brand">
        <span className="brand__mark" aria-hidden="true" />
        High Agency
      </Link>

      {NAV.map((g) => (
        <nav key={g.group} className="side__group">
          <span className="side__label">{g.group}</span>
          {g.items.map((it) => {
            const active =
              pathname === it.href ||
              (it.href === "/cohorts" && pathname.startsWith("/cohorts"));
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`side__item ${active ? "side__item--on" : ""}`}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  {it.icon}
                </svg>
                {it.label}
              </Link>
            );
          })}
        </nav>
      ))}

      <div className="side__foot">
        {profile && (
          <div className="side__streak">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M12 2c1 4-4 6-4 11a4 4 0 008 0c0-2-1-3.5-2-5-.5 1.5-2 2-2 2 .5-2.5 0-5.5 0-8z" />
            </svg>
            <span>
              <b>{profile.streak}</b> day streak
            </span>
          </div>
        )}
        <Link
          href="/profile"
          className={`side__me ${pathname === "/profile" ? "side__me--on" : ""}`}
        >
          <span className="side__av">
            {(profile?.name ?? user.displayName ?? "?").slice(0, 1)}
          </span>
          <span className="side__me-meta">
            <b>{profile?.name ?? user.displayName}</b>
            <small>
              {profile
                ? `L${levelOf(profile.xp).level} ${levelOf(profile.xp).name}`
                : "Operator"}
            </small>
          </span>
        </Link>
        <button className="side__out" onClick={logout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/login" || pathname === "/onboarding";

  if (bare) {
    return (
      <>
        <header className="nav">
          <div className="wrap nav__inner">
            <Link href="/" className="brand">
              <span className="brand__mark" aria-hidden="true" />
              High Agency
            </Link>
          </div>
        </header>
        <main className="platform">{children}</main>
      </>
    );
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="shell__main">{children}</main>
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
