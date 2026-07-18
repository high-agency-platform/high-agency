# ASCII animation layer — implementation notes

The marketing landing page (`app/Waitlist.tsx`) carries a family of four
generative ASCII set-pieces that tell a "launch sequence" story, all inside the
Operator OS v2 · Arcade Paper language (paper canvas, ink, ember, Geist Mono).
Everything is non-interactive, autonomous, and paints *onto* the paper — no
embedded video UI, no images.

Technique (in the tradition of Andreas Gysin's play.core /
play.ertdfgcvb.xyz): paint a low-res scene at **1 px = 1 character cell** on an
offscreen canvas → `getImageData` → map each pixel's alpha to a density ramp
(`' .·:;+=xX#@'`) and its color to the glyph color → `fillText` with Geist Mono
on the visible canvas. No code was vendored from play.core (Apache-2.0); the
engine is a lean custom implementation, so **no attribution is legally
required** — the header comment in `AsciiCanvas.tsx` credits the technique as a
courtesy.

## Components

### `app/components/ascii/AsciiCanvas.tsx` — the engine

```tsx
<AsciiCanvas
  program={rocketLaunch}   // () => AsciiProgram — pass a stable module-level factory
  cell={11}                // px per character cell (clamped to ≥10, mobile-safe)
  className="hero__ascii"  // extra classes on the absolutely-positioned host div
  mapCell={customMapper}   // optional pixel→glyph mapper (default: alpha→ramp)
  ramp=" .·:;+=xX#@"       // optional char ramp
  maxFps={30}              // frame cap (default 30)
  repaint={n}              // bump to re-render the reduced-motion static frame
  onVisibility={(v) => {}} // viewport visibility callback (used by VideoAscii)
/>
```

A **program** is `{ setup?(cols, rows, palette), paint(frame), staticTime? }`.
`paint` receives `{ ctx, cols, rows, t, dt, frame, palette, overlay, reduced }`:

- `ctx` is the offscreen 2D context at cols×rows px — draw the scene; pixel
  alpha becomes glyph density, pixel color becomes glyph color.
- `overlay` — push `{ x, y, ch, color, alpha }` for exact hand-placed glyphs
  (used for the clock readouts and the trajectory dashes).
- `reduced` is true when rendering the single static frame
  (`prefers-reduced-motion`, or forced via `?ascii=static` in the URL — that
  query flag exists for testing the static path in any browser).
- `palette` is resolved at mount from the CSS custom properties `--text`,
  `--bg`, `--accent`, `--text-faint` (plus a derived `accentSoft`), so the
  canvases stay in lockstep with the design system. The mono font stack is
  resolved from `--font-mono` the same way.

Perf measures:

- 30 fps cap (rAF + timestamp throttle).
- `IntersectionObserver` fully cancels the rAF loop off-viewport;
  `visibilitychange` pauses it in hidden tabs. Animation time accumulates only
  while running, so scenes resume where they left off.
- The loop (and even the first canvas sizing) starts inside
  `requestIdleCallback`, after first paint — the hero headline stays the LCP
  element and the canvases can never delay it.
- Canvases are absolutely positioned (`.ascii-host`), `aria-hidden`,
  `pointer-events: none` — zero layout shift by construction.
- DPR-aware (capped at 2×); offscreen context uses `willReadFrequently`.
- `prefers-reduced-motion: reduce` → exactly one representative static frame
  per program, no loop; re-rendered once when fonts finish loading and if the
  grid resizes. The media query is watched live.

### `app/components/ascii/VideoAscii.tsx` — video → ASCII

```tsx
<VideoAscii
  src="/video/launch.mp4"  // file under /public
  fallback={rocketLaunch}  // procedural program if the video is missing/broken
  className="hero__ascii"
  hotLuma={0.62}           // luminance above which pixels render in ember
/>
```

Plays a hidden muted/looping/autoplay/playsInline video, cover-crops each frame
into the low-res pass, and maps **luminance** to the ramp: bright pixels become
dense glyphs in ember, midtones in ink, shadows dissolve into the paper. The
video pauses automatically while off-viewport (via `onVisibility`) and under
reduced motion (first decoded frame is kept for the static render).

Fallback chain: the procedural `fallback` program renders from frame one (no
waiting on the network), while the `src` is probed with a `HEAD` fetch in the
background — so a missing file never logs a resource error and never delays
the animation. Only a confirmed video (2xx, non-HTML) swaps the pipeline in;
any later `<video>` error swaps back.

**To drop in real footage:** put a licensed clip at `public/video/launch.mp4`
(mp4 or webm; keep it short, muted-friendly, ideally < 5 MB — Pexels/Coverr
free-license rocket/launch clips work well) and the hero upgrades itself on the
next load; no code change. Dark-background footage with bright highlights
(engine plumes, night launches) reads best. No video file is bundled in the
repo — the procedural rocket runs until one exists.

## Programs & where they're mounted

All mounts are in `app/Waitlist.tsx`; section CSS is in the
"ASCII LAYER" block of `app/globals.css`.

