/**
 * waitingRoom — the dark #problem section ("School is a waiting room").
 *
 * Slow, oppressive terminal drizzle: sparse dim paper-colored characters
 * drifting down an ink-black screen, plus flickering clock readouts whose
 * minutes barely crawl forward. Deliberately dim and slow — the feeling
 * of waiting.
 */

import type { AsciiFrame, AsciiProgram } from "../AsciiCanvas";

interface Drop {
  x: number;
  y: number;
  v: number; // cells / second — slow
  a: number; // base alpha
  h: number; // 1 or 2 cells tall
}

interface Clock {
  x: number;
  y: number;
  h: number; // hour shown
  m: number; // minute shown
  offset: number; // phase offset into the cycle
}

const CLOCK_CYCLE = 9; // seconds visible-ish per clock

function rand01(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export default function waitingRoom(): AsciiProgram {
  let cols = 0;
  let rows = 0;
  let drops: Drop[] = [];
  let clocks: Clock[] = [];

  function placeClock(k: Clock) {
    // Keep clocks in the right half so they never sit behind the copy column.
    const xMin = Math.floor(cols * 0.55);
    k.x = xMin + Math.floor(Math.random() * Math.max(1, cols - xMin - 7));
    k.y = 1 + Math.floor(Math.random() * Math.max(1, rows - 3));
    k.m += 1; // time crawls
    if (k.m > 59) {
      k.m = 0;
      k.h = (k.h % 12) + 1;
    }
  }

  function paint(f: AsciiFrame) {
    const { ctx: c, t, dt, palette, overlay, reduced } = f;
    const [pr, pg, pb] = palette.paper;

    // ---- drizzle ----
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      if (!reduced) {
        d.y += d.v * dt;
        if (d.y > rows + 1) {
          d.y = -2;
          d.x = Math.floor(Math.random() * cols);
        }
      }
      // subtle per-drop flicker so the rain feels electric, not smooth
      const flicker = 0.75 + 0.5 * rand01(i * 7.3 + Math.floor(t * 2.5));
      let a = Math.min(0.4, d.a * flicker);
      // keep-clear zone: fade the rain behind the header copy (top-left)
      if (d.x < cols * 0.62 && d.y < rows * 0.5) a *= 0.3;
      c.fillStyle = `rgba(${pr},${pg},${pb},${a})`;
      c.fillRect(d.x, d.y, 1, d.h);
    }

    // ---- flickering clocks ----
    for (let ci = 0; ci < clocks.length; ci++) {
      const k = clocks[ci];
      const cyc = (t + k.offset) % CLOCK_CYCLE;
      // envelope: fade in, hold with flicker, fade out, then relocate
      let env = 0;
      if (cyc < 1) env = cyc;
      else if (cyc < 6) env = 1;
      else if (cyc < 7.2) env = 1 - (cyc - 6) / 1.2;
      if (!reduced && cyc < dt * 1.5 && f.frame > 2) placeClock(k);
      if (env <= 0.02) continue;
      const flick = 0.7 + 0.3 * rand01(ci * 31.7 + Math.floor(t * 7));
      const alpha = (reduced ? 0.3 : 0.26 * env * flick);
      const str = `${String(k.h).padStart(2, "0")}:${String(k.m).padStart(2, "0")}`;
      const colonOn = reduced || Math.floor(t) % 2 === 0;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === ":" && !colonOn) continue;
        overlay.push({
          x: k.x + i,
          y: k.y,
          ch,
          color: palette.faint,
          alpha,
        });
      }
    }
  }

  return {
    setup(c, r) {
      cols = c;
      rows = r;
      drops = Array.from({ length: Math.round(cols * 1.15) }, () => ({
        x: Math.floor(Math.random() * c),
        y: Math.random() * r,
        v: 0.7 + Math.random() * 1.8,
        a: 0.08 + Math.random() * 0.22,
        h: Math.random() < 0.25 ? 2 : 1,
      }));
      clocks = Array.from({ length: 3 }, (_, i) => {
        const k: Clock = {
          x: 0,
          y: 0,
          h: 1 + Math.floor(Math.random() * 12),
          m: Math.floor(Math.random() * 60),
          offset: i * (CLOCK_CYCLE / 3),
        };
        placeClock(k);
        return k;
      });
    },
    paint,
    staticTime: 3,
  };
}
