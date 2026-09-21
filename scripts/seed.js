// Seed operator profiles, the workshop calendar, a few
// proof submissions into Firestore via the REST API, authenticated with the
// firebase CLI's OAuth token (IAM bypasses security rules).
// Idempotent: fixed document ids, PATCH = upsert. Run: node scripts/seed.js
const { getAccessToken } = require("./fb-token");

const PROJECT = "highagency-62e67";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const s = (v) => ({ stringValue: v });
const n = (v) => ({ integerValue: String(v) });
const ts = (d) => ({ timestampValue: d.toISOString() });
const arr = (items) => ({ arrayValue: { values: items.length ? items : [] } });
const map = (fields) => ({ mapValue: { fields } });

// ─── Profiles ──────────────────────────────────────────────────────────────
// Seed operator profiles — real teenagers running real ventures.
// Admin REST API bypasses rules so we can create docs for non-auth UIDs.

function profile({ uid, name, ageBand, country, timezone, headline, building,
  stage, domains, skills, hours, streak, daysAgo, proofUrl, proofNote, bio,
  links, consentStatus }) {
  const createdAt = new Date(Date.now() - (daysAgo ?? 0) * 86400000);
  // Seeded operators should look alive: a streak that ended weeks ago reads as
  // a dead account, so the last active day is always "today".
  const today = new Date().toISOString().slice(0, 10);
  return {
    fields: {
      uid: s(uid),
      name: s(name),
      ageBand: s(ageBand),
      country: s(country),
      timezone: s(timezone),
      headline: s(headline),
      building: s(building),
      stage: s(stage),
      domains: arr(domains.map(s)),
      skills: arr(skills.map(s)),
      proofUrl: s(proofUrl ?? ""),
      proofNote: s(proofNote ?? ""),
      hours: s(hours),
      bio: s(bio ?? ""),
      links: map({
        github: s(links?.github ?? ""),
        linkedin: s(links?.linkedin ?? ""),
        site: s(links?.site ?? ""),
      }),
      consentStatus: s(consentStatus ?? "granted"),
      plan: s("free"),
      role: s("operator"),
      streak: n(streak ?? 0),
      streakFreezes: n(0),
      lastActiveDay: s(today),
      lastBuildLogDay: s(""),
      enrolledWorkshops: arr([]),
      updatedAt: ts(new Date()),
      createdAt: ts(createdAt),
    },
  };
}

