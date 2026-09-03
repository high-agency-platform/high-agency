// Dev-only: remove the artifacts created while smoke-testing the platform —
// the test accounts, their profiles/privateProfiles, their proof under the
// season, and their feed lines. Run: node scripts/cleanup-test.js
const { getAccessToken } = require("./fb-token");

const PROJECT = "highagency-62e67";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const TEST_EMAILS = [
  "test-operator@example.com",
  "test-applicant@example.com",
  "smoke-v11@test.dev",
];

async function main() {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function del(path) {
    const res = await fetch(`${BASE}/${path}`, { method: "DELETE", headers });
    console.log(res.ok ? "deleted" : "skip", path);
  }

  async function listDocs(path) {
    const res = await fetch(`${BASE}/${path}?pageSize=300`, { headers });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.documents ?? []).map((d) => ({
      id: d.name.split("/").pop(),
      uid: d.fields?.uid?.stringValue,
    }));
  }

  async function listSeasons() {
    const res = await fetch(`${BASE}/seasons?pageSize=50`, { headers });
    if (!res.ok) return [];
    return ((await res.json()).documents ?? []).map((d) => d.name.split("/").pop());
  }

  // find the test users by email and remove their docs + accounts
  const lookup = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`,
    { method: "POST", headers, body: JSON.stringify({ expression: [], limit: "50" }) }
  );
  const users = ((await lookup.json()).userInfo ?? []).filter((u) => TEST_EMAILS.includes(u.email));
  const seasons = await listSeasons();
  for (const u of users) {
    await del(`profiles/${u.localId}`);
    await del(`privateProfiles/${u.localId}`);
    for (const sid of seasons) {
      for (const row of await listDocs(`seasons/${sid}/submissions`)) {
        if (row.uid === u.localId || row.id.startsWith(`${u.localId}__`)) await del(`seasons/${sid}/submissions/${row.id}`);
      }
    }
    for (const row of await listDocs("buildLogs")) {
      if (row.uid === u.localId) await del(`buildLogs/${row.id}`);
    }
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:delete`,
      { method: "POST", headers, body: JSON.stringify({ localId: u.localId }) }
    );
    console.log(res.ok ? "deleted account" : "account delete failed", u.email);
  }
  console.log("Cleanup complete.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
