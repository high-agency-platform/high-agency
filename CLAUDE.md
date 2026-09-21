@AGENTS.md

# High Agency Platform

> **2026-09-21 onboarding revision:** [docs/season1-onboarding.md](docs/season1-onboarding.md)
> supersedes the historical access/feed descriptions below. Students redeem capped,
> expiring Season 1 invites after email verification (`seasonInvites` → `memberships`).
> Existing approved mentors remain supported. Community/feed and peer proof browsing
> are removed; Resources links to Slack. Proof is author/mentor-readable. Students read
> only released milestones through `GET /api/season`; full season reads are mentor-only.
> `npm run dev:qa` starts isolated emulators and separate mentor/student sessions on 3001.

> Always-loaded project baseline. `@AGENTS.md` above is a hard rule, not a footnote:
> this is **Next.js 16 with breaking changes** — read the relevant guide in
> `node_modules/next/dist/docs/` before writing framework code.

## What we're building

High Agency is a live cohort coaching program that teaches ambitious students (13–19,
"Operators") "what school can't teach" — agency, real skill, and a network. This repo is
the **platform that productizes that program**: everyone in the batch walks **one
mentor-written season track** together, submits **proof** for each milestone, attends
live expert workshops, and keeps momentum through a streak and a shared daily feed.

The product thesis: **progress is earned by doing real things, and proof of the thing is
the unit of progress.** The only game mechanic is the streak; there is no XP, no levels,
and nothing is gated by points. Logins and lurking earn nothing.

**Canonical product spec:** [`prd.md`](prd.md) carries a revision note — where it still
describes squads, this file wins.

## Current status — Season 1, free founding batch

- **Branch:** `season-1` is the platform that ships; `main` is frozen at the previous
  squad-based platform (tag `v2-squads`). Vercel's Production Branch is `season-1`.
  **Firestore rules are global to the project** — the rules on this branch are the
  deployed ones; never deploy rules from a `main` checkout.
- **Where we are:** ~30 applicants, **one primary mentor** plus a few guests dropping
  in for workshops, one pre-written curriculum for the first month. Squads — cohorts,
  applications, matching, check-ins, the adoption feed, the unassigned-squad cron —
  were removed on 2026-09-03 because none of it earned its keep at this size.
  Old `cohorts/*` documents still exist in Firestore, inert: no rule matches them.