// Every operator is a real teenager running a real venture — a product with
// users or a service with customers. High Agency is 13–19, so the age mix
// leans young; nobody here is a generic "founder persona".
const profiles = {
  /* ---- Tempo ---- */
  "seed-maya": profile({
    uid: "seed-maya", name: "Maya C.", ageBand: "16-17",
    country: "Canada", timezone: "America/Toronto",
    headline: "Founder of Tempo — 340 student musicians practise with it weekly",
    building: "Tempo listens to a student play, finds the two bars they keep fumbling, and builds tomorrow's practice session around exactly those. Six school music departments use it; the band directors are the ones who ask for features now.",
    stage: "launched", domains: ["AI", "Web/Apps"], skills: ["Coding", "Design"],
    hours: "10+", streak: 14, daysAgo: 21,
    proofUrl: "https://github.com/mayac/tempo-pitch",
    proofNote: "The pitch-detection engine — I wrote it after three failed attempts with off-the-shelf libraries.",
    bio: "Played clarinet for eight years and hated practising badly. Built the thing I wanted at 14, rewrote it properly at 16.",
    links: { github: "https://github.com/mayac", site: "https://tempo.study" },
  }),
  "seed-dev": profile({
    uid: "seed-dev", name: "Dev P.", ageBand: "18+",
    country: "India", timezone: "Asia/Kolkata",
    headline: "Ships Tempo's Android app — got audio latency under 40ms",
    building: "The mobile half of Tempo. Live pitch analysis has to feel instant or students stop trusting it, so most of my work is squeezing the audio pipeline. Android is 60% of our schools.",
    stage: "launched", domains: ["AI", "Web/Apps"], skills: ["Coding", "Ops"],
    hours: "10+", streak: 8, daysAgo: 20,
    proofUrl: "https://play.google.com/store/apps/details?id=study.tempo",
    proofNote: "Play Store listing — 1.4k installs, 4.6 stars.",
    bio: "Self-taught on a secondhand laptop. I care more about the 40ms than anyone should.",
    links: { github: "https://github.com/devp" },
  }),
  "seed-lena": profile({
    uid: "seed-lena", name: "Lena F.", ageBand: "16-17",
    country: "Germany", timezone: "Europe/Berlin",
    headline: "Got Tempo into 6 school music departments by cold-emailing 200",
    building: "Distribution for Tempo. Music teachers don't read ads — they read emails from students who play. I write all 200 of them by hand and two schools a month say yes.",
    stage: "launched", domains: ["AI", "Content"], skills: ["Sales/Outreach", "Writing"],
    hours: "5-10", streak: 5, daysAgo: 18,
    proofUrl: "https://tempo.study/schools",
    proofNote: "The page I send teachers — it converts at 11%.",
    bio: "Second violin, first in the inbox. I like the part of the job everyone else avoids.",
  }),

  /* ---- Northlight Tutoring ---- */
  "seed-arjun": profile({
    uid: "seed-arjun", name: "Arjun M.", ageBand: "18+",
    country: "UK", timezone: "Europe/London",
    headline: "Runs Northlight Tutoring — £1,200/month, 9 tutors, zero ad spend",
    building: "Northlight is a student-run tutoring collective for A-level maths and physics. I recruit and vet the tutors, handle scheduling and invoicing, and take a 20% cut. Forty-odd booked hours a month and growing on referrals alone.",
    // Profile domains stay inside the DOMAINS presets — the card editor is
    // preset-only, so a custom value here would silently vanish on first save.
    stage: "revenue", domains: ["Other"], skills: ["Sales/Outreach", "Ops"],
    hours: "10+", streak: 22, daysAgo: 14,
    proofUrl: "https://northlight-tutoring.co.uk",
    proofNote: "Booking site — every tutor on it has been through my trial lesson.",
    bio: "Started charging £15/hr for maths help in year 11. Realised the bottleneck was never me teaching, it was other people teaching.",
    links: { site: "https://northlight-tutoring.co.uk", linkedin: "https://linkedin.com/in/arjunm" },
  }),
  "seed-sofia": profile({
    uid: "seed-sofia", name: "Sofia R.", ageBand: "16-17",
    country: "Spain", timezone: "Europe/Madrid",
    headline: "Built Northlight's curriculum — tutors get a lesson plan, not a shrug",
    building: "The teaching side of Northlight. I write the session plans and worksheets every tutor uses, so a new tutor's first lesson is as good as their fiftieth. Nineteen plans so far, all from past-paper analysis.",
    stage: "revenue", domains: ["Content", "Other"], skills: ["Writing", "Design"],
    hours: "3-5", streak: 10, daysAgo: 12,
    proofUrl: "https://northlight-tutoring.co.uk/mechanics-plan",
    proofNote: "One full session plan, free to read — this is the standard for all of them.",
    bio: "I get bored explaining the same thing twice, so I write it down properly once.",
  }),

  /* ---- Rivet ---- */
  "seed-tomas": profile({
    uid: "seed-tomas", name: "Tomas E.", ageBand: "16-17",
    country: "Czech Republic", timezone: "Europe/Berlin",
    headline: "Founder of Rivet — 120 keyboard kits designed, built and shipped",
    building: "Rivet makes small-batch mechanical keyboard kits. I design the PCB and case, run the group buy, and pack every box myself. Batch three sold out in nine days; batch four is 60 units and already half spoken for.",
    stage: "revenue", domains: ["Hardware", "E-commerce"], skills: ["Design", "Ops"],
    hours: "10+", streak: 30, daysAgo: 10,
    proofUrl: "https://rivetkb.com/batch-three",
    proofNote: "Batch three build log — every revision, including the one that failed.",
    bio: "My bedroom is a soldering station with a bed in it. Fair trade.",
    links: { site: "https://rivetkb.com", github: "https://github.com/tomase" },
  }),
  "seed-kai": profile({
    uid: "seed-kai", name: "Kai W.", ageBand: "18+",
    country: "Australia", timezone: "Australia/Sydney",
    headline: "Cut Rivet's per-unit cost 31% by re-sourcing the case supplier",
    building: "Supply and margins at Rivet. I found the Shenzhen anodiser who does our cases, negotiated batch pricing, and rebuilt the shipping flow so an order leaves within 48 hours. Boring work — it's what makes the thing a business.",
    stage: "revenue", domains: ["Hardware", "E-commerce"], skills: ["Ops", "Sales/Outreach"],
    hours: "10+", streak: 9, daysAgo: 15,
    proofUrl: "https://rivetkb.com/inside-the-numbers",
    proofNote: "We published our unit economics. Nobody in this space does that.",
    bio: "I like spreadsheets and I'm not sorry about it.",
  }),

  /* ---- Shelfware ---- */
  "seed-felix": profile({
    uid: "seed-felix", name: "Felix A.", ageBand: "18+",
    country: "Sweden", timezone: "Europe/Stockholm",
    headline: "Founder of Shelfware — 34 Shopify stores paying $19/mo",
    building: "Shelfware watches a small Shopify store's inventory and flags the stock that's quietly dying before it eats their cash. Most owners find out from their accountant six months late. $646 MRR, churn under 4%.",
    stage: "revenue", domains: ["E-commerce", "Web/Apps"], skills: ["Coding", "Sales/Outreach"],
    hours: "10+", streak: 28, daysAgo: 30,
    proofUrl: "https://apps.shopify.com/shelfware",
    proofNote: "Live on the Shopify App Store — 34 paying installs, 4.9 stars.",
    bio: "My mum runs a homeware shop. She lost 40k SEK on stock nobody wanted. That's the whole origin story.",
    links: { site: "https://shelfware.app", github: "https://github.com/felixa" },
  }),
  "seed-nina": profile({
    uid: "seed-nina", name: "Nina K.", ageBand: "18+",
    country: "Poland", timezone: "Europe/Warsaw",
    headline: "Sold Shelfware's first 20 customers by DMing store owners",
    building: "Growth at Shelfware, and my own thing — Ledgerly. At Shelfware I do the outbound: find stores with visible dead stock, screenshot the evidence, send it. Reply rate is 31% because the message is about them, not us.",
    stage: "revenue", domains: ["E-commerce", "Finance"], skills: ["Sales/Outreach", "Coding"],
    hours: "10+", streak: 25, daysAgo: 6,
    proofUrl: "https://ninak.dev/the-screenshot-cold-email",
    proofNote: "The exact template. It works because it costs me ten minutes of homework per send.",
    bio: "Started cold-emailing at 15 to get a summer job. Never stopped.",
    links: { site: "https://ninak.dev" },
  }),
  "seed-rin": profile({
    uid: "seed-rin", name: "Rin T.", ageBand: "16-17",
    country: "Japan", timezone: "Asia/Tokyo",
    headline: "Redesigned Shelfware's dashboard — support tickets dropped 60%",
    building: "Product design at Shelfware. Shop owners aren't analysts; the first version buried the one number that matters under four charts. Now it opens on a single sentence: 'These 12 items are costing you ¥— a month.'",
    stage: "revenue", domains: ["Web/Apps", "E-commerce"], skills: ["Design", "Coding"],
    hours: "5-10", streak: 16, daysAgo: 20,
    proofUrl: "https://rin.design/shelfware-redesign",
    proofNote: "Before and after, with the support-ticket numbers attached.",
    bio: "I think most dashboards are cowardice — showing everything so you never have to decide what matters.",
    links: { site: "https://rin.design" },
  }),

  /* ---- Fieldnote ---- */
  "seed-priya": profile({
    uid: "seed-priya", name: "Priya S.", ageBand: "16-17",
    country: "India", timezone: "Asia/Kolkata",
    headline: "Founder of Fieldnote — 11 conservation groups log data with it",
    building: "Fieldnote is an offline-first app for volunteers doing species counts where there's no signal. They were using paper and losing it. Eleven groups across three states, 4,200 observations recorded, and the state forest department has started asking for our exports.",
    stage: "launched", domains: ["Science", "Nonprofit"], skills: ["Coding", "Ops"],
    hours: "5-10", streak: 11, daysAgo: 2,
    proofUrl: "https://fieldnote.ngo/wetland-count-2026",
    proofNote: "A full wetland bird count — 900 records collected on Fieldnote with zero signal.",
    bio: "Spent two monsoons volunteering on bird surveys, watched three notebooks get soaked. Built the fix.",
    links: { github: "https://github.com/priyas", site: "https://fieldnote.ngo" },
  }),
  "seed-omar": profile({
    uid: "seed-omar", name: "Omar H.", ageBand: "16-17",
    country: "Egypt", timezone: "Africa/Cairo",
    headline: "Built Fieldnote's sync engine — survives two weeks offline",
    building: "The hard part of Fieldnote: a phone that hasn't seen a tower in twelve days has to merge cleanly with everyone else's when it finally does. Conflict resolution, not features. Nobody notices it when it works.",
    stage: "launched", domains: ["Science", "Web/Apps"], skills: ["Coding", "Ops"],
    hours: "10+", streak: 6, daysAgo: 3,
    proofUrl: "https://github.com/omarh/fieldnote-sync",
    proofNote: "The sync layer, open-sourced, with the test suite that convinced me it was right.",
    bio: "I like problems where being clever is not enough and you just have to be careful.",
    links: { github: "https://github.com/omarh" },
  }),

  /* ---- Curbside ---- */
  "seed-sam": profile({
    uid: "seed-sam", name: "Sam D.", ageBand: "16-17",
    country: "USA", timezone: "America/New_York",
    headline: "Founder of Curbside — 31 restaurants the big apps won't deliver for",
    building: "Curbside delivers for the independent restaurants in our county that DoorDash quotes 30% to. We charge 12%, run six student drivers on weekends, and did 214 orders last month. The owners text me directly when something breaks.",
    stage: "revenue", domains: ["Web/Apps", "E-commerce"], skills: ["Ops", "Sales/Outreach"],
    hours: "10+", streak: 19, daysAgo: 5,
    proofUrl: "https://curbside.delivery",
    proofNote: "The live order site — 31 restaurants, all signed in person.",
    bio: "My family's restaurant paid DoorDash more in fees than it paid me all summer.",
    links: { site: "https://curbside.delivery" },
  }),
  "seed-grace": profile({
    uid: "seed-grace", name: "Grace L.", ageBand: "13-15",
    country: "Singapore", timezone: "Asia/Singapore",
    headline: "Founder of Bandwidth — 60 refurbished laptops placed with students",
    building: "Bandwidth takes dead corporate laptops, fixes them, and gets them to students who don't have one. Sixty machines placed across four schools. Two IT departments now call me before they send anything to recycling.",
    stage: "launched", domains: ["Hardware", "Nonprofit"], skills: ["Ops", "Sales/Outreach"],
    hours: "5-10", streak: 7, daysAgo: 3,
    proofUrl: "https://bandwidth.sg/sixty",
    proofNote: "Every machine, where it came from, and where it went.",
    bio: "Shared one laptop with two siblings for three years. There are thousands of working machines going in skips.",
  }),
  "seed-jules": profile({
    uid: "seed-jules", name: "Jules M.", ageBand: "16-17",
    country: "France", timezone: "Europe/Paris",
    headline: "Runs Cutting Room — 4 retainer clients, 60 short-form edits a month",
    building: "Cutting Room is a two-person editing studio for creators who film plenty and post nothing. Four retainers at €400/month. I edit, Sofia writes the hooks. Our best client went from 2k to 40k followers in five months.",
    stage: "revenue", domains: ["Content"], skills: ["Video", "Sales/Outreach"],
    hours: "10+", streak: 18, daysAgo: 8,
    proofUrl: "https://cuttingroom.fr/reel",
    proofNote: "90-second reel — the four accounts and what they did before us.",
    bio: "Edited my first video at 12 for a friend's skate clip. Charged for the second one.",
    links: { site: "https://cuttingroom.fr" },
  }),

  /* ---- Palate ---- */
  "seed-amara": profile({
    uid: "seed-amara", name: "Amara O.", ageBand: "18+",
    country: "Nigeria", timezone: "Africa/Lagos",
    headline: "Founder of Palate — menu + allergen translation for 22 restaurants",
    building: "Palate turns a photo of a handwritten menu into a clean, translated, allergen-tagged version customers can read. Built for immigrant-run kitchens that can't afford a designer or a translator. Twenty-two restaurants, free tier, working out what to charge.",
    stage: "launched", domains: ["AI", "Nonprofit"], skills: ["Coding", "Writing"],
    hours: "5-10", streak: 12, daysAgo: 9,
    proofUrl: "https://palate.menu/before-after",
    proofNote: "Ten real menus, before and after. The Yoruba ones are the ones I'm proudest of.",
    bio: "My aunt's restaurant lost customers to a menu nobody could read. Now she has one they can.",
    links: { site: "https://palate.menu", github: "https://github.com/amarao" },
  }),
};

