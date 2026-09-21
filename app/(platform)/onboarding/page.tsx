"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { saveProfile, savePrivateProfile } from "../../lib/db";
import { localDay } from "../../lib/streaks";
import { DOMAINS, SKILLS } from "../../lib/types";
import { COUNTRIES } from "../../lib/countries";
import { ProfilePhoto } from "../../components/ProfilePhoto";
import { Bar } from "../../components/ui";
import type { AgeBand, VentureStage } from "../../lib/types";

const STAGES: { id: VentureStage; label: string }[] = [
  { id: "idea", label: "Just an idea" },
  { id: "building", label: "Building it" },
  { id: "launched", label: "Launched" },
  { id: "revenue", label: "Has revenue" },
];

// Rotating placeholders make it obvious you don't need a polished venture —
// or any venture at all — to belong here.
const HEADLINE_PLACEHOLDERS = [
  "Looking to build the next big thing in ed-tech",
  "Would love to start something in climate",
  "Curious how AI can help students learn",
  "Not sure yet — here to find my thing",
  "Building an AI study planner with 500 users",
];

const BUILDING_PLACEHOLDERS = [
  "No project yet? Say what you'd love to explore.",
  "A spark, a rough idea, or just a direction — all welcome.",
  "The problem, the thing, where it's at — a few lines.",
  "Even \"I want to start something but don't know what\" works.",
];

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
  // null = untouched, so the name suggested by the account can still show through.
  const [firstNameEdit, setFirstName] = useState<string | null>(null);
  const [lastNameEdit, setLastName] = useState<string | null>(null);
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  // ---- Stage 2: operator profile (under 5) ----
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [headline, setHeadline] = useState("");
  const [building, setBuilding] = useState("");
  const [stage, setStage] = useState<VentureStage | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [otherDomainOpen, setOtherDomainOpen] = useState(false);
  const [otherDomain, setOtherDomain] = useState("");
  const otherDomainInvalid = otherDomainOpen && otherDomain.length > 20;
  const [skills, setSkills] = useState<string[]>([]);
  const [proofUrl, setProofUrl] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [bio, setBio] = useState("");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [site, setSite] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Index into the rotating placeholder copy for the headline/building fields.
  const [phIdx, setPhIdx] = useState(0);
  // Set before saving so the "already onboarded" redirect below doesn't
  // race the post-submit redirect into cohort discovery.
  const submitted = useRef(false);

  // Signed out → login. Already onboarded → whichever app is theirs.
  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (profile && !submitted.current) {
      router.replace(profile.role === "mentor" ? "/mentor" : "/dashboard");
    }
  }, [user, profile, router]);

  // Prefill name from the Google account so it rarely has to be typed. The
  // account arrives after first render, so the suggestion is a fallback the
  // fields show until they're touched — not something copied into state later.
  const [suggestedFirst, ...suggestedRest] = (user?.displayName ?? "").split(" ");
  const firstName = firstNameEdit ?? suggestedFirst ?? "";
  const lastName = lastNameEdit ?? suggestedRest.join(" ");

  // Cycle the example placeholders so the prompt reads as "any of these is
  // fine". Honors prefers-reduced-motion by holding on the first example.
  useEffect(() => {
    if (step !== 2) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const t = setInterval(() => setPhIdx((i) => i + 1), 3800);
    return () => clearInterval(t);
  }, [step]);

  const age = useMemo(() => (dob ? ageFrom(dob) : null), [dob]);
  // The stage picker ("Where's it at?") only makes sense once there's a
  // venture to place — asking it of someone with no project is nonsensical
  // and shouldn't gate them out of the season.
  const hasBuilding = building.trim().length > 0;

  function toggle(list: string[], set: (v: string[]) => void, item: string) {
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function nextStep() {
    if (!firstName.trim() || !lastName.trim() || !dob || !country.trim()) {
      setError("Name, date of birth, and country are required.");
      return;
    }
    if (age === null || !Number.isFinite(age) || age < 13 || age > 100) {
      setError("High Agency is for operators 13 and up.");
      return;
    }
    setError("");
    setStep(2);
  }

  async function submit() {
    if (!user || age === null || busy || photoBusy || otherDomainInvalid) return;
    if (hasBuilding && !stage) {
      setError("Pick where you're at — even just an idea counts.");
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
        },
        true
      );

      await saveProfile(
        user.uid,
        {
          name: displayName,
          photoUrl,
          ageBand: bandFor(age),
          country: country.trim(),
          timezone,
          headline: headline.trim(),
          building: building.trim(),
          // No venture described → default to "idea" so the required field
          // stays valid without forcing an unanswerable question.
          stage: hasBuilding && stage ? stage : "idea",
          domains: [...new Set([...domains, ...(otherDomainOpen && otherDomain.trim() ? [otherDomain.trim()] : [])])],
          skills,
          proofUrl: proofUrl.trim(),
          proofNote: proofNote.trim(),
          bio: bio.trim(),
          links: { github: github.trim(), linkedin: linkedin.trim(), site: site.trim() },
          consentStatus: "none",
          plan: "free",
          role: "operator",
          streak: 1,
          streakFreezes: 0,
          lastActiveDay: localDay(),
          lastBuildLogDay: "",
          enrolledWorkshops: [],
        },
        true
      );
      router.replace("/dashboard");
    } catch {
      submitted.current = false;
      setError("Couldn't save. Try again.");
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <section className="ob">
      <div className="ob__bar">
        <span className="micro">{step}/2</span>
        <Bar value={step === 1 ? 0.5 : 1} ember xs />
      </div>

      <h1 className="h1">{step === 1 ? "Who are you?" : "What's your thing?"}</h1>
      <p className="ob__sub">
        {step === 1
          ? "Other members only ever see “First L.” and an age band."
          : "No idea yet is a valid answer. Edit anytime."}
      </p>

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
            <small className="field__hint">Stays private.</small>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="ob-country">Country</label>
              <select
                id="ob-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="" disabled>
                  Pick one
                </option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ob-city">City · optional</label>
              <input
                id="ob-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Toronto"
                maxLength={80}
              />
            </div>
          </div>

          {error && <p className="form-err">{error}</p>}

          <div className="row-actions">
            <button className="btn btn--primary" onClick={nextStep}>
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          <ProfilePhoto name={firstName} value={photoUrl} onChange={setPhotoUrl} onBusy={setPhotoBusy} />
          <div className="field">
            <label htmlFor="ob-headline">Headline · optional</label>
            <input
              id="ob-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={HEADLINE_PLACEHOLDERS[phIdx % HEADLINE_PLACEHOLDERS.length]}
              maxLength={80}
            />
          </div>

          <div className="field">
            <label htmlFor="ob-building">Building · optional</label>
            <textarea
              id="ob-building"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              placeholder={BUILDING_PLACEHOLDERS[phIdx % BUILDING_PLACEHOLDERS.length]}
              maxLength={300}
            />
          </div>

          {hasBuilding && (
            <div className="field">
              <label>Where&apos;s it at?</label>
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
          )}

          <div className="field">
            <label>Domains · optional</label>
            <div className="chip-row">
              {DOMAINS.filter((d) => d !== "Other").map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`pick ${domains.includes(d) ? "sel" : ""}`}
                  onClick={() => toggle(domains, setDomains, d)}
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                className={`pick ${otherDomainOpen ? "sel" : ""}`}
                aria-expanded={otherDomainOpen}
                aria-controls="ob-other-domain"
                onClick={() => setOtherDomainOpen(!otherDomainOpen)}
              >
                Other
              </button>
              {otherDomainOpen && (
                <input
                  id="ob-other-domain"
                  className="ob__other-domain"
                  aria-label="Other domain (optional)"
                  aria-invalid={otherDomainInvalid}
                  aria-describedby={otherDomainInvalid ? "ob-domain-error" : undefined}
                  placeholder="Your domain…"
                  value={otherDomain}
                  onChange={(e) => setOtherDomain(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            {otherDomainInvalid && <small id="ob-domain-error" className="field__count" role="alert">Keep it to 20 characters.</small>}
          </div>

          <div className="field">
            <label>Interests · optional</label>
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
            <label>Links · optional</label>
            <div className="ob__links">
              <input aria-label="GitHub" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="GitHub" maxLength={200} />
              <input aria-label="LinkedIn" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="LinkedIn" maxLength={200} />
              <input aria-label="Personal site" value={site} onChange={(e) => setSite(e.target.value)} placeholder="Personal site" maxLength={200} />
            </div>
          </div>

          <details className="more">
            <summary className="more__toggle">More about you · optional</summary>
            <div className="more__body">
              <div className="field">
                <label>Proof of work · optional</label>
                <input
                  id="ob-proof"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="Link the best thing you've made"
                  maxLength={300}
                />
                <input
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  placeholder="Why it matters — one line"
                  maxLength={200}
                />
              </div>

              <div className="field">
                <label htmlFor="ob-bio">Bio · optional</label>
                <textarea
                  id="ob-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Personality, not résumé"
                  maxLength={300}
                />
              </div>


            </div>
          </details>

          {error && <p className="form-err">{error}</p>}

          <div className="row-actions">
            <button className="btn btn--ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn btn--primary" onClick={submit} disabled={busy || photoBusy || otherDomainInvalid}>
              {busy ? "…" : "Start the season"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
