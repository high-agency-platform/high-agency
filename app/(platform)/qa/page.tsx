"use client";
import { notFound } from "next/navigation";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { ACCESS_EMAIL_KEY } from "../../lib/accessClient";

export default function QaPage() {
  const [error, setError] = useState("");
  if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_FIREBASE_EMULATORS !== "true") notFound();
  async function open(role: string) {
    const response = await fetch("/api/access/qa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    if (!response.ok) { setError("Start the isolated QA stack with npm run dev:qa."); return; }
    const data = await response.json();
    if (role === "invite") await signOut(getFirebaseAuth());
    if (data.email) localStorage.setItem(ACCESS_EMAIL_KEY, data.email);
    window.location.assign(data.url);
  }
  return <section className="gate"><div className="gate__inner"><span className="micro">Local emulators only</span><h1 className="h1">Season 1 QA</h1><p className="gate__sub">Synthetic accounts. No production data or email.</p><div className="stack"><button className="btn btn--primary" onClick={() => open("operator")}>Student view</button><button className="btn btn--ghost" onClick={() => open("mentor")}>Mentor view</button><button className="btn btn--ghost" onClick={() => open("invite")}>Test onboarding</button></div>{error && <p role="alert">{error}</p>}</div></section>;
}
