/** The default 8-week Ignition Track. Every cohort runs this track; each
 *  operator hits each milestone with their own venture (squad model).
 *  Evidence specs are deliberately brutal-specific — vague specs create
 *  verification hell. Custom milestones are a batch-2 feature. */

export interface Milestone {
  /** 1-based — submission doc ids are `${id}_${uid}`. */
  id: number;
  name: string;
  /** One line: why this matters. */
  why: string;
  /** Exactly what to submit. */
  evidence: string;
  xp: number;
  week: string;
  /** Estimated effort — sets expectations, helps squads plan the week. */
  effort: string;
  /** Milestones 1–3: peer-lead verifies. 4–7: mentor verifies. */
  verifier: "peer_lead" | "mentor";
}

export const TRACK: Milestone[] = [
  {
    id: 1,
    name: "Mission Locked",
    why: "You can't ship what you haven't scoped. Lock the problem before the build.",
    evidence:
      "One-pager: the problem, who has it, why you, and your 8-week goal.",
    xp: 100,
    week: "Week 1",
    effort: "2–3 hours",
    verifier: "peer_lead",
  },
  {
    id: 2,
    name: "20 Asks Out",
    why: "Cold outreach is the operator superpower. The worst case is a no.",
    evidence:
      "Screenshots of 20 sent cold messages, plus at least 1 reply or booked call.",
    xp: 150,
    week: "Week 2",
    effort: "3–4 hours",
    verifier: "peer_lead",
  },
  {
    id: 3,
    name: "10 Conversations",
    why: "Talk to humans before you build for them — questions that don't lie to you.",
    evidence:
      "Interview log (template provided) + a half-page insight memo: what you learned, pivot or persist.",
    xp: 150,
    week: "Week 3",
    effort: "4–6 hours",
    verifier: "peer_lead",
  },
  {
    id: 4,
    name: "MVP Live",
    why: "Shipped beats perfect. One core action, live on the internet.",
    evidence: "Public URL anyone can use + a 60-second demo video.",
    xp: 250,
    week: "Weeks 4–5",
    effort: "10–15 hours",
    verifier: "mentor",
  },
  {
    id: 5,
    name: "First Traction",
    why: "Real strangers using a real thing — the moment it stops being a school project.",
    evidence:
      "One of: 10 real users (analytics screenshot) / first dollar (payment proof) / 100 waitlist signups. " +
      "Nonprofit/community: first 25 members. Content: 1,000 views + 50 followers. Research: advisor secured + experiment run.",
    xp: 300,
    week: "Week 6",
    effort: "5–10 hours",
    verifier: "mentor",
  },
  {
    id: 6,
    name: "One Door Opened",
    why: "Leverage: someone who already has your audience says yes.",
    evidence:
      "A partnership, collab, or distribution win in writing (email/DM thread).",
    xp: 200,
    week: "Week 7",
    effort: "3–5 hours",
    verifier: "mentor",
  },
  {
    id: 7,
    name: "Demo Day",
    why: "Turn a season into proof. The 3-minute story is the asset you keep.",
    evidence:
      "3-minute presentation delivered live + season recap with metrics.",
    xp: 250,
    week: "Week 8",
    effort: "3–4 hours",
    verifier: "mentor",
  },
];

export function milestone(id: number): Milestone | undefined {
  return TRACK.find((m) => m.id === id);
}

export const TRACK_TOTAL_XP = TRACK.reduce((sum, m) => sum + m.xp, 0);

/** A cohort "completes" a milestone when most of the squad is verified —
 *  one ghost shouldn't block everyone. */
export function squadThreshold(memberCount: number): number {
  return Math.max(1, Math.ceil(memberCount * 0.75));
}
