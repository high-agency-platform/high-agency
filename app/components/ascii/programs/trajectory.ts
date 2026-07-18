/**
 * trajectory — the #system section, behind the "what you join" cards.
 *
 * A dashed flight path continuously drawing itself across the mission
 * chart, rising left → right, with a small ember marker (the operator)
 * climbing it and leaving a fading trail. Deliberately low density —
 * it lives behind opaque cards and must never fight readability.
 */

import type { AsciiFrame, AsciiProgram } from "../AsciiCanvas";

const DRAW_S = 7; // seconds to draw the full path
const HOLD_S = 2.5; // marker rests at apex
const FADE_S = 1.5;
const CYCLE = DRAW_S + HOLD_S + FADE_S;
const POINTS = 56;

export default function trajectory(): AsciiProgram {
  let cols = 0;
  let rows = 0;

  /** Flight path: gentle exponential climb, bottom-left → top-right. */
  function path(u: number): { x: number; y: number } {
    return {
      x: (0.04 + u * 0.92) * cols,
      y: (0.9 - 0.72 * Math.pow(u, 1.65)) * rows,
    };
  }

  function paint(f: AsciiFrame) {
    const { t, palette, overlay, reduced } = f;
    const tc = reduced ? DRAW_S + 0.1 : t % CYCLE;
    const progress = Math.min(1, tc / DRAW_S);
    const fade =
      tc > DRAW_S + HOLD_S ? Math.max(0, 1 - (tc - DRAW_S - HOLD_S) / FADE_S) : 1;
    if (fade <= 0.02) return;

    // dashed path
    for (let i = 0; i <= POINTS; i++) {
      const u = i / POINTS;
      if (u > progress) break;
      if (i % 2 === 1) continue; // dashes
      const p = path(u);
      const tick = i % 8 === 0;
      overlay.push({
        x: p.x,
        y: p.y,
        ch: tick ? "+" : "·",
        color: palette.ink,
        alpha: (tick ? 0.34 : 0.26) * fade,
      });
    }

    // altitude ticks on the far left (mission-chart flavor)
    for (let j = 1; j <= 3; j++) {
      overlay.push({
        x: 0.5,
        y: (0.9 - j * 0.24) * rows,
        ch: "-",
        color: palette.ink,
        alpha: 0.18 * fade,
      });
    }

    // marker + fading trail
    const mu = reduced ? 0.72 : Math.min(1, progress);
    const mp = path(mu);
    for (let k = 1; k <= 5; k++) {
      const uu = mu - k * 0.014;
      if (uu < 0) break;
      const tp = path(uu);
      overlay.push({
        x: tp.x,
        y: tp.y,
        ch: ":",
        color: palette.accentSoft,
        alpha: (0.5 - k * 0.09) * fade,
      });
    }
    const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 5);
    overlay.push({
      x: mp.x,
      y: mp.y - 0.4,
      ch: "@",
      color: palette.accent,
      alpha: 0.9 * pulse * fade,
    });
  }

  return {
    setup(c, r) {
      cols = c;
      rows = r;
    },
    paint,
    staticTime: DRAW_S,
  };
}
