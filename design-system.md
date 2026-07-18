# High Agency — Design System

**"Operator OS v2 · Arcade Paper"** — a game console for shipping real things.

Single source of truth for every surface, marketing and product. Tokens live in
[`app/globals.css`](app/globals.css); fonts in [`app/layout.tsx`](app/layout.tsx). The living
reference renders at **`/styleguide`**.

> **Light-mode only.** The warm paper canvas *is* the brand. Mobile-first: most operators
> are on phones.

---

## 0. The idea in one breath

High Agency players are 13–18. They live in Duolingo, Discord and games — not in SaaS
dashboards. So the interface is a **game, played on warm paper**: every interactive thing is
a physical piece you can press, progress is drawn (bars, paths, flames), and the words get
out of the way. **If a screen needs a paragraph to explain itself, the design failed.**

Fun, but not childish — these are builders shipping real products. The toy physics are
precise, the type is confident, the numbers are mono and true.

### The five laws

1. **Show, don't tell.** Icons, numbers, bars, paths. One-word buttons ("Ship", "Join",
   "Verify"). No explanatory sentences on student surfaces — explanation lives in the
   marketing page and the parent consent page only.
2. **Everything pressable is a physical piece.** Tiles and buttons sit on a hard bottom
   **edge** (`box-shadow: 0 Npx 0 <edge>`); pressing travels them down into the paper. Depth
   is edge, not blur.
3. **Two accents, two jobs — unchanged.** **Ember** = action/doing. **Lime** = earned/
   verified (bright lime fills, deep green text). Paper + ink carry ~90% of every screen.
4. **The game state is always on screen.** Streak flame, XP and level live in the shell HUD
   — pages never re-explain them.
5. **Big targets, quick wins.** Tap targets ≥ 44px, primary actions thumb-reachable,
   every screen has one obvious next move.

---

## 1. Color — the palette survives, everything around it changed

Values are identical to v1. Always the CSS variable, never a hex.

### Surfaces
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#F5F2EB` | Page canvas (warm paper, faint dot grid + corner washes). |
| `--surface` | `#FFFFFF` | Tiles, sheets, inputs. |
| `--surface-2` | `#F1EDE4` | Pressed / selected / inset fill, progress tracks. |
| `--surface-3` | `#FBFAF6` | Nested insets. |
| `--border` | `#E9E4D8` | The 2px tile outline. |
| `--border-strong` | `#D8D2C4` | The tile's hard bottom **edge**; input borders. |

### Ink
`--text #211C17` · `--text-muted #6E665B` · `--text-faint #9C9385`.

### Ember — action / doing
`--accent #FF5A1E` · `--accent-hover #F04E14` · `--accent-press #CE400C` (button edge) ·
`--accent-ink #2A1206` · `--accent-soft rgba(255,90,30,.10)` · `--accent-line rgba(255,90,30,.30)`.

### Lime / green — earned / verified / XP / streak
`--signal #C6F24E` (fill) · `--signal-hi #D4FB66` · `--signal-press #8FB534` (edge) ·
`--signal-ink #1B2E00` (text on lime) · `--signal-text #3F8F1C` (green text/icons on light) ·
`--signal-soft rgba(141,201,42,.14)` · `--signal-line rgba(120,170,40,.40)`.

### Functional
`--success #3F8F1C` · `--warn #C2790F` (returned ≠ rejected — never red) ·
`--danger #D63A2C` (errors only, never ember).

---

## 2. Typography — one loud family + mono

| Role | Family | Token | Job |
|---|---|---|---|
| Everything | **Gabarito** 400–900 | `--font` | Display at 800–900 (big, tight, friendly-geometric); UI/body at 400–600. One family = game-UI coherence. |
| Data | **Geist Mono** 500–700 | `--font-mono` | XP, streaks, counts, dates, codes. Numbers that prove work stay mono. |

Fraunces and Schibsted Grotesk are **retired**.

### Scale
| Class | Size | Weight |
|---|---|---|
| `.display` (marketing h1) | `clamp(44px, 9vw, 96px)` | 900, `-0.03em`, lh 0.95 |
| `.h1` (screen title) | `clamp(28px, 5vw, 44px)` | 800 |
| `.h2` | `clamp(22px, 3vw, 30px)` | 800 |
| `.h3` (tile title) | `17–19px` | 700 |
| Body | 16px | 400–500 (body ≥ 16px, always) |
| `.micro` | 11–12px mono | 600, uppercase, tracked — labels/meta only |
| `.num` | context | mono 700, `tnum` |

---

## 3. Shape, depth, space, motion

- **Radii:** `--radius-sm 12` · `--radius 16` (buttons, inputs, chips) · `--radius-tile 22`
  (tiles) · `--radius-lg 28` (sheets/modals) · `--radius-pill 999`.
- **The edge (replaces soft shadows):** resting tiles = `2px solid --border` outline +
  `0 4px 0 --border-strong`. Buttons = `0 5px 0 <press color>`. Press = translateY(+edge),
  edge collapses to 0. One soft ambient shadow (`--shadow-pop`) is reserved for floating
  chrome (modals, tab bar).
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 40 / 64. Screens are `--maxw 1100px`, gutter
  `clamp(16px, 4vw, 48px)`. Tap targets ≥ 44px.
- **Motion:** `--ease-out` for entrances, `--ease-spring` for pops. Press travel ~90ms.
  Earned moments (verify, level-up, streak tick) get one spring pop (`.pop`). Bars animate
  width 0.6s. No ambient loops. `prefers-reduced-motion` kills all of it.

