# Local end-to-end QA — operator + mentor side by side

The repeatable way to exercise both apps against the live `highagency-62e67`
project from `next dev`, with no email round-trip and two accounts signed in at
once. Written for Claude driving the Browser pane, but it is the same for a human.

## The fixture (already provisioned — never recreate by hand)

| | Operator | Mentor |
|---|---|---|
| Email (allowlisted) | `saiamartya19+qa-operator@gmail.com` | `saiamartya19+qa-mentor@gmail.com` |
| Profile | `QA O.` · operator · 18+ · consent granted | `QA M.` · mentor |
| Browser origin | `http://localhost:3000` | `http://127.0.0.1:3000` |

There is no squad. Both accounts work against **the live season** — `seasons/s1`,
loaded from the mentor's copy by `scripts/season.js` — and the shared feed.

```bash
node scripts/qa-setup.js --status     # read-only report: allowlist, uids, the season, proof so far
node scripts/qa-setup.js              # repair: re-add allowlist entries
node scripts/season.js                # load seasons/s1 if it's missing (refuses to overwrite)
node scripts/seed.js                  # seed profiles, workshops, feed lines, a few proof rows
```

Idempotent, never deletes. To wipe test accounts and their proof:
`node scripts/cleanup-test.js`. Needs `firebase login` as `info@high-agency.io`
(CLI OAuth token, like every `scripts/*`) — if a script says the credentials are
invalid, run `firebase login --reauth` and retry.

## One-time local setup

1. **`.env.development.local`** (gitignored) containing just `RESEND_API_KEY=`.
   A blank key turns off Resend, so `/login` prints the sign-in link to the dev-server
   console instead of emailing it ("dev inbox", `app/lib/accessEmail.ts`). `.env`
   keeps the real key for everything else. Next reloads it without a restart.
2. **`next.config.ts` → `allowedDevOrigins: ["127.0.0.1"]`** (committed). Without it
   Next 16 blocks dev assets on the second origin, the page never hydrates, and the
   login form does a native GET to `/login?`.

Why two origins: Firebase Auth keeps one session per origin (IndexedDB), so
`localhost` and `127.0.0.1` hold independent logins in one browser profile. Both
sessions survive reloads and full navigations.

## Signing in (about 20 seconds per account)

**Fastest — mint a link directly** (no browser form, no log):

```bash
node scripts/qa-setup.js --link operator    # prints a http://localhost:3000/login/verify?… URL
node scripts/qa-setup.js --link mentor      # prints a http://127.0.0.1:3000/login/verify?… URL
node scripts/qa-setup.js --link you@x.com   # any allowlisted address (lands on localhost)
```

Open the printed URL. `/login/verify` asks for the email once (it wasn't requested
from that browser), then signs you in and routes by role. Same Identity Toolkit call
the app makes, so it exercises `/login/verify` + `/api/access/claim` for real; only
the `/login` form and the email transport are skipped.

**Through the product** (exercises the `/login` form too):

1. Open `<origin>/login`, enter the QA email, submit. Expect "Check your inbox."
2. Read the dev-server log (`preview_logs` with search `[access]`, or the terminal):
   ```
   [access] Sign-in link: https://highagency-62e67.firebaseapp.com/__/auth/action?apiKey=…&mode=signIn&oobCode=…&continueUrl=http://localhost:3000/login/verify&lang=en
   ```
3. Open **on the same origin the request was made from**:
   `<origin>/login/verify?apiKey=<apiKey>&mode=signIn&oobCode=<oobCode>&lang=en`.
4. Returning operator → `/dashboard`; returning mentor → `/mentor`.

Codes are single-use and short-lived; a used or mistyped one shows "This link has
expired" — just request another. `/api/access/request` rate-limits to 5 per 15 min
per email and per IP (in-process, so a dev-server restart clears it).

## Driving it from the Browser pane (Claude)

- One tab per origin (`tabs_create` → `navigate`). Refs from `read_page`/`find` are
  per tab and go stale after navigation.
- `form_input` works for text inputs and `<select>`s on these React forms. It does
  **not** fire React's change handler on checkboxes — use a real click.
- If a `ref` click does nothing, take a `screenshot` and click by coordinate.
- Every write is real data in the real project. Name anything new `QA …`.

## What to check after a change

- **Operator — one page, `/dashboard`:** season header + progress bar; **Ship one
  line** (post → tile flips lime, flame moves once per day, line lands in the feed);
  **the track** (accordion: the step you're on is open; open step → Post proof →
  turns done with a pop and the next step opens; mentor step → "In review"; returned
  → the note + Fix & resend); **Next sessions** (Enroll / Leave / Replays); **the
  feed**; the avatar in the top bar opens **your card** as a sheet (`?you=1` too).
  No rail, no tab bar at any width.
- **Mentor:** `/mentor` (Review queue with Approve / Return-with-note, Operators
  roster with progress, "New workshop" composer, calendar prompt, consent queue),
  `/mentor/track` (edit the season: metadata, steps, verifier toggle, reorder;
  a step with proof can't be removed), `/mentor/workshops` (week calendar,
  edit/delete own), `/mentor/you` (card + Google Calendar connect).
- **Cross-role loops need both tabs:** mentor edits the track → operator's page
  updates live; operator posts proof on the mentor step → it appears in the review
  queue; mentor returns it → operator sees the note; mentor approves → progress bar
  moves on both sides; mentor schedules a workshop → operator enrolls → seat count
  moves. A second operator **cannot** see someone's mentor-reviewed proof (check the
  console for a rules denial). Two mentors saving the track at once → the second
  gets the stale-write sentence.
  Role guards: operator on `/mentor` → `/dashboard`; mentor on `/dashboard` → `/mentor`.
- Google Calendar is optional locally. Without `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  in `.env.local` the connect card says so and sessions take a pasted Meet link.
- `npm test` for rules/model changes; the QA accounts do not replace it.
