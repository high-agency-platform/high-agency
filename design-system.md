# High Agency — Design System

**"Operator OS" · Light edition** — the visual language of a launchpad that rewards proof.

This is the single source of truth for every surface, marketing and product. **Read it
before touching any UI.** Tokens live in [`app/globals.css`](app/globals.css); fonts are
wired in [`app/layout.tsx`](app/layout.tsx). A living reference renders at **`/styleguide`**.

> **Light-mode first, and light-mode only for now.** There is no dark theme in this version
> — the warm paper canvas *is* the brand. (Tokens are structured so a dark theme could be
> reintroduced later behind a `[data-theme]` switch, but don't build one unless asked.)

---

## 0. The idea in one breath

High Agency is a gamified squad-based launchpad for ambitious teenage builders. Status here
is **earned, not bought** — you level up by shipping real things a human verifies. The
interface has to feel like that: bright, warm, premium, and tactile — **a builder's
workshop, not a dark terminal.**

- **Warm paper canvas** (`#F5F2EB`) under a **gentle abstract wash** — a faint warm dot
  grid plus soft ember/lime light pooling in the corners. Atmosphere behind everything,
  never a focal point.
- **White cards that float.** Surfaces carry a soft, warm, layered shadow *by default*
  (askjo-style). On hover they *settle* — the hairline warms and the float deepens a touch,
  with no jump. Depth comes from light, not borders.
- **Two ownable accents, two jobs.** **Ember** is energy and action. **Lime/green** is
  proof — XP, levels, streaks, verified milestones.
- **A 3D "push" CTA.** The primary button rests on a solid darker-ember base edge, lifts on
  hover, and *travels down* when pressed — a real button being pushed. The product's
  signature interaction.
- **Mono for every number that proves work.** XP, levels, streaks, milestone codes and
  timers render in Geist Mono so data reads like instrumentation.

### The brand colors and what they mean
| | Ember `#FF5A1E` | Lime/green |
|---|---|---|
| **Means** | energy · action · *doing* | proof · earned · *verified* |
| **Lives on** | primary CTA, active/in-progress, links-as-emphasis | XP fills, verify button, level/streak chips, verified seals |
| **Forms** | one ember (fills + large text) + a darker base edge for the 3D button | **fill** = bright lime `#C6F24E`; **text/icons** = deep green `#3F8F1C` (readable on light) |

Keep both **scarce**. Paper and ink carry ~90% of every screen; the accents land hard
*because* they're rare. The lime is bright — use it as a **fill** (bars, badges, the verify
button), and use the **deep green** for any earned/verified text or icon on a light surface.

---

## 1. The discipline (anti-slop — evolved, not abandoned)

1. **Gradients** only as **same-hue tonal depth** on small functional surfaces — an XP fill,
   a button's 3D base, the canvas wash. **Never** multi-hue decorative gradients, never a
   gradient as a section background.
2. **The page wash is gentle and abstract.** Soft, low-opacity, large. It must never compete
   with content or tint a card. If you notice it before you notice the headline, dial it back.
3. **Depth is shadow, not chrome.** Cards float on soft warm shadows; avoid heavy borders,
   double outlines, or boxes-inside-boxes.
4. **Accents stay scarce; paper + ink carry the page.**
5. **Layout stays left-aligned and asymmetric.** No perfectly-centered pages.
6. **Real-content placeholders.** A real name, a real milestone — never a striped box.
7. **Mono is for data, not decoration.** Numbers, codes, units, eyebrows/labels. Not body.

---

## 2. Color

Flat tokens in `:root`. **Always use the variable**, never a hardcoded hex.

### Surfaces — warm paper + white floating cards
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#F5F2EB` | Page canvas. The abstract wash is layered on top via `background-image`. |
| `--surface` | `#FFFFFF` | Cards, panels, inputs — float above the paper on `--shadow-md`. |
| `--surface-2` | `#F1EDE4` | Hover / inset / selected fill. |
| `--surface-3` | `#FBFAF6` | Nested insets (evidence boxes, composer fields). |
| `--border` | `#E9E4D8` | Hairline borders, dividers. |
| `--border-strong` | `#D8D2C4` | Input borders, ghost edges. |

### Text — warm ink
| Token | Hex | Use |
|---|---|---|
| `--text` | `#211C17` | Primary text, headings. |
| `--text-muted` | `#6E665B` | Body copy, secondary. |
| `--text-faint` | `#9C9385` | Labels, eyebrows, meta, captions. |

### Ember — brand / energy / doing
| Token | Hex | Use |
|---|---|---|
| `--accent` | `#FF5A1E` | Primary CTA fill, active states, links-as-emphasis, key numbers. |
| `--accent-hover` | `#F04E14` | Hover — **darker** on a light bg. |
| `--accent-press` | `#CE400C` | The 3D button's solid base edge. |
| `--accent-ink` | `#2A1206` | Dark text on ember (when not using white). |
| `--accent-soft` | `rgba(255,90,30,.10)` | Tint fills, selected chips, focus rings. |
| `--accent-line` | `rgba(255,90,30,.30)` | Tinted borders on selected/owned surfaces. |