---

## 4. Components (the vocabulary)

### Tiles (`.tile`)
The universal card: white, 2px `--border` outline, `--radius-tile`, hard bottom edge.
- `.tile--tap` — interactive: hover lifts 1px, active travels down (a real piece).
- `.tile--ember` — "your move" surfaces: ember outline + ember-soft tint.
- `.tile--lime` — earned surfaces: lime tint + `--signal-line` outline.
- `.tile--flat` — no edge (quiet lists inside panels, admin density).

### Buttons (`.btn`) — the push, chunkier
Gabarito 700, 16px, `--radius`, min-height 48px (`.btn--sm` 38px). Travel mechanic kept
from v1 but the pieces are thicker:
- `.btn--primary` — ember, white text, `0 5px 0 --accent-press`.
- `.btn--verify` — lime fill, `--signal-ink` text, `0 5px 0 --signal-press`. Earned actions only.
- `.btn--ink` — ink piece, for high-emphasis secondary.
- `.btn--ghost` — white piece with 2px border + border-strong edge (still travels).
- `.btn--block` full width. Disabled: 50%, no travel.
Button copy is **one or two words.**

### HUD (`.hud*`)
The always-on game state, part of the shell: **flame + streak count** (green when alive
today, faint when at risk), **XP pill** (mono), **level ring** (SVG progress ring around the
level number). Pages never repeat these numbers.

### Nav
- **Mobile (≤860px):** fixed bottom **tab bar** (`.tabbar`), 4–5 icon tabs, active = ember
  icon + dot. Safe-area padded. Top bar carries brand + HUD.
- **Desktop:** slim left **rail** (`.rail`, ~92px): logo, icon+word tabs, HUD at bottom.

### Progress
- `.bar` — 14px pill track (`--surface-2`, inset ring), lime charge with a top shine.
  `.bar--ember` for in-progress tracks. `.bar--xs` 8px.
- `.path` — the **quest path** (milestone track): 48px circular nodes on a thick vertical
  rail. `done` = lime fill + green ring + check; `active` = white + ember ring + pulse dot;
  `locked` = faint outline. Node meta is icons + mono numbers, not sentences.
- `.ring` — SVG progress ring (level, squad %).

### Identity
- `.av` — avatar disc (initial, ember-tinted). Sizes 28/36/44. `.avstack` overlaps them —
  the default way to show "who's here" (never a name list when a stack will do).
- `.badge` — chunky pill: `.badge--level` (ember), `.badge--earned` (lime/green),
  `.badge--locked` (dashed). `.xp` — mono `+150` chip in green.
- `.flame` — the streak icon: ember-filled when alive, outline when cold.

### Fields (`.field`)
2px `--border-strong` border, `--radius`, 16px text, 48px min height. Focus = ember border
+ soft ring. Labels are `.micro` mono (one or two words) — or absent when the placeholder
says it all. `.choices`/`.pick` chips are physical pieces too (2px border, edge, press).

### Sheets & modals (`.sheet`)
White, `--radius-lg`, 2px border, `--shadow-pop`; slide-up on mobile (bottom sheet),
centered on desktop. Scrim blurs the paper.

### Icons
Inline SVG, `stroke: currentColor`, width 2–2.2 (thicker than v1 — toy-like). Filled shapes
allowed for the game glyphs (flame, bolt, check seal). No emoji in UI chrome; emoji are
allowed *sparingly* in celebratory copy ("🔥" next to a record streak is fine, one per view).

---

## 5. Voice & copy rules

- Student surfaces: **no paragraphs.** Headings ≤ 4 words, buttons 1–2 words, hints ≤ 6
  words. If it needs more, cut the feature copy, not the clarity: prefer a number, an icon,
  a bar.
- Second person, present tense, zero corporate ("Ship something today", "Your move",
  "Squad's waiting").
- Encouraging on setbacks: returned work says what to fix in the verifier's words — the UI
  itself never scolds. `--warn`, never red.
- **Two exceptions:** the marketing page persuades (sentences allowed, still tight) and the
  **parent consent page** reassures (calm, complete sentences, no game visuals, no slang —
  parents are the one non-teen audience).

## 6. Layout recipes

- **Screen = HUD (shell) + one title word + tiles.** Titles are `.h1` single words or short
  phrases ("Today", "Squads", "Sessions").
- Tile grids: 2-col on desktop, single column on mobile, 12–16px gaps.
- The **quest path** is the spine of the squad screen; everything else hangs off it.
- Empty states: one line + one button. Never a paragraph.
- Admin (mentor console) may be denser (`.tile--flat` lists, tabs) but uses the same pieces.

## 7. Pre-ship checklist

- [ ] Palette untouched: paper canvas, ink, ember = action, lime fill/green text = earned.
- [ ] Every interactive element is a piece: 2px outline, hard bottom edge, press travel.
- [ ] Streak/XP/level appear in the HUD only — never re-stated in page copy.
- [ ] No explanatory paragraphs outside `/` (marketing) and `/consent/*` (parents).
- [ ] Buttons ≤ 2 words. Labels ≤ 2 words or absent.
- [ ] Numbers are mono (`tnum`). Earned numbers are green.
- [ ] Mobile: bottom tab bar, safe-area insets, tap targets ≥ 44px, 390px looks intentional.
- [ ] Errors `--danger`; returned `--warn`; never ember for either.
- [ ] Colors via CSS variables — zero hardcoded hex in components.
- [ ] Reduced motion honored (no travel, no pops, no bar animation).
