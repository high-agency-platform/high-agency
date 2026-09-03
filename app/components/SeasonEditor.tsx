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
  MILESTONE_EFFORT_MAX,
  MILESTONE_SESSIONS_MAX,
  milestoneId,
} from "../lib/types";
import { saveSeason } from "../lib/api";
import { PlusIcon } from "./ui";

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
    milestones: s?.milestones ?? [],
    base: s?.updatedAt?.toMillis() ?? null,
  };
}

const ERRORS: Record<string, string> = {
  "stale-write": "Someone else saved the track first. Reload to see it, then redo your change.",
  "milestone-has-submissions": "A step you removed already has proof against it. Put it back.",
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
  const draft = edits ?? fromSeason(season);
  const dirty = edits !== null;

  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  function edit(p: Partial<Draft>) {
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
      effort: "",
      verifier: "mentor",
      sessions: [],
    };
    edit({ milestones: [...draft.milestones, m] });
    setOpen(m.id);
  }

  async function persist() {
    setBusy(true);
    setError("");
    try {
      await saveSeason({
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
        milestones: draft.milestones
          .map((m) => ({
            ...m,
            title: m.title.trim(),
            sessions: m.sessions.map((s) => s.trim()).filter(Boolean),
          }))
          .filter((m) => m.title),
      });
      setEdits(null);
      setFlash("Saved — everyone sees it now.");
      setTimeout(() => setFlash(""), 3500);
    } catch (e) {
      setError(ERRORS[(e as Error).message] ?? "Couldn't save the track. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {/* ---- The season itself ---- */}
      <section className="tile">
        <div className="tile__head">
          <h2 className="h3">The season</h2>
          <span className="micro">
            {season
              ? `last saved${season.updatedByName ? ` by ${season.updatedByName}` : ""}`
              : "nothing saved yet"}
          </span>
        </div>
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
                      value={m.title}
                      placeholder="Milestone"
                      maxLength={MILESTONE_TITLE_MAX}
                      onChange={(e) => patch(m.id, { title: e.target.value })}
                      onFocus={() => setOpen(m.id)}
                    />
                    <span className="chip chip--mute">
                      {m.verifier === "mentor" ? "mentor" : "open"}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="track-row__body">
                      <textarea
                        className="input"
                        value={m.why}
                        placeholder="Why it matters — your words."
                        maxLength={MILESTONE_WHY_MAX}
                        rows={4}
                        onChange={(e) => patch(m.id, { why: e.target.value })}
                      />
                      <textarea
                        className="input"
                        value={m.proof}
                        placeholder="Exactly what to submit."
                        maxLength={MILESTONE_PROOF_MAX}
                        onChange={(e) => patch(m.id, { proof: e.target.value })}
                      />
                      <div className="track-row__tools">
                        <input
                          className="input"
                          style={{ maxWidth: 200 }}
                          value={m.effort}
                          placeholder="Effort · 2–3 hours"
                          maxLength={MILESTONE_EFFORT_MAX}
                          onChange={(e) => patch(m.id, { effort: e.target.value })}
                        />
                        <div className="chip-row">
                          {(["open", "mentor"] as Verifier[]).map((v) => (
                            <button
                              key={v}
                              type="button"
                              className={`pick ${m.verifier === v ? "sel" : ""}`}
                              onClick={() => patch(m.id, { verifier: v })}
                              title={
                                v === "open"
                                  ? "Posting completes it; everyone can see the proof"
                                  : "You approve or return it; proof stays private"
                              }
                            >
                              {v === "open" ? "Open" : "Mentor reviews"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        className="input"
                        value={m.sessions.join("\n")}
                        placeholder="Suggested sessions — one per line"
                        rows={2}
                        onChange={(e) =>
                          patch(m.id, { sessions: e.target.value.split("\n").slice(0, MILESTONE_SESSIONS_MAX) })
                        }
                      />
                      {hasProof && (
                        <span className="micro" style={{ color: "var(--warn)" }}>
                          has proof · can&apos;t be removed; changing who reviews won&apos;t move existing proof
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
                      {m.proof || m.why}
                      {m.effort && <span className="micro"> · {m.effort}</span>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="form-err">{error}</p>}
        {flash && <p className="micro signal" style={{ marginTop: 10 }}>{flash}</p>}
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
    </div>
  );
}
