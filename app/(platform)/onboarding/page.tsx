"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { saveProfile, savePrivateProfile } from "../../lib/db";
import { localDay } from "../../lib/gamify";
import { DOMAINS, SKILLS } from "../../lib/types";
import type { AgeBand, VentureStage, WeeklyHours } from "../../lib/types";

const STAGES: { id: VentureStage; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "building", label: "Building" },
  { id: "launched", label: "Launched" },
  { id: "revenue", label: "Revenue" },
];

const HOURS: WeeklyHours[] = ["<3", "3-5", "5-10", "10+"];

function ageFrom(dob: string): number {
  const d = new Date(dob + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function bandFor(age: number): AgeBand {
  return age <= 15 ? "13-15" : age <= 17 ? "16-17" : "18+";
}

export default function OnboardingPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);

  // ---- Stage 1: signup basics (under 2 minutes) ----
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [parentEmail, setParentEmail] = useState("");

  // ---- Stage 2: operator profile (under 5) ----
  const [headline, setHeadline] = useState("");
  const [building, setBuilding] = useState("");
  const [stage, setStage] = useState<VentureStage | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [proofUrl, setProofUrl] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [hours, setHours] = useState<WeeklyHours | null>(null);
  const [bio, setBio] = useState("");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [site, setSite] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Set before saving so the "already onboarded" redirect below doesn't
  // race the post-submit redirect into cohort discovery.
  const submitted = useRef(false);

  // Signed out → login. Already onboarded → dashboard.
  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (profile && !submitted.current) router.replace("/dashboard");
  }, [user, profile, router]);

  // Prefill name from the Google account so it rarely has to be typed.
  useEffect(() => {
    if (user?.displayName) {
      const [first, ...rest] = user.displayName.split(" ");
      setFirstName((n) => n || first);
      setLastName((n) => n || rest.join(" "));
    }
  }, [user]);

  const age = useMemo(() => (dob ? ageFrom(dob) : null), [dob]);
  const isMinor = age !== null && age < 18;

  function toggle(list: string[], set: (v: string[]) => void, item: string) {
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function nextStep() {
    if (!firstName.trim() || !lastName.trim() || !dob || !country.trim()) {
      setError("Name, date of birth, and country are required.");
      return;
    }
    if (age !== null && age < 13) {
      setError("High Agency is for operators 13 and up.");
      return;
    }
    if (isMinor && !parentEmail.trim()) {
      setError("Under 18 needs a parent or guardian email for consent.");
      return;
    }
    setError("");
    setStep(2);
  }

  async function submit() {
    if (!user || age === null) return;
    if (!headline.trim() || !building.trim() || !stage || !hours) {
      setError("Headline, what you're building, stage, and weekly hours are required.");
      return;
    }
    if (domains.length === 0 || skills.length === 0) {
      setError("Pick at least one domain and one skill.");
      return;
    }
    setBusy(true);
    setError("");
    submitted.current = true;
    try {
      // Privacy by construction: the public display name is "First L."
      const displayName = `${firstName.trim()} ${lastName.trim().slice(0, 1).toUpperCase()}.`;
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      await savePrivateProfile(
        user.uid,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dob,
          city: city.trim(),
          parentEmail: isMinor ? parentEmail.trim() : "",
        },
        true
      );

      await saveProfile(
        user.uid,
        {
          name: displayName,
          ageBand: bandFor(age),
          country: country.trim(),
          timezone,
          headline: headline.trim(),
          building: building.trim(),
          stage,
          domains,
          skills,
          proofUrl: proofUrl.trim(),
          proofNote: proofNote.trim(),
          hours,
          bio: bio.trim(),
          links: { github: github.trim(), linkedin: linkedin.trim(), site: site.trim() },
          consentStatus: isMinor ? "pending" : "granted",
          plan: "free",
          role: "operator",
          xp: 0,
          streak: 1,
          streakFreezes: 0,
          lastActiveDay: localDay(),
          lastBuildLogDay: "",
          lastRitualWeek: "",
          enrolledWorkshops: [],
          attendedWorkshops: [],
          pendingApplications: [],
        },
        true
      );
      // Never land on an empty dashboard — straight into discovery
      // with matches pre-loaded.
      router.replace("/cohorts");
    } catch {
      submitted.current = false;
      setError("Couldn't save. Try again.");
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <section className="onboard wrap">
      <div className="onboard__inner">
        <span className="eyebrow">
          <span className="dot" /> {step === 1 ? "Step 1 of 2 — the basics" : "Step 2 of 2 — operator profile"}
        </span>
        <h1 className="h2">
          {step === 1 ? "Who are you?" : "What are you building?"}
        </h1>
        <p className="lead onboard__lead">
          {step === 1
            ? "Two minutes. We show your age as a band and your name as “First L.” — never more."
            : "This is the profile squads see when you apply. Every field feeds matching."}
        </p>

        <div className="onboard__progress" aria-hidden="true">
          <i style={{ width: step === 1 ? "50%" : "100%" }} />
        </div>

        {step === 1 ? (
          <>
            <div className="field-row">
              <div className="field">
                <label htmlFor="ob-first">First name</label>
                <input
                  id="ob-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ada"
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label htmlFor="ob-last">Last name</label>
                <input
                  id="ob-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Lovelace"
                  maxLength={60}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="ob-dob">Date of birth</label>
              <input
                id="ob-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={localDay()}
              />
              <small className="field__hint">
                Stored privately. Others only ever see an age band.
              </small>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="ob-country">Country</label>
                <input
                  id="ob-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Canada"
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label htmlFor="ob-city">City (optional, private)</label>
                <input
                  id="ob-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Toronto"
                  maxLength={80}
                />
              </div>
            </div>

            {isMinor && (
              <div className="field">
                <label htmlFor="ob-parent">Parent or guardian email</label>
                <input
                  id="ob-parent"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@email.com"
                  maxLength={254}
                />
                <small className="field__hint">
                  We&apos;ll send them a consent request. Community access stays
                  limited until they approve.
                </small>
              </div>
            )}

            {error && <p className="form-err">{error}</p>}

            <button className="btn btn--primary onboard__submit" onClick={nextStep}>
              Continue
            </button>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="ob-headline">Headline — your one-line hook</label>
              <input
                id="ob-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Building an AI study planner with 500 users"
                maxLength={80}
              />
            </div>

            <div className="field">
              <label htmlFor="ob-building">
                What are you building / want to build?
              </label>
              <textarea
                id="ob-building"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="The problem, the thing, where it's at — a few lines."
                maxLength={300}
              />
              <div className="chip-row">
                {STAGES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`pick ${stage === s.id ? "sel" : ""}`}
                    onClick={() => setStage(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Domains</label>
              <div className="chip-row">
                {DOMAINS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`pick ${domains.includes(d) ? "sel" : ""}`}
                    onClick={() => toggle(domains, setDomains, d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Skills — what can you do for a squad?</label>
              <div className="chip-row">
                {SKILLS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pick ${skills.includes(s) ? "sel" : ""}`}
                    onClick={() => toggle(skills, setSkills, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="ob-proof">
                Proof of work — the best thing you&apos;ve ever made or done
              </label>
              <input
                id="ob-proof"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="Link it (optional but it does the talking)"
                maxLength={300}
              />
              <input
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                placeholder="One sentence on why it matters"
                maxLength={200}
              />
            </div>

            <div className="field">
              <label>Weekly hours you can actually commit</label>
              <div className="chip-row">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`pick ${hours === h ? "sel" : ""}`}
                    onClick={() => setHours(h)}
                  >
                    {h === "<3" ? "Under 3" : h}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="ob-bio">Short bio — personality, not résumé (optional)</label>
              <textarea
                id="ob-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
              />
            </div>

            <div className="field">
              <label>Links (optional)</label>
              <input
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="GitHub"
                maxLength={200}
              />
              <input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="LinkedIn"
                maxLength={200}
              />
              <input
                value={site}
                onChange={(e) => setSite(e.target.value)}
                placeholder="Personal site"
                maxLength={200}
              />
            </div>

            {error && <p className="form-err">{error}</p>}

            <div className="row-actions">
              <button className="btn btn--ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="btn btn--primary onboard__submit"
                onClick={submit}
                disabled={busy}
              >
                {busy ? "Saving…" : "Find my squad"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
