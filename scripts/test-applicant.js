// Dev-only helper: create a second test user and have them apply to a cohort
// THROUGH the security rules (Firebase ID token, not OAuth), so this also
// verifies the rules allow the legit client flow. Usage:
//   node scripts/test-applicant.js <cohortId>
const KEY = "AIzaSyDq6kG7N-UpYJxfQX6xNjRdsfmJcPByksw";
const BASE = "https://firestore.googleapis.com/v1/projects/highagency-62e67/databases/(default)/documents";

async function main() {
  const cohortId = process.argv[2];
  if (!cohortId) throw new Error("usage: node scripts/test-applicant.js <cohortId>");

  // sign up (or sign in) the second test user
  let res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test-applicant@example.com",
        password: "TestApplicant123!",
        returnSecureToken: true,
      }),
    }
  );
  let json = await res.json();
  if (json.error && json.error.message === "EMAIL_EXISTS") {
    res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test-applicant@example.com",
          password: "TestApplicant123!",
          returnSecureToken: true,
        }),
      }
    );
    json = await res.json();
  }
  if (!json.idToken) throw new Error(JSON.stringify(json));
  const { idToken, localId: uid } = json;
  const headers = { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" };
  const s = (v) => ({ stringValue: v });

  // onboard: write profile (rules-enforced)
  let r = await fetch(`${BASE}/profiles/${uid}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      fields: {
        uid: s(uid),
        name: s("Riya Sharma"),
        age: { integerValue: "16" },
        location: s("Mississauga"),
        building: s("A newsletter for student founders, 200 subs so far."),
        skills: { arrayValue: { values: [s("Content"), s("Marketing")] } },
        createdAt: { timestampValue: new Date().toISOString() },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!r.ok) throw new Error("profile: " + (await r.text()));
  console.log("profile ok");

  // apply to the cohort (rules-enforced)
  r = await fetch(`${BASE}/cohorts/${cohortId}/applications/${uid}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      fields: {
        applicantUid: s(uid),
        applicantName: s("Riya Sharma"),
        pitch: s("I can own content + distribution while you build."),
        status: s("pending"),
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!r.ok) throw new Error("application: " + (await r.text()));
  console.log("application ok →", cohortId);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