- **Deployment.** Vercel project `high-agency` (production alias
  `highagencyio.vercel.app`; custom domain `high-agency.io`). The authenticated
  platform is gated behind `PLATFORM_ENABLED` ([`app/lib/flags.ts`](app/lib/flags.ts),
  enforced by [`proxy.ts`](proxy.ts)): on in `next dev`, off in production unless
  `NEXT_PUBLIC_PLATFORM_ENABLED=true`. Strangers are kept out by the temporary access
  gate below. See [`QA-HANDOFF.md`](QA-HANDOFF.md) §1 for the go-live checklist
  (email-link sign-in is **enabled** now; the doc's ⚠️ is historical).
- **This is a small team.** Read the code as intentional unless flagged otherwise.

## ⏳ TEMPORARY: the founding-batch access gate

Production is open to strangers, but **accounts are not**. Only an email on the
`approvedMembers` allowlist can get in. `/login` takes one email and either mails a
single-use Firebase sign-in link or says "not in the batch yet". No Google button, no
password field, no create-account toggle there.

- **`approvedMembers/{email}`** — doc id is the email *trimmed and lowercased*. Fields:
  `role: "operator" | "mentor"` (required), optional `name` / `addedAt` / `note`.
  **Client access is deny-all**; `exists()` still resolves against it in rules.
- **Enforced in two places:** `/api/access/*` (server) and `firestore.rules` —
  creating a `profiles/{uid}` doc requires `isApprovedMember()`.
- **Two ways to become a mentor**, sharing `app/components/MentorOnboarding.tsx` and
  `buildMentorProfile`: the allowlist (`/login` → `/login/verify` →
  `/api/access/mentor-profile`) and the break-glass invite code
  (`/mentor/join?code=…` → `/api/mentor/redeem`). **Keep the invite path working.**
- **Ops:** `node scripts/approve.js <email> operator|mentor ["Name"]`, `--remove`.

**Meant to be deleted in one commit.** Everything gate-specific is named `access*`
(`app/lib/accessGate.ts`, `accessEmail.ts`, `accessClient.ts`, `app/api/access/**`,
`app/(platform)/login/verify/`, `scripts/approve.js`) plus the `approvedMembers` rules
block and the `isApprovedMember()` clause on profile create. Removal checklist at the top
of [`app/lib/accessGate.ts`](app/lib/accessGate.ts).

## ⚠️ Monetization is deferred until after the MVP ships

**DO NOT** add Stripe, checkout, billing, subscriptions, paywall UI, or pricing pages.
`Profile.plan: "free" | "pro"` exists on every profile and **nothing reads it**; leave it
dormant. Everything ships free for the founding batch. Nothing in the MVP is gated by
anything but role. Don't reintroduce a points gate.

## Stack & architecture

- **Next.js 16.2.7** (App Router) · **React 19** · **TypeScript 5** · **Tailwind CSS v4**.
  Deployed on **Vercel**.
- **Firebase 12** (client SDK): Firestore + Firebase Auth. Project **`highagency-62e67`**
  (support email `info@high-agency.io`). `app/lib/firebase.ts`, `.firebaserc`,
  `firebase.json` and every `scripts/*` target this one project.
- **No separate backend service.** Route Handlers under `app/api/**` (`firebase-admin`,
  bypass rules) are the server; [`firestore.rules`](firestore.rules) is the enforcement
  layer for the little that clients still write (their own `profiles` /
  `privateProfiles`, deleting their own feed line). **Treat the rules as
  production-critical code** — a data-shape or write-path change is incomplete until the
  rules and `tests/rules.test.mjs` reflect it.
- **Server-authoritative writes** (all via `app/lib/api.ts` from the browser):
  - `POST /api/season` — the one shared track (`app/lib/seasonServer.ts`).
  - `POST /api/submissions`, `POST /api/submissions/review` — proof (same file).
  - `POST /api/build-log` — the feed (`app/lib/streakServer.ts`).
  - `app/api/workshops/**`, `app/api/google/**` — sessions + Google Calendar
    (`workshopServer.ts`, `googleCalendar.ts`). Unchanged from the squad era.
  - `app/api/consent/**`, `app/api/mentor/**`, `app/api/access/**`, `app/api/hubspot/**`,
    `app/api/cron/hubspot-sync`.
  Server-only libs: `firebaseAdmin.ts`, `serverAuth.ts` (`requireUser`, `requireMentor`,
  `HttpError`, `errorResponse`), `seasonServer.ts`, `streakServer.ts`, `workshopServer.ts`,
  `googleCalendar.ts`, `consentServer.ts`, `mentorInviteServer.ts`, `accessGate.ts`,
  `accessEmail.ts`, `hubspot*.ts`. **Never import these from client components.**
- **Parental consent is enforced in the routes**, not the rules (`consentStatus ===
  "pending"` → 403 `consent-pending` on submit and build-log). The squad-era
  `consentAllows()` rule helper is gone with the squad writes it guarded.
- **Google Calendar (per mentor).** Connect once (`/mentor/you` or the home prompt →
  `/api/google/connect` → `/api/google/callback`); refresh token AES-256-GCM encrypted in
  `googleTokens/{uid}` (deny-all). Every session the mentor schedules gets a Calendar
  event with a Meet room; enrolled operators are invited with the guest list hidden.
  Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`.
- **Two shells, one layout** ([`app/(platform)/layout.tsx`](app/(platform)/layout.tsx)).
  `role == "mentor"` → rail + tab bar with **Home · Track · Workshops · You**
  (`app/(platform)/mentor/**`). Operators → **no rail, no tab bar**: a top bar (brand ·
  flame · avatar → card sheet) over **one page**, `/dashboard`. `/mentor/*` redirects
  operators to `/dashboard`; `/dashboard` redirects mentors to `/mentor`.
- **Break-glass / bootstrap operations run as local Node scripts** (`scripts/`, CLI
  OAuth token, IAM bypasses rules).

## Domain model (the vocabulary)

Types in [`app/lib/types.ts`](app/lib/types.ts); client reads in [`app/lib/db.ts`](app/lib/db.ts);
server writes in `app/lib/api.ts` → `app/api/**`.

- **Operator** — a student member. **Mentor** — staff/expert who writes the season,
  reviews proof, runs workshops. `Role` is `operator | mentor`.
- **Profile** (`profiles/{uid}`) — public, readable by any signed-in user. **Privacy by
  construction:** name is `"First L."`, age is an `AgeBand`, location is country + IANA
  timezone. **No email/phone/DOB/exact city ever.** `pendingApplications` is a
  tolerated legacy field (rules allow it, nothing writes it) — **never make it required
  again**: an update is validated as the whole merged doc.
- **PrivateProfile** (`privateProfiles/{uid}`) — DOB, full name, city, parent email.
  Owner-only, both directions.
- **Season** (`seasons/{id}`) — **THE shared track.** One document, every mentor edits
  it, exactly one is `state: "live"`. `name`, `kind`, `category`, `duration`, `tagline`,
  `overview`, `outcome`, and `milestones: SeasonMilestone[]` (≤20). Each milestone:
  `{ id, title, why, proof, effort, verifier, sessions[] }`. **`id` is stable and never
  regenerated** — submission ids embed it. `updatedAt` is the editor's optimistic-
  concurrency token (a save quotes it; mismatch → `409 stale-write`). Removing a
  milestone that has proof → `409 milestone-has-submissions`. Server-written only.
- **Verifier** — `"open"`: posting proof completes the step and **every member can see
  it** (that *is* the accountability). `"mentor"`: a mentor approves or returns it with
  a note; the proof is private to author + mentors. The mentor's copy says `peer_lead`;
  `normalizeVerifier()` maps it to `open` and **fails closed to `mentor`** on anything else.
- **Submission** (`seasons/{id}/submissions/{uid}__{milestoneId}`) — one per operator per
  milestone; a resubmit overwrites. `status: submitted | approved | returned`. An `open`
  row is born `approved`; a `mentor` row is born `submitted`. **`verifier` is snapshotted
  onto the row at submit time** and the read rule keys off that copy — so flipping a
  milestone mentor→open later never exposes proof made privately. Progress everywhere is
  `status === "approved"` (`seasonProgress`, `nextMilestone`). Any mentor may review any
  row. A return **requires** a note. Nothing is gated: any step in any order.
- **BuildLog** (`buildLogs/{auto}`) — one line a day, one **season-wide feed**. Server-
  written; author may delete own.
- **Streak** (`app/lib/streaks.ts` math, `streakServer.ts` writes) — server-authoritative;
  two qualifying actions: a build log or a proof submission (both call `bumpStreak()`
  inside the same transaction). Freezes: 1 per 7-day run, max 3. "Today" is computed from
  the profile's own timezone. Rules freeze every streak field on every client path.
- **Workshop** (`workshops/`) — any-topic live session with seats (2–200, default 15),
  `enrolledUids` on the doc mirrored to `profile.enrolledWorkshops`. Server-written;
  Calendar-linked when the host is connected. Operators enroll/leave until it starts.
  No attendance tracking.

**Firestore read rules for submissions are split, and a list query is all-or-nothing:**
the public wall must `where("verifier","==","open")`, your own rows `where("uid","==",you)`,
the review queue `where("status","==","submitted")` (mentors). An unfiltered list is
denied for a non-mentor. Every watcher in `db.ts` carries exactly its filter; drop one
and the listener is torn down permanently (`listenerError`). `tests/rules.test.mjs` pins
this.

## Waitlist referrals

Unchanged by the rebuild. The public waitlist has a referral loop
([`app/lib/referral.ts`](app/lib/referral.ts), `REFERRAL_MAX` / `REFERRAL_JUMP`):
`referrals/{code}` public PII-free counters, positions computed as arithmetic on one doc,
staff lead-source codes with `kind: "staff"` (`app/lib/staffReferrals.ts`,
`scripts/staff-referrals.js`), optional marketing opt-in
(`app/lib/marketingConsent.ts`). `applications` is create-only, never readable. Three
implementations of the position model must agree: `referral.ts`, the rules helpers,
`tests/referral.test.mts`.

## Codebase map

- `app/page.tsx` + `app/Waitlist.tsx` + marketing components — the public waitlist at `/`.
- `app/(platform)/` — the product. `layout.tsx` (AuthProvider + role-branched shell).
  **Operator:** `/dashboard` — the whole app (season header, `ShipLine`, `SeasonPath`,
  `WorkshopList`, the feed; `ProfileSheet` from the top-bar avatar or `?you=1`).
  **Mentor:** `/mentor` (review queue, roster, consent queue, sessions, workshop
  composer), `/mentor/track` (`SeasonEditor`), `/mentor/workshops`, `/mentor/you`.
  Bare: `/login`, `/login/verify` (gate), `/onboarding`, `/mentor/join`.
- `app/components/` — `Season.tsx` (`SeasonPath`: the operator accordion + proof form +
  public proof), `SeasonEditor.tsx`, `ReviewQueue.tsx` (`ProofRow`, `ReviewQueue`),
  `ShipLine.tsx`, `ProfileCard.tsx` + `ProfileSheet.tsx`, `mentorData.ts`
  (`useMentorGate`, `useLiveSeason`, `useReviewQueue`, `useRoster`, `useConsentQueue`),
  `ui.tsx` (icons incl. `PathIcon`, `Hud`, `Avatar`, `AvStack`, `Bar`), `WorkshopForm`,
  `WorkshopList`, `CalendarConnect`, `ConsentResend`, `ProfileModal`, `TagField`,
  `MentorOnboarding`, `AuthProvider`.
- `app/lib/` — `types.ts`, `db.ts` (reads + the few client writes), `api.ts`, the server
  libs above, `streaks.ts`, `referral.ts`, `flags.ts`, `countries.ts`.
- `app/styleguide/`, `app/privacy/`, `app/terms/`, `app/consent/[token]/` — public pages.
- `scripts/` — `season.js` + `season-content.json` (load the mentor's track into
  `seasons/s1`; refuses to overwrite without `--force`), `seed.js` (profiles, workshops,
  feed, a few proof rows), `qa-setup.js` (QA fixture + sign-in links —
  [`docs/qa-e2e.md`](docs/qa-e2e.md)), `approve.js`, `mentor-invite.js`, `admin-set.js`,
  `staff-referrals.js`, `hubspot-*.js`, `cleanup-test.js`, `fb-token.js`.
- `firestore.rules`, `design-system.md` (visual SoT — **read before any UI**),
  `prd.md`, `QA-HANDOFF.md`.

## Conventions

- **UI:** [`design-system.md`](design-system.md) ("Operator OS v2 · Arcade Paper",
  **light-mode only**); living reference at `/styleguide`. Warm paper canvas, white tiles
  with a hard bottom edge, two accents with one job each: **ember** = action, **lime** =
  earned. Physical push buttons that travel on press. **Gabarito** for everything, **Geist
  Mono** for numbers (`app/layout.tsx`). Student surfaces carry no paragraphs of chrome —
  the mentor's `why` text is content, not chrome. Colors via CSS variables in
  `app/globals.css` (`--text`, `--text-muted`, `--text-faint`, `--accent`, `--signal` …);
  never hardcode hex. `.path__item.locked` means *not started*, never gated.
- **Privacy is structural.** Minor PII lives only in `privateProfiles/{uid}`. Open proof is
  readable by every member by design; the consent email and `/consent/[token]` say so.
- **Keep the rules and `tests/rules.test.mjs` in lockstep with the data model.**
- **Patterns the lint rules enforce:** no `setState` in effects — tagged snapshots
  (`{ seasonId, subs }`), fallback-until-touched (`edits ?? live`), keyed child components
  that seed at mount, `useSyncExternalStore` + module latch for one-time URL reads.
- **Path alias:** `@/*` → repo root. **Real-content placeholders** in seed data.

## Commands

```bash
npm run dev      # next dev (localhost:3000) — check port 3000 first; never pkill by pattern
npm run build
npm run lint

# Local admin / data tooling (need `firebase login` as info@high-agency.io first):
node scripts/season.js [--force]           # load the mentor's track into seasons/s1
node scripts/seed.js                        # profiles, workshops, feed, proof rows
node scripts/qa-setup.js [--status|--link operator|mentor]
node scripts/approve.js <email> operator|mentor ["Name"]   # founding-batch allowlist
node scripts/mentor-invite.js "<label>" 30  # single-use mentor invite link
node scripts/admin-set.js <uid> mentor      # promote directly (also: consent | pro)
node scripts/cleanup-test.js                # remove smoke-test accounts + their proof

# Tests (wrap the Firestore emulator; pinned firebase-tools@13 devDep):
npm test              # rules + referral + consent + mentor-invite + hubspot + staff-code suites
npm run test:rules    # firestore.rules enforcement (tests/rules.test.mjs)
```

## Gotchas

- **Firebase project is `highagency-62e67`.** `firebase login` as `info@high-agency.io`
  before any `scripts/*`. **Deploy rules only from this branch**, only with
  `npm run test:rules` green: `firebase deploy --only firestore:rules`.
- **`app/api/**` needs Admin credentials in the runtime env** (`FIREBASE_SERVICE_ACCOUNT`
  or `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`) or every server flow — sign-in
  links, consent, the season, proof, build logs, workshops, Calendar — 500s.
- **Firebase web config keys are public by design** (committed). Don't "fix" this.
- **The season editor is last-write-wins without its token.** `SeasonEditor` forks a
  draft with `base = updatedAt` on first edit and sends it as `expectedUpdatedAt`;
  a mismatch is surfaced as a sentence, not a silent clobber. Keep it.
- **Milestone id churn erases progress.** Submission ids embed `milestoneId`. The editor
  round-trips ids; the server mints only for rows without one and refuses to drop an id
  that has proof. Never regenerate ids on save.
- **Legacy fields** (`xp`, `attendedWorkshops`, `lastRitualWeek`, `pendingApplications`,
  `hours` on profiles; `kind` on workshops) are tolerated by the rules and ignored by the
  app. Nothing writes them.
- **`applications`** (waitlist) is create-only, never-readable; the only public readables
  are `meta/waitlist` and `referrals/{code}`.
- **`WeekCal`, `Track.tsx`, `SquadRoster`, `SquadModal`, `match.ts`, `trackTemplates.ts`,
  `checkinServer.ts`, `/api/ritual`, `/api/checkins`, `/cohorts`, `/learn`, `/profile`,
  `/mentor/squads`** no longer exist. If a doc or memory mentions them, it's from `main`.
