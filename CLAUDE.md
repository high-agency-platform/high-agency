@AGENTS.md

# High Agency Platform

> Always-loaded project baseline. `@AGENTS.md` above is a hard rule, not a footnote:
> this is **Next.js 16 with breaking changes** — read the relevant guide in
> `node_modules/next/dist/docs/` before writing framework code.

## What we're building

High Agency is a live cohort coaching program that teaches ambitious students (13–19,
"Operators") "what school can't teach" — agency, real skill, and a network. This repo is
the **platform that productizes that program**: a gamified, cohort-based launchpad where
Operators join a tight squad, progress a track of real-world milestones (ship an MVP,
land first users, reach first revenue), attend live expert workshops, and keep momentum
through streaks and accountability between sessions.

The product thesis: **progress is earned by doing real things and verified by a human, not
by completing solo theory exercises.** Gamification rewards verified real-world output, not
logins or lurking.

**Canonical product spec:** [`prd.md`](prd.md) (PRD v1.0, 2026-06-06). When code and PRD
disagree, that's a flag to raise — except where this file explicitly records a decision or
an open question that supersedes the PRD.

## Current status — Phase 1 MVP, free founding batch

- **Where we are:** building the Phase 1 MVP for a **free founding batch of ~50 students**.
  The public waitlist site (`/`) is live; the platform (`app/(platform)/...`) is in active
  build.
- **Scale target:** low hundreds of concurrent users for v1; architecture shouldn't
  preclude low thousands without a rewrite.
- **This is a small team.** Most of the current platform code landed in commit `28b5d62`
  and reflects considered product decisions — some of which **deliberately diverge from
  `prd.md`** (see Open questions). Read the code as intentional unless flagged otherwise.

## ⚠️ Monetization is deferred until after the MVP ships

This is a standing constraint. The freemium model (free core + paid mentorship tier) is
**designed but not implemented**, and we are **not building it now**:

- **DO NOT** add Stripe, checkout, billing, subscriptions, dunning, refunds, paywall UI,
  or pricing pages. There is no payment integration and none should appear during the MVP.
- **DO** preserve the *entitlement scaffolding* that already exists so the line can be
  switched on later without re-architecture:
  - `Profile.plan: "free" | "pro"` — wired, but everyone is `free` in batch 1.
  - `BATCH1_ALL_FREE = true` in [`app/lib/gamify.ts`](app/lib/gamify.ts) — keep it `true`.
    `canEnroll()` already gates "Pro" workshops but short-circuits to free while this flag
    is on. New gated features should tag free-vs-paid the same way and stay free in batch 1.
- **Everything ships free** for the founding batch. The point of batch 1 is to validate the
  engagement loop and harvest proof (testimonials, shipped outcomes), *then* turn on pricing.
- Tagging a feature as eventually-paid is fine and encouraged (keeps the line movable);
  *implementing the wall* is out of scope.

