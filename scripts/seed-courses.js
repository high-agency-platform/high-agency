// Seed learning modules (courses) — same idempotent REST upsert approach
// as seed.js. Run: node scripts/seed-courses.js
const { getAccessToken } = require("./fb-token");

const PROJECT = "canary-os";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const s = (v) => ({ stringValue: v });
const n = (v) => ({ integerValue: String(v) });

function course({ title, mentorName, mentorRole, summary, domain, moduleCount, durationMins }) {
  return {
    fields: {
      title: s(title),
      mentorName: s(mentorName),
      mentorRole: s(mentorRole),
      summary: s(summary),
      domain: s(domain),
      moduleCount: n(moduleCount),
      durationMins: n(durationMins),
      url: s("https://meet.google.com/lookup/high-agency"),
    },
  };
}

const courses = {
  "seed-c1": course({
    title: "Selling before you build",
    mentorName: "Josh Newall",
    mentorRole: "High Agency founder & coach",
    summary: "Pre-sell your idea, validate demand with real money, and stop building things nobody wants.",
    domain: "Selling",
    moduleCount: 4,
    durationMins: 90,
  }),
  "seed-c2": course({
    title: "0 to 1: shipping your first product",
    mentorName: "Rosa Vega",
    mentorRole: "Founder, exited to Stripe",
    summary: "Scope an MVP you can ship in 30 days, talk to your first 10 users, and iterate without drowning.",
    domain: "Building",
    moduleCount: 4,
    durationMins: 90,
  }),
  "seed-c3": course({
    title: "Cold outreach that gets replies",
    mentorName: "Sarah Kim",
    mentorRole: "Ex-BD lead, $400M closed",
    summary: "Subject lines, the ask framework, and live teardowns of real cold emails from the batch.",
    domain: "Selling",
    moduleCount: 3,
    durationMins: 75,
  }),
  "seed-c4": course({
    title: "Writing that moves people to act",
    mentorName: "Tariq Mensah",
    mentorRole: "Newsletter, 200k subscribers",
    summary: "Write to one reader, structure the persuasive memo, and publish consistently enough to build an audience.",
    domain: "Content",
    moduleCount: 3,
    durationMins: 75,
  }),
  "seed-c5": course({
    title: "Unit economics for operators",
    mentorName: "Dre Kapoor",
    mentorRole: "PM, multi-strategy fund",
    summary: "Read a P&L, model CAC payback, and defend your numbers like someone who's done it.",
    domain: "Capital",
    moduleCount: 5,
    durationMins: 120,
  }),
  "seed-c6": course({
    title: "Run a project to done",
    mentorName: "Lena Brandt",
    mentorRole: "2x founder, scaled to 80 people",
    summary: "Prioritize ruthlessly, cut scope without cutting value, and ship on the date you said.",
    domain: "Operating",
    moduleCount: 4,
    durationMins: 90,
  }),
};

async function main() {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  for (const [id, doc] of Object.entries(courses)) {
    const res = await fetch(`${BASE}/courses/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(doc),
    });
    if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
    console.log("ok", id);
  }
  console.log("Courses seeded.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
