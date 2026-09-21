"use client";

/* The season track — one shared document, every mentor edits it, every
   operator reads it the moment it's saved. */

import { useEffect, useMemo, useState } from "react";
import { useMentorGate } from "../../../components/mentorData";
import { watchSeasons, watchAllSubmissions } from "../../../lib/db";
import type { Season, Submission } from "../../../lib/types";
import { SeasonEditor } from "../../../components/SeasonEditor";

export default function MentorTrackPage() {
  const { user, profile } = useMentorGate();
  const uid = user?.uid ?? null;

  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [subSnap, setSubSnap] = useState<{ seasonId: string; subs: Submission[] } | null>(null);

  useEffect(() => {
    if (!uid) return;
    return watchSeasons(setSeasons);
  }, [uid]);

  // The live season if there is one, else the newest draft. One track.
  const season = useMemo(
    () => (seasons ? (seasons.find((s) => s.state === "live") ?? seasons[0] ?? null) : null),
    [seasons]
  );
  const seasonId = season?.id ?? null;

  useEffect(() => {
    if (!seasonId) return;
    return watchAllSubmissions(seasonId, (subs) => setSubSnap({ seasonId, subs }));
  }, [seasonId]);

  const submittedIds = useMemo(
    () =>
      new Set(
        subSnap && subSnap.seasonId === seasonId ? subSnap.subs.map((s) => s.milestoneId) : []
      ),
    [subSnap, seasonId]
  );

  if (!user || !profile) return null;

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="h1">The track</h1>
        <span className="micro">one season · every mentor edits it · released milestones appear for students within 10 seconds</span>
      </header>

      {seasons === null ? (
        <p className="empty">Loading…</p>
      ) : (
        <div style={{ maxWidth: 760 }}>
          <SeasonEditor key={seasonId ?? "new"} season={season} submittedIds={submittedIds} />
        </div>
      )}
    </div>
  );
}
