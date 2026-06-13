"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { saveProfile } from "../../lib/db";
import { levelOf, localDay } from "../../lib/gamify";
import { DOMAINS, SKILLS } from "../../lib/types";
import type { VentureStage, WeeklyHours } from "../../lib/types";

const STAGES: { id: VentureStage; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "building", label: "Building" },
  { id: "launched", label: "Launched" },
  { id: "revenue", label: "Revenue" },
];

const HOURS: WeeklyHours[] = ["<3", "3-5", "5-10", "10+"];

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [headline, setHeadline] = useState("");
  const [building, setBuilding] = useState("");
  const [stage, setStage] = useState<VentureStage>("idea");
  const [domains, setDomains] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [proofUrl, setProofUrl] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [hours, setHours] = useState<WeeklyHours>("3-5");
  const [bio, setBio] = useState("");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [site, setSite] = useState("");

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (user && profile === null) router.replace("/onboarding");
  }, [user, profile, router]);

  useEffect(() => {
    if (profile && !loaded) {
      setHeadline(profile.headline ?? "");
      setBuilding(profile.building ?? "");
      setStage(profile.stage ?? "idea");
      setDomains(profile.domains ?? []);
      setSkills(profile.skills ?? []);
      setProofUrl(profile.proofUrl ?? "");
      setProofNote(profile.proofNote ?? "");
      setHours(profile.hours ?? "3-5");
      setBio(profile.bio ?? "");
      setGithub(profile.links?.github ?? "");
      setLinkedin(profile.links?.linkedin ?? "");
      setSite(profile.links?.site ?? "");
      setLoaded(true);
    }
  }, [profile, loaded]);

  function toggle(list: string[], set: (v: string[]) => void, item: string) {
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  async function submit() {
    if (!user || !profile) return;
    if (!headline.trim() || !building.trim() || domains.length === 0 || skills.length === 0) {
      setError("Headline, what you're building, a domain, and a skill — minimum.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // The security rule validates the whole merged document, so we write
      // a complete, valid profile: edited fields plus the existing
      // identity/gamification fields. This also self-heals any profile
      // doc that predates a field (e.g. an empty lastActiveDay).
      await saveProfile(
        user.uid,
        {
          name: profile.name,
          ageBand: profile.ageBand,
          country: profile.country,
          timezone: profile.timezone,
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
          consentStatus: profile.consentStatus,
          xp: profile.xp,
          streak: profile.streak,
          streakFreezes: profile.streakFreezes,
          lastActiveDay: profile.lastActiveDay?.length === 10 ? profile.lastActiveDay : localDay(),
          lastBuildLogDay: profile.lastBuildLogDay ?? "",
          lastRitualWeek: profile.lastRitualWeek ?? "",
          enrolledWorkshops: profile.enrolledWorkshops,
          attendedWorkshops: profile.attendedWorkshops,
          pendingApplications: profile.pendingApplications,
        },
        false
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error("saveProfile failed:", e);
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!user || !profile) return null;

  const lvl = levelOf(profile.xp);

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead__index">
          <span className="eyebrow">
            <span className="dot" /> L{lvl.level} {lvl.name} · {profile.xp} XP
          </span>
          <span className="masthead__meta">
            {profile.ageBand} · <b>{profile.country}</b>
          </span>
        </div>
        <h1 className="masthead__title">{profile.name}</h1>
        <div className="masthead__sub">
          <p className="lead">
            This is what squads see when you apply. Your exact age, full name,
            and city stay private — always.
          </p>
        </div>
      </header>

      <div className="onboard__inner">
        <div className="field">
          <label htmlFor="pf-headline">Headline</label>
          <input
            id="pf-headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="field">
          <label htmlFor="pf-building">What are you building?</label>
          <textarea
            id="pf-building"
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
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
          <label>Skills</label>
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
          <label htmlFor="pf-proof">Proof of work</label>
          <input
            id="pf-proof"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder="Link the best thing you've ever made or done"
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
          <label>Weekly hours</label>
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
          <label htmlFor="pf-bio">Short bio</label>
          <textarea
            id="pf-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
          />
        </div>

        <div className="field">
          <label>Links</label>
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

        <button
          className="btn btn--primary onboard__submit"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "Saving…" : saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
