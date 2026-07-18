# DESIGN-NOTES — "Operator OS v2 · Arcade Paper"

Full UI/UX overhaul, 2026-07-13. Color palette values preserved exactly; everything else
rebuilt. New brief: [`design-system.md`](design-system.md) · living reference: `/styleguide`.

## The system (what changed globally)

- **Type:** Fraunces + Schibsted Grotesk retired → one family, **Gabarito 400–900**
  (game-title confident at 900, friendly at body weights) + Geist Mono for every number.
- **Depth language:** soft floating shadows → **physical pieces**: 2px outline + hard bottom
  edge (`0 4px 0`), press = travel down. Buttons, tiles, chips, pickers all share the mechanic
  (the v1 push-button idea, promoted to the whole system).
- **Game state = HUD:** streak flame, XP pill, level ring live in the shell (rail foot on
  desktop, top bar on mobile) — pages never restate them. Killed the 4-stat dashboard grid.
- **Copy law:** no paragraphs on student surfaces; headings ≤ 4 words, buttons 1–2 words
  ("Ship", "Verify +250", "We met +25"). Sentences survive only on `/` and `/consent/*`.
- **Mobile-first nav:** desktop sidebar → slim icon rail; mobile → sticky top HUD bar +
  **fixed bottom tab bar** (Duolingo-style, safe-area padded, 52px targets).
- New shared primitives in `app/components/ui.tsx`: icons, `Hud`, `LevelRing`, `Avatar`,
  `AvStack`, `Bar`. `globals.css` rewritten end-to-end (tokens kept, components new).

## Per surface

- **Landing (`/`, Waitlist.tsx):** chunky 900-weight hero, stat tiles, three "what you join"
  cards, and a real **product teaser** — the quest path with done/active/locked nodes, XP
  chips and HUD pills replaces the abstract node list. Marquee/FAQ/mentor kept, restyled.
  ApplyModal logic untouched.
- **Login:** full-page hero → compact centered "gate": logo piece, "Ready to build?", Google
  button, email fallback. Same auth code.
- **Onboarding:** same 2 steps, fields, minor/consent logic; copy cut ~70% ("Who are you?" /
  "What's your thing?"), progress bar + step counter, labels down to 1–2 words.
- **Dashboard:** greeting + two-column tiles: **Ship one line** (build-log composer, ember
  "your move" → lime "shipped today" state), **Next up** (active path node + track bar),
  squad card (avatar stack + squad flame), this-week sessions. No stat cards, no masthead.
- **Squads (`/cohorts`):** masthead → one word ("Squads"). Cards carry avatar stacks, match
  chips, meet slot; inline apply box tightened. Create form trimmed.
- **Squad home (`/cohorts/[id]`):** rebuilt around the **quest path** — 48px nodes (lime
  check / ember ring / faint locked), XP chips, `n/m` verified counts. Evidence spec, my
  state, submit/resubmit forms and the verifier queue hang off the active node. Ritual is a
  single lime push button ("We met +25"). Build log + applications ("Wants in") as side tiles.
  All Firestore logic unchanged.
- **Learn:** date-block session rows with one-word actions (Join / Enroll / I went / Watch),
  lock chips for level gates, season map rendered as a path.
- **Profile ("You"):** lime **player card** (big avatar, level badge, XP bar to next level,
  banked freezes) above the edit form. Save logic byte-identical.
- **Admin:** same features (workshop CRUD, consent queue), new pieces — pill tabs, flat
  tiles, sm buttons; kept denser per brief, explanatory paragraph deleted.
- **Consent (`/consent/[token]`):** calm variant — full sentences kept for parents, no game
  visuals; card restyled to the new tile. API logic untouched.
- **Styleguide:** rewritten to showcase v2 (swatches, type, buttons, HUD, tiles, path,
  identity, fields, feedback states).

## Fixes / cleanups along the way

- Removed dead `app/components/Ticker.tsx` (never imported).
- Fixed a latent mobile bug: `.capture__field` flex-basis became *height* when the email
  capture stacked to a column (~230px-tall input on phones).

## Verification

- `npm run build` ✓ clean (all 14 routes). `npm run lint`: 17 pre-existing problems on the
  base commit, 17 after — none introduced.
- Headless-Chrome screenshots at 1440px and 390px for `/`, `/login`, `/styleguide`,
  `/consent/*` — all intentional at both sizes. Authed screens verified by build + review
  (no data writes against the live Firebase project, per constraints).