// ─── Workshops ─────────────────────────────────────────────────────────────

// Sessions are owned and capped. Seeded ones are stamped with a synthetic
// owner uid so they're shaped like the real thing — no signed-in mentor owns
// them, so nobody can edit them in-app. They carry no calendar event (that
// only exists when a real mentor with Google connected schedules a session).
function workshop({ title, mentorName, mentorUid, description, inDays, hour,
  durationMins, capacity }) {
  const d = new Date();
  d.setDate(d.getDate() + inDays);
  d.setHours(hour, 0, 0, 0);
  return {
    fields: {
      title: s(title),
      mentorName: s(mentorName),
      mentorUid: s(mentorUid ?? "seed-mentor"),
      description: s(description),
      startsAt: ts(d),
      durationMins: n(durationMins),
      meetLink: s("https://meet.google.com/lookup/high-agency"),
      // Mirrors WORKSHOP_DEFAULT_CAPACITY in app/lib/types.ts — a live session
      // that can actually be a conversation, not a webinar.
      capacity: n(capacity ?? 15),
      enrolledUids: arr([]),
      recordingUrl: s(""),
    },
  };
}

const workshops = {
  "seed-w0": workshop({
    title: "The Operator Mindset",
    mentorName: "Josh Newall",
    description: "What high agency actually is, picking your mission, the weekly cadence. ",
    inDays: 3, hour: 18, durationMins: 60,
  }),
  "seed-w1": workshop({
    title: "The Art of the Cold Ask",
    mentorName: "Sarah Kim",
    description: "The 5-sentence cold email, rejection math, and the 3-touch follow-up.",
    inDays: 10, hour: 18, durationMins: 60,
  }),
  "seed-w2": workshop({
    title: "Talk to Humans",
    mentorName: "Josh Newall",
    description: "The Mom Test in 10 minutes; interviews that don't lie to you.",
    inDays: 17, hour: 18, durationMins: 60,
  }),
  "seed-w3": workshop({
    title: "Ship the MVP, part 1: ruthless scoping",
    mentorName: "Josh Newall",
    description: "One core action. Fake doors, concierge MVPs, and other shortcuts.",
    inDays: 24, hour: 18, durationMins: 60,
  }),
  "seed-w4": workshop({
    title: "Ship the MVP, part 2: AI leverage + the front door",
    mentorName: "Dev Anand",
    description: "The modern stack, landing pages that convert, capturing intent.",
    inDays: 31, hour: 18, durationMins: 60,
  }),
  "seed-w5": workshop({
    title: "Traction From Nothing",
    mentorName: "Sarah Kim",
    description: "The unscalable 10, build-in-public, and feedback loops at zero scale.",
    inDays: 38, hour: 18, durationMins: 60,
  }),
  "seed-w6": workshop({
    title: "Partnerships & Leverage (advanced)",
    mentorName: "Josh Newall",
    description: "Who already has your audience, and the pilot proposal that opens doors.",
    inDays: 45, hour: 18, durationMins: 60,
  }),
  "seed-w7": workshop({
    title: "Scale What Works & Tell the Story",
    mentorName: "Josh Newall",
    description: "Reading your numbers and the 3-minute demo-day arc.",
    inDays: 52, hour: 18, durationMins: 60,
  }),
};

