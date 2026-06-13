// Admin field-setter for things clients can't do under the security rules:
// granting parental consent, assigning the mentor role, flipping plan.
// OAuth (firebase CLI token) bypasses rules.
//
// Usage:
//   node scripts/admin-set.js <uid> consent   # consentStatus -> granted
//   node scripts/admin-set.js <uid> mentor    # role -> mentor
//   node scripts/admin-set.js <uid> pro       # plan -> pro
const { getAccessToken } = require("./fb-token");

const PROJECT = "canary-os";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const ACTIONS = {
  consent: { field: "consentStatus", value: "granted" },
  mentor: { field: "role", value: "mentor" },
  pro: { field: "plan", value: "pro" },
};

async function main() {
  const [uid, action] = process.argv.slice(2);
  const spec = ACTIONS[action];
  if (!uid || !spec) {
    console.error("Usage: node scripts/admin-set.js <uid> consent|mentor|pro");
    process.exit(1);
  }
  const token = await getAccessToken();
  const url = `${BASE}/profiles/${uid}?updateMask.fieldPaths=${spec.field}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: { [spec.field]: { stringValue: spec.value } } }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  console.log(`ok: profiles/${uid}.${spec.field} = ${spec.value}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
