// Dev-only: remove the artifacts created while smoke-testing the platform
// (test cohort + subdocs, test profiles/privateProfiles, and the test
// email/password accounts). Run: node scripts/cleanup-test.js <cohortId>
const { getAccessToken } = require("./fb-token");

const PROJECT = "highagency-62e67";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const TEST_EMAILS = [
  "test-operator@example.com",
  "test-applicant@example.com",
  "smoke-v11@test.dev",
];

async function main() {
  const cohortId = process.argv[2];
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function del(path) {
    const res = await fetch(`${BASE}/${path}`, { method: "DELETE", headers });
    console.log(res.ok ? "deleted" : "skip", path);
  }

  async function listIds(path) {
    const res = await fetch(`${BASE}/${path}?pageSize=100`, { headers });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.documents ?? []).map((d) => d.name.split("/").pop());
  }

  if (cohortId) {
    for (const sub of ["goals", "applications", "submissions", "logs"]) {
      for (const id of await listIds(`cohorts/${cohortId}/${sub}`))
        await del(`cohorts/${cohortId}/${sub}/${id}`);
    }
    await del(`cohorts/${cohortId}`);
  }

  // find the test users by email and remove their docs + accounts
  const lookup = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ expression: [], limit: "50" }),
    }
  );
  const users = ((await lookup.json()).userInfo ?? []).filter((u) =>
    TEST_EMAILS.includes(u.email)
  );
  for (const u of users) {
    await del(`profiles/${u.localId}`);
    await del(`privateProfiles/${u.localId}`);
    // their pending/decided applications on seed cohorts
    const seeds = await listIds("cohorts");
    for (const c of seeds) await del(`cohorts/${c}/applications/${u.localId}`);
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:delete`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ localId: u.localId }),
      }
    );
    console.log(res.ok ? "deleted account" : "account delete failed", u.email);
  }
  console.log("Cleanup complete.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
