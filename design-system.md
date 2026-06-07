# High Agency — Design System

The single source of truth for the waitlist site's visual language. **Read this before
touching any UI.** Every rule here exists to keep the site flat, sharp, and free of the
generic "AI-generated" look (gradients, glows, glassmorphism, decorative clutter).

If a change conflicts with this document, the document wins — or update the document
first, deliberately.

---

## 0. Non-negotiables (the anti-slop rules)

These override taste, convenience, and habit:

1. **Flat, solid colors only.** No gradients (`linear-gradient`, `radial-gradient`,
   `conic-gradient`). No glassmorphism (`backdrop-filter`, frosted panels). No neon
   glows (colored `box-shadow`, `text-shadow`, `filter: blur()` for effect).
2. **Solid backgrounds.** The page is `#121212`. Panels are solid neutrals, never
   translucent or blurred.
3. **One sans-serif: Inter.** No serif, no mono, no display/decorative faces.
4. **No decorative junk.** No 3D shapes, ambient blobs, abstract "tech" squiggles,
   radar sweeps, animated glows, or emoji/glyph arrows (`→ ↳ ✓ ▲ █ ✕`). Icons, when
   used, are clean monochrome outlines only.
5. **No perfectly-centered page.** Default to left-aligned and asymmetric framing.
6. **Real-content placeholders.** Show a real label/name, never a striped box or
   abstract shape standing in for content.

---

## 1. Color

Flat tokens, defined in `:root` in `app/globals.css`. Use the CSS variables — never
hardcode a hex in a component.

### Surfaces (neutrals)
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#121212` | Page background. The only background color for `<body>`. |
| `--surface` | `#1A1A1A` | Cards, panels, inputs. |
| `--surface-2` | `#202020` | Hover / inset / selected fill. |
| `--border` | `#2A2A2A` | Default 1px borders, dividers. |
| `--border-strong` | `#3D3D3D` | Input borders, ghost buttons, emphasized edges. |

### Text (neutrals)
| Token | Hex | Use |
|---|---|---|
| `--text` | `#F2F2F2` | Primary text, headings. |
| `--text-muted` | `#A0A0A0` | Body copy, secondary text. |
| `--text-faint` | `#6B6B6B` | Labels, eyebrows, meta, captions. |

### Accent (1 brand color)
| Token | Hex | Use |
|---|---|---|
| `--accent` | `#FF5A1E` | The single brand accent. Primary buttons, active states, links-as-emphasis, key numbers. Use sparingly. |
| `--accent-hover` | `#E64C12` | Hover for accent surfaces — **darker**, never a glow or lighter "ignite". |
| `--accent-soft` | `rgba(255,90,30,0.10)` | Flat tint fill for selected chips and focus rings only. Not a gradient. |

### Functional only
| Token | Hex | Use |
|---|---|---|
| `--success` | `#4FB477` | Status text ("Verified") only. Never decorative. |

**Contrast:** primary buttons use `--bg` (`#121212`) text on `--accent` — dark-on-orange
passes contrast. Never put `--text` (light) on `--accent`.

---

## 2. Typography

**Font:** Inter (loaded via `next/font/google` in `app/layout.tsx`, exposed as
`--font-inter`). Fallback `system-ui, sans-serif`. Nothing else.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Display (h1) | `clamp(40px, 6vw, 72px)` | 700 | Left-aligned. `line-height: 1.05`, `letter-spacing: -0.02em`. |
| h2 | `clamp(28px, 4vw, 44px)` | 700 | `letter-spacing: -0.015em`. |
| h3 | `clamp(19px, 2vw, 22px)` | 600 | |
| Lead | `18px` | 400 | `--text-muted`, `max-width: 60ch`. |
| Body | `16px` | 400 | `line-height: 1.6`. The base size — do not go below 16px for paragraphs. |
| Label / eyebrow | `13px` | 600 | Uppercase, `letter-spacing: 0.08em`, `--text-faint`. |
| Meta / caption | `12–13px` | 500 | `--text-faint`. |

