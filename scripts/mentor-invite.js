// Mint a single-use mentor invite. Staff-only, local: authenticates with the
// firebase-tools CLI OAuth token (IAM bypasses security rules — the
// mentorInvites collection is deny-all to clients).
//
// The RAW code is printed once here and never stored: Firestore keeps only its
// SHA-256 hash as the doc id (mirrors the consentTokens model). Share the
// printed /mentor/join link 1:1 with the person it's for; redeeming it is
// atomic + single-use (app/lib/mentorInviteServer.ts).
//
// Usage:
//   node scripts/mentor-invite.js "<label>" [days]
//   node scripts/mentor-invite.js "Sarah Chen <sarah@x.com>"      # 30-day invite
//   node scripts/mentor-invite.js "Priya (YC advisor)" 7          # 7-day invite
const { createHash, randomBytes } = require("crypto");
const { getAccessToken } = require("./fb-token");

const PROJECT = "highagency-62e67";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const DEFAULT_TTL_DAYS = 30; // keep in sync with INVITE_DEFAULT_TTL_DAYS

async function main() {
  const [label, daysArg] = process.argv.slice(2);
  const days = daysArg ? Number(daysArg) : DEFAULT_TTL_DAYS;
  if (!label || !Number.isFinite(days) || days <= 0) {
    console.error('Usage: node scripts/mentor-invite.js "<label>" [days]');
    process.exit(1);
  }

  const rawCode = randomBytes(24).toString("base64url");
  const hash = createHash("sha256").update(rawCode).digest("hex");
  const now = Date.now();

  const token = await getAccessToken();
  // documentId in the query string → create fails (409) if the id collides,
  // rather than silently overwriting an invite.
  const url = `${BASE}/mentorInvites?documentId=${hash}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        label: { stringValue: label },
        createdAt: { timestampValue: new Date(now).toISOString() },
        expiresAt: {
          timestampValue: new Date(now + days * 86400_000).toISOString(),
        },
        used: { booleanValue: false },
        usedAt: { nullValue: null },
        usedByUid: { nullValue: null },
      },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

  console.log(`ok: mentor invite for "${label}" (expires in ${days} days)`);
  console.log("");
  console.log(`  code:  ${rawCode}`);
  console.log(`  local: http://localhost:3000/mentor/join?code=${rawCode}`);
  console.log(`  prod:  https://high-agency.io/mentor/join?code=${rawCode}`);
  console.log("");
  console.log(
    "The code is not recoverable (only its hash is stored) — copy it now.\n" +
      "Note: the prod link only works once the platform flag is on\n" +
      "(NEXT_PUBLIC_PLATFORM_ENABLED=true); until then use local dev."
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
