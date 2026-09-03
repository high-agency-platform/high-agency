// Dev-only: build / repair / inspect the permanent local-QA fixture.
//
// The fixture is two allowlisted accounts:
//   saiamartya19+qa-operator@gmail.com → operator
//   saiamartya19+qa-mentor@gmail.com   → mentor
// plus the live season (seasons/s1, from scripts/season.js) they both work
// against. There is no squad any more — everyone is in one room.
//
// Everything is idempotent — run it whenever the fixture looks off. It never
// deletes anything (use scripts/cleanup-test.js for that).
//
// Usage:
//   node scripts/qa-setup.js            # ensure allowlist, print status
//   node scripts/qa-setup.js --status   # read-only report
//   node scripts/qa-setup.js --link operator|mentor|<email>
//                                       # mint a sign-in link for that account and print
//                                       # it — no email, no dev-server log needed. Open it
//                                       # in the browser; it lands on /login/verify.
//
// Auth: firebase-tools CLI OAuth token (IAM bypasses the rules) — run
// `firebase login` as info@high-agency.io first. Same mechanism as seed.js.
const { getAccessToken } = require("./fb-token");

const PROJECT = "highagency-62e67";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`;
const OOB = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:sendOobCode`;
/** Where a minted link lands. Operator = localhost, mentor = 127.0.0.1 so both can be
 *  signed in at once (one Firebase session per origin) — see docs/qa-e2e.md. */
const ORIGINS = { operator: "http://localhost:3000", mentor: "http://127.0.0.1:3000" };

const QA = {
  operator: { email: "saiamartya19+qa-operator@gmail.com", name: "QA Operator" },
  mentor: { email: "saiamartya19+qa-mentor@gmail.com", name: "QA Mentor" },
};

const s = (v) => ({ stringValue: String(v) });
const decode = (v) => {
  if (!v) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
  if ("mapValue" in v)
    return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, decode(x)]));
  return v;
};
const decodeDoc = (d) =>
  d && d.fields
    ? { id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, decode(v)])) }
    : null;

async function main() {
  const flags = new Set(process.argv.slice(2));
  const readOnly = flags.has("--status");
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  /* ---- --link: mint a sign-in link (same Identity Toolkit call the app's
   *      /api/access/request makes, minus the email) ---- */
  const linkIdx = process.argv.indexOf("--link");
  if (linkIdx !== -1) {
    const who = process.argv[linkIdx + 1];
    const email = QA[who]?.email ?? who;
    if (!email || !email.includes("@")) throw new Error("--link needs operator, mentor, or an email");
    const origin = ORIGINS[who] ?? ORIGINS.operator;
    const res = await fetch(OOB, {
      method: "POST",
      headers,
      body: JSON.stringify({
        requestType: "EMAIL_SIGNIN",
        email,
        returnOobLink: true,
        // Only localhost is an authorized domain in Firebase Auth; the code itself
        // is origin-agnostic, so the printed link below can point at 127.0.0.1.
        continueUrl: "http://localhost:3000/login/verify",
        canHandleCodeInApp: true,
      }),
    });
    if (!res.ok) throw new Error(`sendOobCode: ${res.status} ${await res.text()}`);
    const { oobLink } = await res.json();
    const u = new URL(oobLink);
    const direct = `${origin}/login/verify?apiKey=${u.searchParams.get("apiKey")}&mode=signIn&oobCode=${u.searchParams.get("oobCode")}&lang=en`;
    console.log(`Sign-in link for ${email} (single-use, short-lived).`);
    console.log(`Open it in the browser; it will ask for the email once, then sign you in:\n\n  ${direct}\n`);
    if (who in ORIGINS) console.log(`(${who} → ${origin}; keep the other role on the other origin.)`);
    return;
  }

  async function get(path) {
    const res = await fetch(`${BASE}/${path}`, { headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
    return decodeDoc(await res.json());
  }
  async function patch(path, fields) {
    const res = await fetch(`${BASE}/${path}`, { method: "PATCH", headers, body: JSON.stringify({ fields }) });
    if (!res.ok) throw new Error(`PATCH ${path}: ${res.status} ${await res.text()}`);
    console.log("  wrote", path);
  }
  async function lookupUid(email) {
    const res = await fetch(AUTH, { method: "POST", headers, body: JSON.stringify({ email: [email] }) });
    if (!res.ok) throw new Error(`auth lookup ${email}: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return json.users?.[0]?.localId ?? null;
  }

  /* ---- 1. Allowlist ---- */
  console.log("Allowlist (approvedMembers):");
  for (const [role, { email, name }] of Object.entries(QA)) {
    const existing = await get(`approvedMembers/${encodeURIComponent(email)}`);
    if (existing?.role === role) console.log(`  ok    ${email} → ${role}`);
    else if (readOnly) console.log(`  MISSING ${email} (would add as ${role})`);
    else
      await patch(`approvedMembers/${encodeURIComponent(email)}`, {
        role: s(role),
        name: s(name),
        addedAt: { integerValue: String(Date.now()) },
        note: s("Local QA fixture — scripts/qa-setup.js"),
      });
  }

  /* ---- 2. Accounts + profiles ---- */
  console.log("Accounts:");
  const uids = {};
  for (const [role, { email }] of Object.entries(QA)) {
    const uid = await lookupUid(email);
    uids[role] = uid;
    if (!uid) {
      console.log(`  none  ${email} — sign in once at /login to create it (docs/qa-e2e.md)`);
      continue;
    }
    const profile = await get(`profiles/${uid}`);
    console.log(
      `  ${profile ? "ok   " : "NO PROFILE"} ${email}\n        uid ${uid}` +
        (profile ? ` · ${profile.name} · role ${profile.role} · consent ${profile.consentStatus} · streak ${profile.streak ?? 0}` : " — finish onboarding in the browser")
    );
    if (profile && profile.role !== role) console.log(`        !! profile role is ${profile.role}, expected ${role}`);
  }

  /* ---- 3. The season ---- */
  console.log("Season:");
  const season = await get("seasons/s1");
  if (!season) console.log("  MISSING seasons/s1 — run `node scripts/season.js` (the operator page is empty without it)");
  else {
    const steps = (season.milestones ?? []).map((m) => `${m.title} [${m.verifier === "mentor" ? "mentor" : "open"}]`);
    console.log(`  ok    "${season.name}" · ${season.state} · ${steps.length} steps\n        ${steps.join(" · ")}`);
    if (season.state !== "live") console.log("        !! not live — operators only see the live season");
  }

  /* ---- 4. The operator's proof so far ---- */
  if (uids.operator && season) {
    const res = await fetch(`${BASE}/seasons/s1/submissions?pageSize=200`, { headers });
    const rows = res.ok ? ((await res.json()).documents ?? []).map(decodeDoc) : [];
    const mine = rows.filter((r) => r.uid === uids.operator);
    const waiting = rows.filter((r) => r.status === "submitted").length;
    console.log(`Proof: ${rows.length} rows · QA operator ${mine.length} (${mine.map((r) => `${r.milestoneId}:${r.status}`).join(", ") || "none"}) · ${waiting} waiting on a mentor`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