Rules:
- Headings are **bold and left-aligned**. No centered headings except an intentional,
  isolated CTA — and prefer left there too.
- No italics-for-emphasis using a serif. Emphasize with `--text` weight or `--accent`.
- Body never below 16px.

---

## 3. Spacing

Intentional hierarchy. Three core steps (the brief's scale), plus section rhythm:

| Token | Value | Use |
|---|---|---|
| `--space-tight` | `8px` | Between related items (form field + its label, chip rows). |
| `--space-section-gap` | `24px` | Between distinct blocks inside a section. |
| `--space-cta` | `48px` | Breathing room around primary CTAs. |
| Section padding | `clamp(64px, 9vw, 120px)` | Vertical padding per `<section>`. |
| `--gutter` | `clamp(20px, 5vw, 64px)` | Horizontal page gutter. |
| `--maxw` | `1200px` | Content max width. |

Use tight 8px between a label and its input; 24px between sections of content; 48px
around the apply CTAs.

---

## 4. Components

### Buttons
- Shape: `border-radius: 2px` (subtle). Padding `14px 24px`. Inter 15px / 600. Normal
  case (not uppercase).
- **No icons inside buttons.** No arrows. Label text only.
- `.btn--primary`: `--accent` bg, `--bg` text. Hover → `--accent-hover`. No transform,
  no glow. `transition: background-color .15s`.
- `.btn--ghost`: transparent bg, `1px solid --border-strong`, `--text`. Hover →
  border `--accent`, text `--accent`.
- Disabled: `opacity .55; cursor: not-allowed`.

### Inputs / form fields
- Solid `--surface` bg, `1px solid --border-strong`, `border-radius: 2px`, 16px text.
- Label above input, uppercase 13px `--text-faint`, `8px` gap to the field.
- Focus: `border-color: --accent` + a clean focus ring
  `box-shadow: 0 0 0 2px --accent-soft`. No glow, no scale.
- Placeholder: `--text-faint`.

### Cards / panels
- Solid `--surface` bg, `1px solid --border`, `border-radius: 4px`.
- Hover (when interactive): `border-color: --border-strong`. Small `translateY(-2px)`
  is allowed; **no** glow shadow.

### Icons
- Monochrome outline only (Feather/Lucide style, `stroke: currentColor`,
  `stroke-width ~1.6`). `currentColor` inherits text color — no accent glow.
- Never filled, never multicolor, never emoji.

### Dividers
- `1px` solid `--border`. No gradient fade.

---

## 5. Layout

- **Asymmetric by default.** Two-column sections use uneven ratios (e.g. `0.85fr 1.15fr`
  or `1fr 1.1fr`), text on one side, supporting panel/photo on the other.
- Hero is left-aligned, single column, content capped ~`720px` — not centered.
- Avoid full-width centered text blocks. The FAQ and CTA headings are left-aligned.
- Grids for stats/cards are fine, but keep them flat and let spacing (not boxes-on-
  boxes) carry the hierarchy.

---

## 6. Motion

- Subtle and functional. Scroll-reveal = opacity + small `translateY` (≤16px) only.
  **No blur, no scale, no stagger-glow.**
- Button/input transitions: color only, `~.15s`.
- No infinite ambient animation (no marquees-for-vibes, radar sweeps, pulsing glows).
- Respect `prefers-reduced-motion: reduce` — disable all entrance animation.

---

## 7. Checklist before shipping UI

- [ ] No `gradient(`, `backdrop-filter`, colored `box-shadow`, or `filter: blur()`.
- [ ] Only Inter; no serif/mono.
- [ ] Backgrounds are solid tokens.
- [ ] Accent used sparingly; neutrals carry the page.
- [ ] No emoji/glyph arrows or icons inside buttons.
- [ ] Headings left-aligned; layout asymmetric, not centered.
- [ ] Body text ≥ 16px.
- [ ] Placeholders show real content, not abstract shapes.
- [ ] Motion is opacity/translate only; reduced-motion honored.
