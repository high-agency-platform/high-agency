"use client";

/* Shared editor; role-specific fields stay inside the same public profile. */

import { useState } from "react";
import { saveProfile } from "../lib/db";
import { DOMAINS, SKILLS } from "../lib/types";
import { ProfilePhoto } from "./ProfilePhoto";
import { TagField, MAX_EXPERTISE, MAX_COACH } from "./TagField";
import type { Profile, VentureStage } from "../lib/types";

const STAGES: { id: VentureStage; label: string }[] = [
  { id: "idea", label: "Just an idea" },
  { id: "building", label: "Building it" },
  { id: "launched", label: "Launched" },
  { id: "revenue", label: "Has revenue" },
];

export function ProfileCard({ uid, profile, onSaved, onCancel }: { uid: string; profile: Profile; onSaved: () => void; onCancel: () => void }) {
  const mentor = profile.role === "mentor";
  const [section, setSection] = useState("about");
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl ?? "");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [building, setBuilding] = useState(profile.building ?? "");
  const [stage, setStage] = useState<VentureStage>(profile.stage ?? "idea");
  const [domains, setDomains] = useState<string[]>(profile.domains ?? []);
  const [skills, setSkills] = useState<string[]>(profile.skills ?? []);
  const [proofUrl, setProofUrl] = useState(profile.proofUrl ?? "");
  const [proofNote, setProofNote] = useState(profile.proofNote ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [github, setGithub] = useState(profile.links?.github ?? "");
  const [linkedin, setLinkedin] = useState(profile.links?.linkedin ?? "");
  const [site, setSite] = useState(profile.links?.site ?? "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy || photoBusy) return;
    if (!headline.trim() || (!mentor && !building.trim())) {
      setSection("about");
      setError(mentor ? "Add a headline." : "Add a headline and what you're building.");
      return;
    }
    if (domains.length === 0 || skills.length === 0) {
      setSection("focus");
      setError(mentor ? "Choose an area of expertise and something you can coach." : "Choose an interest and a skill.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveProfile(
        uid,
        {
          ...(photoUrl !== (profile.photoUrl ?? "") ? { photoUrl } : {}),
          headline: headline.trim(),
          building: building.trim(),
          stage,
          domains,
          skills,
          proofUrl: proofUrl.trim(),
          proofNote: proofNote.trim(),
          bio: bio.trim(),
          links: { github: github.trim(), linkedin: linkedin.trim(), site: site.trim() },
        },
        false
      );
      onSaved();
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="profile-editor" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <header className="profile-editor__head">
        <span className="micro">{profile.name}</span>
        <h2>Edit profile</h2>
      </header>
      <nav className="profile-editor__nav" aria-label="Profile sections">
        {["about", "focus", "links"].map((tab) => <button type="button" key={tab} aria-pressed={section === tab} onClick={() => setSection(tab)}>{tab === "about" ? "About you" : tab === "focus" ? "Focus" : "Work & links"}</button>)}
      </nav>
      <section hidden={section !== "about"} className="profile-editor__section">
        <ProfilePhoto name={profile.name} value={photoUrl} onChange={setPhotoUrl} onBusy={setPhotoBusy} />
        <div className="field">
          <label htmlFor="pf-headline">Headline</label>
          <input id="pf-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={90} autoFocus placeholder={mentor ? "What you do and where you've done it" : "A little about you"} />
        </div>
        <div className="field">
          <label htmlFor="pf-building">{mentor ? "Working on" : "Building"}</label>
          <textarea id="pf-building" value={building} onChange={(e) => setBuilding(e.target.value)} maxLength={300} />
        </div>
        {!mentor && <div className="field"><label htmlFor="pf-stage">Stage</label><select id="pf-stage" value={stage} onChange={(e) => setStage(e.target.value as VentureStage)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>}
        <div className="field"><label htmlFor="pf-bio">About you</label><textarea id="pf-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} placeholder="Optional" /></div>
      </section>
      <section hidden={section !== "focus"} className="profile-editor__section">
        <TagField label={mentor ? "Expertise" : "Interests"} presets={DOMAINS.filter((d) => d !== "Other")} value={domains} max={MAX_EXPERTISE} onChange={setDomains} />
        <TagField label={mentor ? "Can coach" : "Skills"} presets={SKILLS} value={skills} max={MAX_COACH} onChange={setSkills} />
      </section>
      <section hidden={section !== "links"} className="profile-editor__section">
        <div className="field">
          <label htmlFor="pf-proof">Selected work</label>
          <input id="pf-proof" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="Link something you've made" maxLength={300} />
          <input aria-label="About your selected work" value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="What should we know about it?" maxLength={200} />
        </div>
        <div className="field"><label htmlFor="pf-site">Website</label><input id="pf-site" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" maxLength={200} /></div>
        <div className="field"><label htmlFor="pf-linkedin">LinkedIn</label><input id="pf-linkedin" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/" maxLength={200} /></div>
        <div className="field"><label htmlFor="pf-github">GitHub</label><input id="pf-github" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/" maxLength={200} /></div>
      </section>
      <footer className="profile-editor__footer">
        {error && <p className="form-err" role="alert">{error}</p>}
        <div className="row-actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy || photoBusy}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </footer>
    </form>
  );
}