Access in the MVP is gated by **earned Operator Level**, not by payment ("access you earn,
not buy"). Don't conflate level gates with paywalls.

## Stack & architecture

- **Next.js 16.2.7** (App Router) · **React 19** · **TypeScript 5** · **Tailwind CSS v4**
  (via `@tailwindcss/postcss`). Deployed on **Vercel**.
- **Firebase 12** (client SDK): **Firestore** for data, **Firebase Auth** (Google SSO +
  email/password) for identity. Firebase project id is **`canary-os`** (reused infra — the
  brand is "High Agency"; don't be thrown by the project name).
- **No separate backend service. No Python/Flask. No Vertex AI service.** The PRD's old
  Python assumption is dropped (and `prd.md` is updated to match).
- **Firestore security rules *are* the backend.** All v1 data access goes through the
  Firebase client SDK directly from the browser; [`firestore.rules`](firestore.rules) is
  the substantial, authoritative enforcement layer (validation, ownership, immutability,
  bounded XP writes). Treat the rules as production-critical code — when you change a data
  shape or a write path, update the rules in the same change.
- **Direction of travel:** sensitive / must-not-be-client-trusted logic (entitlement
  decisions, milestone-verification XP payouts, attendance, streak integrity) should
  **migrate into Next.js server actions / route handlers** over time rather than staying
  client-trusted. Several v1 mechanics are explicitly "client-trusted v1" (see Gotchas) and
  are the natural first candidates to move server-side.
- **Admin operations run as local Node scripts**, not in-app. They authenticate with the
  firebase-tools CLI OAuth token (IAM bypasses security rules) — see `scripts/`. There is
  no in-app admin panel.

## Domain model (the vocabulary)

Types live in [`app/lib/types.ts`](app/lib/types.ts); data access in
[`app/lib/db.ts`](app/lib/db.ts).

- **Operator** — an ambitious student member (primary persona). **Mentor** — staff/expert
  who verifies advanced milestones and runs workshops (`Role` is `operator | mentor`,
  mentor set by admin script).
- **Profile** (`profiles/{uid}`) — the public artifact cohorts evaluate. **Privacy by
  construction:** display name is `"First L."`, age is an `AgeBand` (`13-15 | 16-17 | 18+`),
  location is country + IANA timezone. **No email/phone/DOB/exact city ever.** Readable by
  any signed-in user (it *is* the cohort application).
- **PrivateProfile** (`privateProfiles/{uid}`) — DOB, full name, exact city, parent email.
  **Owner-only, both directions, never listed.** This split is a hard minor-PII requirement.
- **Cohort / "squad"** (`cohorts/{id}`) — an accountability squad of **3–8** operators
  (`COHORT_MIN_TO_ACTIVATE = 3`, `COHORT_MAX_MEMBERS = 8`). States: `forming → active →
  stalled → archived`. A founder commits a weekly **ritual** slot (deliberate friction).
  Members share one track and a weekly ritual streak. Subcollections: `applications/`,
  `submissions/`, `logs/`.
- **Milestone track** — the default 8-week **Ignition Track** (7 milestones) in
  [`app/lib/milestones.ts`](app/lib/milestones.ts), from "Mission Locked" to "Demo Day".
  Evidence specs are deliberately brutal-specific to keep verification cheap. Milestones
  **1–3 are verified by the cohort's peer-lead; 4–7 by a mentor.** Custom tracks are batch-2.
- **MilestoneSubmission** (`submissions/{milestoneId}_{uid}`) — **per-operator** evidence
  (doc id enforces one-per-operator-per-milestone; resubmits overwrite). Status
  `submitted → returned | verified`. **Returned ≠ rejected** — it comes back with a specific,
  non-punitive reason and a resubmit path, and never breaks a streak.
- **BuildLog** (`logs/`) — daily one-line "what I shipped" updates; described in code as
  "the sleeper feature." The cheapest qualifying action that keeps a streak alive.
- **Workshop** (`workshops/`, staff-seeded, read-only to clients) — live Google-Meet
  sessions / office hours. The one `open` workshop per season is free to all; others are
  level-gated (and, post-MVP, plan-gated). v1 uses Google Meet links, not in-app video.
- **Gamification** (`app/lib/gamify.ts`): **XP** (≈70% of achievable XP flows through
  verified real-world milestones), **5 Operator Levels** (Cadet → Builder → Operator →
  Closer → Architect) that unlock access/status, and **streaks** with banked freezes (earn
  1 per 7-day run, max 3; a freeze covers exactly one missed day). A "day" is the user's
  **local** day; the weekly ritual cadence is the ISO week.
- **Matching** ([`app/lib/match.ts`](app/lib/match.ts)) — tag overlap + timezone band +
  skills-wanted scoring with "why matched" chips. No embeddings yet (deliberate).

## Codebase map

- `app/page.tsx` + `app/Waitlist.tsx` + `app/components/*` — the public **waitlist /
  marketing** site at `/` (outside the platform shell; writes to the `applications`
  collection via [`app/lib/firebase.ts`](app/lib/firebase.ts) `submitApplication`).
- `app/(platform)/` — the authenticated **product**, wrapped by
  [`app/(platform)/layout.tsx`](app/(platform)/layout.tsx) (AuthProvider + sidebar Shell;
  `/login` and `/onboarding` render "bare"). Routes: `/login`, `/onboarding`, `/dashboard`,
  `/cohorts`, `/cohorts/[id]`, `/profile`, `/learn`.
- `app/components/AuthProvider.tsx` — client auth context (`useAuth()` → `{ user, profile,
  logout }`); `user`/`profile` are `undefined` while resolving, `null` when absent.
- `app/lib/` — `types.ts`, `firebase.ts` (config + waitlist), `db.ts` (all Firestore CRUD +
  live `watch*` subscriptions), `gamify.ts` (XP/levels/streaks/entitlements), `milestones.ts`
  (the track), `match.ts` (cohort matching).
- `scripts/` — local admin/dev tooling (Node, REST + firebase CLI OAuth):
  `seed.js` (squads, profiles, workshops), `seed-courses.js` (Learn modules),
  `admin-set.js` (`<uid> consent|mentor|pro`), `cleanup-test.js`, `test-applicant.js`
  (exercises the security rules as a real client), `fb-token.js` (token helper).
- `firestore.rules` — the enforcement backend. `design-system.md` — visual SoT (read before
  any UI). `prd.md` — product spec. `High Agency Waitlist (standalone).html` — a standalone
  export of the waitlist (reference artifact).

## Open product questions (record, don't silently resolve)

- **Track model — UNRESOLVED.** `prd.md` describes **one shared track per cohort, mentor-
  verified once per cohort.** The code implements a **per-operator "squad model"**: each
  operator builds their *own* venture and submits *own* evidence per milestone; peer-lead
  verifies 1–3, mentor verifies 4–7; a cohort "completes" a milestone when ~75% of the squad
  is verified (`squadThreshold` in `milestones.ts`). **Neither is locked.** Do not assume one
  over the other or quietly "fix" the code to match the PRD — surface the divergence and let
  the team decide. If a decision gets made, update `prd.md`, this file, and the code together.

## Conventions

- **UI:** [`design-system.md`](design-system.md) is the visual source of truth — read it
  before touching UI. Hard "anti-slop" rules: flat solid colors only (no gradients, glass,
  glows), Inter only, no emoji/glyph icons or icons-inside-buttons, left-aligned/asymmetric
  layout, body text ≥16px, colors via CSS variables in `app/globals.css` (never hardcode hex).
- **Privacy is structural, not incidental.** Never put minor PII (email, DOB, full name,
  exact city) on the public `Profile` or anywhere client-readable; it lives only in
  `privateProfiles/{uid}`. Any new community/cross-cohort surface needs moderation/reporting.
- **Keep the rules in lockstep with the data model.** A data-shape or write-path change is
  incomplete until `firestore.rules` reflects it.
- **Path alias:** `@/*` → repo root (e.g. `@/app/lib/db`).
- **Real-content placeholders** in seed/test data — never striped boxes or lorem.

## Commands

```bash
npm run dev      # next dev (localhost:3000)
npm run build    # next build
npm run lint     # eslint

# Local admin / data tooling (need `firebase login` first):
node scripts/seed.js                     # seed squads, profiles, workshops
node scripts/seed-courses.js             # seed Learn modules
node scripts/admin-set.js <uid> consent  # grant parental consent (also: mentor | pro)
node scripts/cleanup-test.js <cohortId>  # remove smoke-test artifacts
```

There is **no automated test suite** yet; `scripts/` are manual smoke-test + seed/admin
helpers.

## Gotchas

- **`canary-os`** is the Firebase project id and `canaryos88@gmail.com` the support email —
  reused infra for the "High Agency" brand. Expected, not a misconfiguration.
- **Firebase web config keys are public by design** (committed in `app/lib/firebase.ts`);
  security comes from Firestore rules, not from hiding keys. Don't "fix" this by removing
  them. They're overridable via `NEXT_PUBLIC_FIREBASE_*` env vars.
- **Several mechanics are "client-trusted v1"** — streak updates, self-reported workshop
  attendance, and verifier XP payouts are written from the client (rules bound XP writes but
  trust the client otherwise). These are intentional shortcuts for the founding batch and the
  prime candidates to move into server actions/route handlers. Don't treat them as airtight.
- **`applications`** (waitlist) is a create-only, never-readable collection (applicant PII);
  the only public readable is the `meta/waitlist` counter. Don't add read paths to it.
