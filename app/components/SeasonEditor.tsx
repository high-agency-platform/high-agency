"use client";

/* The mentor's editor for THE season — one shared document. Structurally the
   old squad-track editor: the live doc shows through until the first edit
   forks a local draft; Save sends the whole thing. Two things are new:
   - the save quotes the updatedAt it read (`base`), so a second mentor's
     concurrent save is refused as stale instead of silently clobbered;
   - a step that already has proof can't be removed (the server refuses it
     too), and changing who reviews it is flagged. */

import { useState } from "react";
import type { Season, SeasonMilestone, SeasonState, Verifier } from "../lib/types";
import {
  SEASON_MAX_MILESTONES,
  SEASON_NAME_MAX,
  SEASON_CATEGORY_MAX,
  SEASON_DURATION_MAX,
  SEASON_TAGLINE_MAX,
  SEASON_OVERVIEW_MAX,
  SEASON_OUTCOME_MAX,
  MILESTONE_TITLE_MAX,
  MILESTONE_WHY_MAX,
  MILESTONE_PROOF_MAX,
  MILESTONE_SESSIONS_MAX,
  milestoneId,
  milestoneReleased,
} from "../lib/types";
import { saveSeason, setMilestoneRelease } from "../lib/api";
import { PlusIcon, CheckIcon } from "./ui";

interface Draft {
  name: string;
  kind: string;
  category: string;
  duration: string;
  tagline: string;
  overview: string;
  outcome: string;
  state: SeasonState;
  milestones: SeasonMilestone[];
  /** The updatedAt (ms) the draft forked from — the stale-write token. */
  base: number | null;
}

function fromSeason(s: Season | null): Draft {
  return {
    name: s?.name ?? "",
    kind: s?.kind ?? "foundation",
    category: s?.category ?? "",
    duration: s?.duration ?? "",
    tagline: s?.tagline ?? "",
    overview: s?.overview ?? "",
    outcome: s?.outcome ?? "",
    state: s?.state ?? "live",
    milestones: s?.milestones.map((m, i) => ({ ...m, released: milestoneReleased(m, i) })) ?? [],
    base: s?.updatedAt?.toMillis() ?? null,
  };
}

const ERRORS: Record<string, string> = {
  "stale-write": "Someone else saved the track first. Reload to see it, then redo your change.",
  "milestone-has-submissions": "This step has student progress and cannot be removed or hidden.",
  "name-required": "Give the season a name.",
  "too-many-milestones": `That's more than ${SEASON_MAX_MILESTONES} steps.`,
};

const STATES: { id: SeasonState; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "live", label: "Live" },
  { id: "archived", label: "Archived" },
];

