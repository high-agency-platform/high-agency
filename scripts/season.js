// Load the season track — the mentor's curriculum — into seasons/{id} via
// the Firestore REST API, authenticated with the firebase CLI's OAuth token
// (IAM bypasses security rules; the collection is server-written anyway).
//
// The content lives next door in season-content.json, verbatim from the
// mentor. `verifier: "peer_lead"` in the source means "open" in the product
// (posting completes it; everyone can see it) — the app normalizes it on
// read and the editor normalizes it on save, so the JSON can stay faithful.
//
// Milestone ids in the JSON are STABLE slugs. Submission doc ids embed them,
// so re-running this never orphans anyone's proof.
//
// Refuses to overwrite a season that already exists — the mentor may have
// edited it in-app since. Pass --force to overwrite anyway.
//
// Usage:
//   node scripts/season.js            # create seasons/s1 from the JSON
//   node scripts/season.js --force    # overwrite an existing s1
const fs = require("fs");
const path = require("path");
const { getAccessToken } = require("./fb-token");

const PROJECT = "highagency-62e67";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Plain JSON → Firestore REST value encoding. */
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  const fields = {};
  for (const [k, x] of Object.entries(v)) fields[k] = toValue(x);
  return { mapValue: { fields } };
}

async function main() {
  const force = process.argv.includes("--force");
  const content = JSON.parse(
    fs.readFileSync(path.join(__dirname, "season-content.json"), "utf8")
  );
  const { id, ...season } = content;
  if (!id || !season.name || !Array.isArray(season.milestones)) {
    throw new Error("season-content.json needs id, name and milestones");
  }
  const ids = season.milestones.map((m) => m.id);
  if (new Set(ids).size !== ids.length || ids.some((x) => !x)) {
    throw new Error("every milestone needs a unique, stable id");
  }

  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const url = `${BASE}/seasons/${encodeURIComponent(id)}`;

  const existing = await fetch(url, { headers });
  if (existing.ok && !force) {
    console.error(
      `seasons/${id} already exists. The mentor may have edited it in-app — ` +
        `re-run with --force to overwrite it from the JSON.`
    );
    process.exit(2);
  }

  const now = new Date();
  const fields = {};
  for (const [k, v] of Object.entries(season)) fields[k] = toValue(v);
  fields.updatedAt = toValue(now);
  fields.updatedByUid = toValue("script");
  fields.updatedByName = toValue("seed");
  if (!existing.ok) fields.createdAt = toValue(now);

  // PATCH = upsert. Without an updateMask this replaces the whole doc, which
  // is what --force means; on first create there is nothing to preserve.
  const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

  console.log(
    `${existing.ok ? "overwrote" : "created"} seasons/${id} — "${season.name}" ` +
      `(${season.state}, ${season.milestones.length} milestones)`
  );
  for (const m of season.milestones) {
    const v = m.verifier === "mentor" ? "mentor reviews" : "open";
    console.log(`  · ${m.id.padEnd(16)} ${m.title}  [${v}]`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
