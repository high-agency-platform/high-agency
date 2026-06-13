// Exchange the firebase-tools CLI refresh token for a short-lived OAuth
// access token. Used only by local admin scripts (seeding, provider config);
// never shipped to the client.
const fs = require("fs");
const path = require("path");
const os = require("os");

// firebase-tools' public OAuth client (embedded in the CLI itself)
const CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

async function getAccessToken() {
  const store = path.join(
    os.homedir(),
    ".config",
    "configstore",
    "firebase-tools.json"
  );
  const cfg = JSON.parse(fs.readFileSync(store, "utf8"));
  const refreshToken = cfg.tokens && cfg.tokens.refresh_token;
  if (!refreshToken) throw new Error("No firebase CLI refresh token; run `firebase login`.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Token exchange failed: " + (await res.text()));
  const json = await res.json();
  return json.access_token;
}

module.exports = { getAccessToken };

if (require.main === module) {
  getAccessToken().then(
    (t) => console.log(t),
    (e) => {
      console.error(e.message);
      process.exit(1);
    }
  );
}