export function SeasonEditor({
  season,
  submittedIds,
}: {
  season: Season | null;
  /** Milestone ids that already have proof against them. */
  submittedIds: Set<string>;
}) {
  const [edits, setEdits] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const live = fromSeason(season);
  const baseline = saved && (saved.base ?? 0) > (live.base ?? 0) ? saved : live;
  const draft = edits ?? baseline;
  const dirty = edits !== null;

  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  function edit(p: Partial<Draft>) {
    setFlash("");
    setError("");
    setEdits({ ...draft, ...p });
  }

  function patch(id: string, p: Partial<SeasonMilestone>) {
    edit({ milestones: draft.milestones.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= draft.milestones.length) return;
    const next = [...draft.milestones];
    [next[i], next[j]] = [next[j], next[i]];
    edit({ milestones: next });
  }

  function add() {
    if (draft.milestones.length >= SEASON_MAX_MILESTONES) return;
    const m: SeasonMilestone = {
      id: milestoneId(),
      title: "",
      why: "",
      proof: "",
      proofRequired: false,
      effort: "",
      verifier: "mentor",
      released: false,
      sessions: [],
    };
    edit({ milestones: [...draft.milestones, m] });
    setOpen(m.id);
  }

  async function release(id: string, released: boolean) {
    if (!season || busy) return;
    setBusy(true);
    setReleasing(id);
    setError("");
    setFlash("");
    try {
      const result = await setMilestoneRelease({ seasonId: season.id, milestoneId: id, released, expectedUpdatedAt: draft.base });
      const update = (d: Draft): Draft => ({ ...d, base: result.updatedAt, milestones: d.milestones.map(m => m.id === id ? { ...m, released } : m) });
      setSaved(update(baseline));
      if (edits) setEdits(update(draft));
      setFlash(released ? "Milestone released. Students can access it when the season is live." : "Milestone hidden from students.");
    } catch (e) {
      setError(ERRORS[(e as Error).message] ?? "Couldn't update the release. Try again.");
    } finally {
      setReleasing(null);
      setBusy(false);
    }
  }

  async function persist() {
    setBusy(true);
    setError("");
    setFlash("");
    try {
      const milestones = draft.milestones.map(m => ({ ...m, title: m.title.trim(), sessions: m.sessions.map(s => s.trim()).filter(Boolean) })).filter(m => m.title);
      const result = await saveSeason({
        seasonId: season?.id,
        expectedUpdatedAt: draft.base,
        name: draft.name,
        kind: draft.kind,
        category: draft.category,
        duration: draft.duration,
        tagline: draft.tagline,
        overview: draft.overview,
        outcome: draft.outcome,
        state: draft.state,
        milestones,
      });
      setSaved({ ...draft, milestones, base: result.updatedAt });
      setEdits(null);
      setFlash("Saved — released milestones are visible to students.");
      setTimeout(() => setFlash(""), 3500);
    } catch (e) {
      setError(ERRORS[(e as Error).message] ?? "Couldn't save the track. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="stack track-editor" disabled={busy}>
      {/* ---- The season itself ---- */}
      <section className="tile">
        <div className="tile__head">
          <h2 className="h3">Season details</h2>
          <span className="micro">
            {season
              ? `last saved${season.updatedByName ? ` by ${season.updatedByName}` : ""}`
              : "nothing saved yet"}
          </span>
        </div>
        <p className="field__hint">The introduction students see above their milestones.</p>
        <div className="field">
          <label htmlFor="se-name">Name</label>
          <input
            id="se-name"
            value={draft.name}
            onChange={(e) => edit({ name: e.target.value })}
            placeholder="Developing High Agency"
            maxLength={SEASON_NAME_MAX}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="se-cat">Category</label>
            <input
              id="se-cat"
              value={draft.category}
              onChange={(e) => edit({ category: e.target.value })}
              placeholder="Mindset & Judgment"
              maxLength={SEASON_CATEGORY_MAX}
            />
          </div>
          <div className="field">
            <label htmlFor="se-dur">Duration</label>
            <input
              id="se-dur"
              value={draft.duration}
              onChange={(e) => edit({ duration: e.target.value })}
              placeholder="~1 month"
              maxLength={SEASON_DURATION_MAX}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="se-tag">Tagline</label>
          <input
            id="se-tag"
            value={draft.tagline}
            onChange={(e) => edit({ tagline: e.target.value })}
            maxLength={SEASON_TAGLINE_MAX}
          />
        </div>
        <div className="field">
          <label htmlFor="se-over">Overview</label>
          <textarea
            id="se-over"
            value={draft.overview}
            onChange={(e) => edit({ overview: e.target.value })}
            maxLength={SEASON_OVERVIEW_MAX}
            rows={5}
          />
        </div>
        <div className="field">
          <label htmlFor="se-out">Outcome</label>
          <textarea
            id="se-out"
            value={draft.outcome}
            onChange={(e) => edit({ outcome: e.target.value })}
            maxLength={SEASON_OUTCOME_MAX}
          />
        </div>
        <div className="field">
          <label>State</label>
          <div className="chip-row">
            {STATES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`pick ${draft.state === s.id ? "sel" : ""}`}
                onClick={() => edit({ state: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="field__hint">Live is what operators see. Only one season is live at a time.</span>
        </div>
      </section>

      {/* ---- The steps ---- */}
      <section>
        <div className="screen__label">
          <span className="micro">The track</span>
          <span className="micro">
            {draft.milestones.length}/{SEASON_MAX_MILESTONES}
          </span>
        </div>

        <p className="field__hint">Release saves immediately. Text, order, and completion settings use Save track.</p>

        {draft.milestones.length === 0 ? (
          <p className="muted" style={{ marginBottom: 12 }}>
            No steps yet. Add the first one — you can change anything later.
          </p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {draft.milestones.map((m, i) => {
              const isOpen = open === m.id;
              const hasProof = submittedIds.has(m.id);
              return (
                <div key={m.id} className={`tile tile--flat track-row ${isOpen ? "tile--ember" : ""}`}>
                  <div className="track-row__head">
                    <span className="path__node" style={{ flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <input
                      className="track-row__title"
                      aria-label={`Milestone ${i + 1} title`}
                      value={m.title}
                      placeholder="Milestone"
                      maxLength={MILESTONE_TITLE_MAX}
                      onChange={(e) => patch(m.id, { title: e.target.value })}
                      onFocus={() => setOpen(m.id)}
                    />
                    <span className="chip chip--mute">
                      {m.proofRequired !== true ? "self-complete" : m.verifier === "mentor" ? "mentor review" : "auto-complete"}
                    </span>
                  </div>
                  <div className="track-row__tools" style={{ marginTop: 12 }}>
                    <span className="micro">{milestoneReleased(m, i) ? "Released to students" : "Locked for students"}</span>
                    <button type="button" className={`btn btn--sm ${milestoneReleased(m, i) ? "btn--ghost" : "btn--primary"}`} disabled={busy || !baseline.milestones.some(saved => saved.id === m.id) || (hasProof && milestoneReleased(m, i))} onClick={() => release(m.id, !milestoneReleased(m, i))}>
                      {releasing === m.id ? "Saving…" : milestoneReleased(m, i) ? "Unrelease" : "Release"}
                    </button>
                  </div>
                  {!baseline.milestones.some(saved => saved.id === m.id) && <p className="field__hint">Save this new step before releasing it.</p>}
                  {isOpen && (
                    <div className="track-row__body">
                      <div className="field">
                      <label htmlFor={`why-${m.id}`}>Student brief</label>
                      <span className="field__hint">What to do and why it matters.</span>
                      <textarea
                        id={`why-${m.id}`}
                        className="input"
                        value={m.why}
                        placeholder="Why it matters — your words."
                        maxLength={MILESTONE_WHY_MAX}
                        rows={4}
                        onChange={(e) => patch(m.id, { why: e.target.value })}
                      />
                      </div>
                      <div className="field">
                        <label htmlFor={`guidance-${m.id}`}>Related guidance</label>
                        <span className="field__hint">Optional topics shown in the student brief, one per line.</span>
                        <textarea id={`guidance-${m.id}`} value={m.sessions.join("\n")} rows={2}
                          onChange={e => patch(m.id, { sessions: e.target.value.split("\n").slice(0, MILESTONE_SESSIONS_MAX) })} />
                      </div>
                      <div className="track-row__completion">
                      <h3 className="h3">Completion</h3>
                      <p className="field__hint">{m.proofRequired ? "Students submit a link to complete this step." : "Students mark this step complete themselves."}</p>
                      <label className="optin">
                        <input type="checkbox" checked={m.proofRequired === true} onChange={e => patch(m.id, { proofRequired: e.target.checked })} />
                        <span className="optin__box" aria-hidden="true"><CheckIcon size={12} /></span>
                        <span className="optin__text">Require proof</span>
                      </label>
                      {m.proofRequired === true && <>
                      <div className="field">
                      <label htmlFor={`proof-${m.id}`}>Proof instructions</label>
                      <span className="field__hint">Tell students which link or evidence to submit.</span>
                      <textarea
                        id={`proof-${m.id}`}
                        className="input"
                        value={m.proof}
                        placeholder="Exactly what to submit."
                        maxLength={MILESTONE_PROOF_MAX}
                        onChange={(e) => patch(m.id, { proof: e.target.value })}
                      />
                      </div>
                      <div className="track-row__tools">
                        <div className="chip-row">
                          {(["open", "mentor"] as Verifier[]).map((v) => (
                            <button
                              key={v}
                              type="button"
                              className={`pick ${m.verifier === v ? "sel" : ""}`}
                              onClick={() => patch(m.id, { verifier: v })}
                              title={
                                v === "open"
                                  ? "Posting completes it; proof stays private"
                                  : "You approve or return it; proof stays private"
                              }
                            >
                              {v === "open" ? "Auto-complete" : "Mentor reviews"}
                            </button>
                          ))}
                        </div>
                      </div>
                      </>}
                      </div>
                      {hasProof && (
                        <span className="field__hint">
                          Student progress is saved. This step cannot be removed or hidden once released. Existing proof keeps its review setting.
                        </span>
                      )}
                      <div className="track-row__tools">
                        <span className="row-actions" style={{ marginTop: 0 }}>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => move(i, 1)}
                            disabled={i === draft.milestones.length - 1}
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled={hasProof}
                            title={hasProof ? "Has proof — can't be removed" : undefined}
                            onClick={() => {
                              if (m.title.trim() && !confirm(`Remove "${m.title}"?`)) return;
                              edit({ milestones: draft.milestones.filter((x) => x.id !== m.id) });
                            }}
                          >
                            Remove
                          </button>
                        </span>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(null)}>
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                  {!isOpen && (m.why || m.proof) && (
                    <button type="button" className="track-row__peek" onClick={() => setOpen(m.id)}>
                      {m.proofRequired === true ? m.proof || m.why : m.why}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="form-err" role="alert">{error}</p>}
        {flash && <p className="field__hint signal" role="status">{flash}</p>}
        <div className="row-actions">
          <button type="button" className="btn btn--ghost" onClick={add} disabled={draft.milestones.length >= SEASON_MAX_MILESTONES}>
            <PlusIcon /> Add a step
          </button>
          {dirty && (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setEdits(null)} disabled={busy}>
                Discard
              </button>
              <button type="button" className="btn btn--primary" onClick={persist} disabled={busy || !draft.name.trim()}>
                {busy ? "…" : "Save track"}
              </button>
            </>
          )}
        </div>
      </section>
    </fieldset>
  );
}