| Program | File (`app/components/ascii/programs/`) | Mount |
| --- | --- | --- |
| `rocketLaunch` | `rocketLaunch.ts` | Hero (`.hero--launch`), right 52% on desktop, full-width at 30% opacity behind the copy under 900px. Wrapped in `VideoAscii` (`/video/launch.mp4` + procedural fallback) — the video-to-ASCII proof-of-concept doubles as the alternate hero treatment. **One continuous flight, one continuous camera — no cuts** (~12 s loop, closes seamlessly; the first idle hold is shortened to ~1 s so the launch fires almost immediately on page load, later cycles idle 4.2 s): ignition → ascent → apogee → free fall → landing burn → touchdown → idle. The camera glides between per-phase targets (focus/zoom/anchor smoothed every frame): pad wide → push-in to a 1.35× chase (tracking uses speed-proportional *lag*, so the accelerating rocket visibly pulls upward through the frame instead of sitting pinned) → dolly-out to a 0.5× apogee wide with engine cutoff, gentle lateral drift, and the Earth fading in below (dusk-graded body fill, bright ember limb, layered atmosphere glow — visibility rides the zoom, so it fades with the dolly) → dolly-in to a 1.3× descent track where lag makes the falling booster sink through the frame and climb back as the burn brakes it → framing eases home to the identity pad shot for touchdown, which IS the idle shot. Star parallax is driven by actual camera velocity per frame. |
| `waitingRoom` | `waitingRoom.ts` | `#problem` (`.section--void`) — the one dark moment on the page: section flips to ink, copy inverts to paper (via `color-mix` on the CSS vars), white stat tiles float on the dark. Sparse dim drizzle drifts downward (faded to 30% in the top-left keep-clear zone behind the header copy); flickering `hh:mm` clock readouts (right half only) crawl one minute at a time. The section carries extra vertical padding, and `.section--void .h2` restores display scale (30–52px) + bottom margin for the bare header the section now uses. |
| `trajectory` | `trajectory.ts` | `#system` (`.section--chart`), behind the three cards. A dashed flight path (`·`/`+` overlay glyphs, ≤0.35 alpha) continuously draws itself bottom-left → top-right; an ember `@` marker climbs it leaving a fading `:` trail; holds, fades, redraws. Hidden under 640px. |
| `engineBurn` | `engineBurn.ts` | Final CTA (`.final__grid` right column, 320px tall) — ink nozzle up top, turbulent plume burning downward in ember oranges (two-octave value noise), with the Geist Mono status line `T-MINUS 00 · SYSTEMS: GO · PAD: READY_` (blinking ember cursor, `.mc-line`) beneath. Stacks below the copy 640–900px, hidden under 640px. |

Readability rules observed: canvases live in whitespace zones or behind opaque
white tiles; anything that can sit behind copy stays at low alpha and the copy
containers carry `z-index: 2`.

## Verification (2026-07-18)

- **`npm run build`** — passes clean (output tail below).
- **`npx eslint app/components/ascii app/Waitlist.tsx`** — the new ASCII
  components lint with zero errors/warnings. Note: the repo has pre-existing
  lint errors that predate this work (verified via `git stash` + lint:
  `app/(platform)/{dashboard,onboarding,profile}/page.tsx` and `scripts/*.js`
  `no-require-imports`, plus one pre-existing `set-state-in-effect` error and
  one `no-img-element` warning in untouched `Waitlist.tsx` code), so the
  repo-wide `npm run lint` is not clean — unchanged from before this feature.
- **Dev-server render** — page loaded via a scripted browser session
  (Playwright-compatible): all four programs animate (screenshots taken of
  hero mid-ascent, dark waiting-room with drizzle + clocks, trajectory arc
  with marker, engine burn + status line). **Zero console errors/warnings and
  zero page errors** captured across full page loads, including the probe for
  the absent `/video/launch.mp4` (falls back silently, as designed).
- **Reduced motion** — verified through the engine's `?ascii=static` override,
  which forces the same code path as `prefers-reduced-motion: reduce` (the
  media query itself couldn't be emulated in the scripted browser): each
  canvas painted exactly one representative frame (hero: rocket on the pad
  with gantry + starfield) and `canvas.toDataURL()` was byte-identical when
  re-sampled 2.5 s later — no loop running. The CSS `mcBlink` cursor is killed
  by the existing global `prefers-reduced-motion` rule in `globals.css`.
- **No horizontal overflow** — every ASCII section carries `overflow: clip`;
  body already has `overflow-x: clip`. Sub-900px hero/final behavior is plain
  CSS (`@media` rules above).

### `npm run build` output tail

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ƒ /api/consent/approve
├ ƒ /api/consent/send
├ ○ /cohorts
├ ƒ /cohorts/[id]
├ ƒ /consent/[token]
├ ○ /dashboard
├ ○ /learn
├ ○ /login
├ ○ /onboarding
├ ○ /profile
└ ○ /styleguide

ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```