Primary buttons use **white** text on ember (with a 1px dark text-shadow for crispness).

### Lime / green — earned / verified / XP / level / streak
| Token | Hex | Use |
|---|---|---|
| `--signal` | `#C6F24E` | The bright **fill**: XP bars, verify button, earned badge backgrounds. |
| `--signal-hi` | `#D4FB66` | Top of an XP fill, hover. |
| `--signal-press` | `#8FB534` | The 3D base edge under a lime button; verified ring. |
| `--signal-ink` | `#1B2E00` | Dark text on a lime fill. |
| `--signal-text` | `#3F8F1C` | **Readable green for earned/verified TEXT + icons** on light. |
| `--signal-soft` | `rgba(141,201,42,.14)` | Tint fills, earned chips. |
| `--signal-line` | `rgba(120,170,40,.40)` | Tinted borders on earned surfaces. |

### Functional
| Token | Hex | Use |
|---|---|---|
| `--success` | `#3F8F1C` | "Verified" status text, live blips (the same green as earned). |
| `--warn` | `#C2790F` | "Returned", attention. Never red — *returned ≠ rejected*. |
| `--danger` | `#D63A2C` | **Errors only.** Never reuse ember for errors. |

### Glass & elevation
Frosted **white** glass: `--glass-bg` `rgba(255,255,255,.72)` · `--glass-bg-strong`
`rgba(255,255,255,.84)` · `--glass-border` `rgba(33,28,23,.08)` · `--glass-blur` `16px`.
Shadows are soft and warm (brown-toned, not black): `--shadow-sm/md/lg` (cards default to
`--shadow-md`, hover `--shadow-lg`), plus the one colored glow `--shadow-ember` under the CTA.

### The abstract canvas (don't hand-roll your own)
It's defined once on `body` and is `background-attachment: fixed`: a faint dot grid
(`rgba(86,66,38,.05)`, 26px) + an ember wash top-right + a lime wash bottom-left + a soft
ember pool below. Page sections sit on it transparently; cards cover it. Don't add competing
page backgrounds — let this show through the gutters.

---

## 3. Typography

Three faces, three jobs. Loaded via `next/font/google` in `app/layout.tsx`.

| Role | Family | Variable | Job |
|---|---|---|---|
| **Display** | **Fraunces** (600–700) | `--font-display` → `--font-head` | Headlines, mastheads, card titles. A high-contrast serif — distinctive, premium, characterful, and very readable at scale. The brand voice. |
| **Body / UI** | **Schibsted Grotesk** (400–600) | `--font-text` → `--font` | Everything you read. Clean, modern, friendly grotesque. |
| **Mono / data** | Geist Mono (500–600) | `--font-geist-mono` → `--font-mono` | XP, levels, streaks, milestone codes, units, eyebrows, timers. |

The serif-display / grotesk-body pairing is deliberate: it reads crafted and ambitious
rather than another templated tech sans. Set headings with `font-optical-sizing: auto` so
Fraunces uses its display optical size at large sizes.

### Scale
| Role | Size | Weight | Notes |
|---|---|---|---|
| Display (`.display`, h1) | `clamp(46px, 8.5vw, 104px)` | 600 | `line-height: .98`, `letter-spacing: -.025em`. Left-aligned. |
| Masthead title | `clamp(44px, 9vw, 116px)` | 600 | `-.03em`. The page's name, oversized. |
| h2 (`.h2`) | `clamp(30px, 5vw, 54px)` | 600 | `-.022em`. |
| h3 (`.h3`) | `clamp(19px, 2vw, 23px)` | 600 | `-.012em`. |
| Lead (`.lead`) | `clamp(17px, 1.5vw, 20px)` | 400 | `--text-muted`, `max-width: 62ch`. Schibsted. |
| Body | `16px` | 400 | `line-height: 1.6`. **Never below 16px** for paragraphs. |
| Eyebrow (`.eyebrow`, `.kicker`) | `11px` | 500 | **Mono**, uppercase, `letter-spacing: .1–.14em`, `--text-faint`. |
| Data figure (`.mono`) | varies | 600 | Mono, `tnum` on. XP / level / streak numbers. |

---

## 4. Spacing, radii, motion

**Spacing:** `--space-xs 4` · `--space-tight 8` · `--space-sm 12` · `--space-gap 24` ·
`--space-cta 48` · `--space-lg 64`. Section padding `clamp(64px, 9vw, 120px)`; gutter
`clamp(20px, 5vw, 64px)`; `--maxw 1240px`.

**Radii (friendly + tactile):** `--radius-xs 8` · `--radius 12` (inputs, buttons) ·
`--radius-card 20` (cards, panels) · `--radius-lg 28` (modals) · `--radius-pill 999`
(chips, badges, avatars, XP bars). Slightly softer than a typical app — warmer, more toy-like.