// ─── Proof submissions (seasons/s1) ────────────────────────────────────────
// Shaped exactly as POST /api/submissions writes them. Doc id is
// `${uid}__${milestoneId}`. Open rows are born approved; mentor rows wait.
// Only seeded when seasons/s1 exists — run `node scripts/season.js` first.

function submission({ uid, name, milestoneId, milestoneTitle, verifier, status, proofUrl, note, daysAgo, reviewNote }) {
  const at = new Date(Date.now() - daysAgo * 86400000);
  return {
    fields: {
      seasonId: s("s1"), milestoneId: s(milestoneId), milestoneTitle: s(milestoneTitle),
      uid: s(uid), name: s(name), proofUrl: s(proofUrl), note: s(note ?? ""),
      verifier: s(verifier), status: s(status), attempt: n(1),
      reviewedByUid: s(""), reviewedByName: s(""), reviewedAt: { nullValue: null },
      reviewNote: s(reviewNote ?? ""), createdAt: ts(at), updatedAt: ts(at),
    },
  };
}

const submissions = {
  "seed-maya__cold-ask": submission({ uid: "seed-maya", name: "Maya C.", milestoneId: "cold-ask", milestoneTitle: "The Cold Ask", verifier: "open", status: "approved", daysAgo: 3,
    proofUrl: "https://tempo.study/asks", note: "5 asks to band directors; screenshots + the one reply that turned into a pilot." }),
  "seed-lena__cold-ask": submission({ uid: "seed-lena", name: "Lena F.", milestoneId: "cold-ask", milestoneTitle: "The Cold Ask", verifier: "open", status: "approved", daysAgo: 2,
    proofUrl: "https://tempo.study/schools", note: "Asked 5 music teachers for 15 minutes. Two said yes, one said no, two silent." }),
  "seed-dev__ship-48h": submission({ uid: "seed-dev", name: "Dev P.", milestoneId: "ship-48h", milestoneTitle: "Ship in 48 Hours", verifier: "open", status: "approved", daysAgo: 1,
    proofUrl: "https://tempo.study/latency", note: "A one-page latency tracker. Started Tuesday 9pm, live Thursday 7pm." }),
  "seed-arjun__mission-locked": submission({ uid: "seed-arjun", name: "Arjun M.", milestoneId: "mission-locked", milestoneTitle: "Mission Locked", verifier: "mentor", status: "submitted", daysAgo: 1,
    proofUrl: "https://northlight-tutoring.co.uk/one-pager", note: "Problem: A-level students can't find vetted tutors. One-pager linked." }),
};

// ─── Runner ────────────────────────────────────────────────────────────────

async function main() {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function upsert(path, doc) {
    const res = await fetch(`${BASE}/${path}`, { method: "PATCH", headers, body: JSON.stringify(doc) });
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
    console.log("  wrote", path);
  }
  async function exists(path) {
    const res = await fetch(`${BASE}/${path}`, { headers });
    return res.ok;
  }

  console.log("Seeding profiles…");
  for (const [id, doc] of Object.entries(profiles)) await upsert(`profiles/${id}`, doc);

  console.log("Seeding workshops…");
  for (const [id, doc] of Object.entries(workshops)) await upsert(`workshops/${id}`, doc);


  if (await exists("seasons/s1")) {
    console.log("Seeding proof (seasons/s1/submissions)…");
    for (const [id, doc] of Object.entries(submissions)) await upsert(`seasons/s1/submissions/${id}`, doc);
  } else {
    console.log("No seasons/s1 yet — run `node scripts/season.js` first, then rerun to seed proof.");
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
