import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const production = process.argv.includes("--production");
if (production ? process.env.FIRESTORE_EMULATOR_HOST : !process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Choose --production explicitly, or run against the emulator");
const { createSeasonInvite } = await import("../app/lib/accessGate");
const { adminDb } = await import("../app/lib/firebaseAdmin");
const revoke = process.argv.indexOf("--revoke");
if (revoke !== -1) {
  const id = process.argv[revoke + 1];
  if (!/^[a-f0-9]{64}$/.test(id ?? "")) throw new Error("Supply the seasonInvites document ID");
  await adminDb().collection("seasonInvites").doc(id).update({ revoked: true });
  console.log("Invite revoked; existing members retain access.");
} else {
  const code = await createSeasonInvite(50);
  console.log(`${production ? "https://high-agency.io" : "http://localhost:3001"}/join?invite=${code}`);
}