**Motion:** easings `--ease-out` (entrances) and `--ease-spring` (the button + pops).
Durations `--t-fast .15s`, `--t-med .25s`, `--t-slow .5s`.
- Entrances: opacity + `translateY(≤18px)`, staggered via `data-d`.
- The **3D push button** (see below) is the signature interaction.
- Earned moments (verify, level-up) may use a brief spring pop — never an ambient loop.
- **No** infinite ambient animation (the canvas wash is static).
- Honor `prefers-reduced-motion: reduce` — entrances and all button transforms disabled.

---

## 5. Components

### Buttons (`.btn`) — the 3D push
Rounded (`--radius`), 15px/600. Variants:
- **`.btn--primary`** — the signature **ember push button**. White text, sits on a solid
  `--accent-press` base edge (`box-shadow: 0 4px 0`) + a soft ember glow. **Hover** lifts it
  (`translateY(-2px)`, base grows to 6px). **Active** travels it down (`translateY(4px)`,
  base collapses to 0) — it physically depresses into the page.
- **`.btn--signal`** — same push mechanic in lime/green, for verify/earned actions.
- **`.btn--neutral`** — ink push button for high-emphasis secondary.
- **`.btn--ghost`** — quiet white outline that warms to ember on hover (small lift, no base).
- **`.btn--accent`** — alias of primary.
- Disabled `opacity .5`, no travel.

### Inputs / fields (`.field`)
White `--surface`, `1px --border-strong`, `--radius`, 16px text. Label above in **mono**
uppercase `--text-faint`, 8px gap. Focus: `border --accent` + `0 0 0 3px --accent-soft`.
Placeholder `--text-faint`. Nested composer/inline fields use `--surface-3`.

### Cards / panels (`.panel`, `.pillar`, `.ccard`, `.dossier`, `.season-map`)
White `--surface`, hairline `--border`, `--radius-card`, **`--shadow-md` by default** —
they float. On hover, cards *settle* rather than jump: the hairline warms to
`--border-strong` and the shadow deepens to `--shadow-lg` with **no `transform`**. **Owned/mine**
surfaces wear an `--accent-line` ring; **earned** surfaces wear `--signal-line`.

### Glass (`.glass`, nav, `.side` rail, modals)
Frosted white: `--glass-bg` + `backdrop-filter: blur() saturate()` + hairline border. Nav
and modals are glass; the sidebar rail is solid white with a soft shadow.

### Gamification vocabulary
- **XP / progress meter (`.meter`)** — 9px pill, light track, **lime** charge.
  `.meter--ember` for in-progress (not-yet-earned) tracks.
- **Level badge (`.badge--level`)** — mono, ember-tinted pill (Cadet → Builder → Operator →
  Closer → Architect).
- **Earned badge / verified (`.badge--earned`)** — mono, green-tinted pill.
- **XP pill (`.xp-pill`)** — mono green on a lime tint, e.g. `+10 XP`.
- **Milestone track (`.track__item`)** — numbered mono `.track__dot`; `.active` = ember ring,
  `.done` = lime fill + green ring. `.track__returned` uses `--warn`.
- **Streak (`.side__streak`)** — green-tinted chip, flame + count in green mono.

### Chips & pickers (`.chip`, `.pick`)
Pill-shaped. `.pick.sel` / `.chip--on` / `.chip--gate` = ember-tint. `.chip--why` /
`.chip--open` (earned, open-to-all) = green-tint. `.chip--want` = dashed ghost.

### Icons
Monochrome outline only (Feather/Lucide, `stroke: currentColor`, `~1.6`). Color comes from
context, never a glow. Never filled, multicolor, or emoji.

---

## 6. Layout

- **Asymmetric by default.** Two-column sections use uneven ratios (`.8fr 1.2fr`, `1.1fr .9fr`).
- Hero left-aligned, single column, ~800px, over the canvas wash (and an optional faint
  `.blueprint` grid for extra texture).
- The product shell is a **white sidebar rail** + scrolling main. Page headers are oversized
  **mastheads** (Fraunces) that name the screen.
- Grids carry stats/cards; let light + spacing — not boxes-on-boxes — do the work.

---

## 7. Pre-ship checklist

- [ ] Light only. Warm paper canvas with the gentle wash showing through gutters.
- [ ] Cards are white and **float** (soft warm shadow by default; settle — not lift — on hover).
- [ ] Only the two accents, scarce. Ember = action, lime/green = earned. Never mixed up.
- [ ] Lime as **fill**; deep green (`--signal-text`) for earned/verified **text + icons**.
- [ ] Primary/verify buttons use the 3D push (base edge + travel-on-click).
- [ ] No multi-hue/decorative gradients; the wash is gentle and never tints a card.
- [ ] Earned numbers (XP, level, streak) are **mono + green**.
- [ ] Fraunces headlines, Schibsted Grotesk body, Geist Mono data. Body ≥16px.
- [ ] Headlines left-aligned; layout asymmetric, not centered.
- [ ] Errors use `--danger`, not ember. Returned uses `--warn`, not red.
- [ ] Colors via CSS variables — zero hardcoded hex in components.
- [ ] Motion is opacity/translate (+ the button push); reduced-motion honored.
