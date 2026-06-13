"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase";
import { watchProfile } from "../lib/db";
import type { Profile } from "../lib/types";

interface AuthState {
  /** undefined = still resolving, null = signed out */
  user: User | null | undefined;
  /** undefined = still resolving, null = signed in but not onboarded */
  profile: Profile | null | undefined;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      if (!u) setProfile(null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    setProfile(undefined);
    return watchProfile(user.uid, setProfile);
  }, [user]);

  const logout = () => signOut(getFirebaseAuth());

  return (
    <AuthContext.Provider value={{ user, profile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
