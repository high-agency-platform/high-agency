/**
 * engineBurn — final CTA set-piece.
 *
 * A compact, mesmerizing static-fire: nozzle at the top, turbulent
 * plume burning downward in ember oranges on paper. Turbulence comes
 * from two octaves of scrolling value noise; the core flickers hot
 * (ember), cooling to soft ember and faint smoke at the fringes.
 */

import type { AsciiFrame, AsciiProgram, RGB } from "../AsciiCanvas";
import { mixRGB } from "../AsciiCanvas";

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return (
    hash2(xi, yi) * (1 - u) * (1 - v) +
    hash2(xi + 1, yi) * u * (1 - v) +
    hash2(xi, yi + 1) * (1 - u) * v +
    hash2(xi + 1, yi + 1) * u * v
  );
}

function turbulence(x: number, y: number) {
  return 0.65 * noise2(x, y) + 0.35 * noise2(x * 2.1, y * 2.1);
}

export default function engineBurn(): AsciiProgram {
  let cols = 0;
  let rows = 0;
  let hot: RGB = [255, 90, 30];

  function paint(f: AsciiFrame) {
    const { ctx: c, t, palette, reduced } = f;
    hot = mixRGB(palette.accent, palette.paper, 0.28);
    const tt = reduced ? 0.55 : t;
    const cx = cols * 0.5;
    const y0 = rows * 0.14; // nozzle exit
    const yEnd = rows * 0.96;

    // ---- nozzle ----
    const ink = palette.ink;
    c.fillStyle = `rgb(${ink[0]},${ink[1]},${ink[2]})`;
    const nw = Math.max(4, cols * 0.16);
    c.beginPath();
    c.moveTo(cx - nw * 0.35, 0);
    c.lineTo(cx + nw * 0.35, 0);
    c.lineTo(cx + nw * 0.62, y0);
    c.lineTo(cx - nw * 0.62, y0);
    c.closePath();
    c.fill();

    // ---- plume ----
    const span = yEnd - y0;
    const breathe = 0.92 + 0.08 * Math.sin(tt * 9) + 0.05 * Math.sin(tt * 23);
    for (let gy = Math.floor(y0); gy < yEnd; gy++) {
      const rel = (gy - y0) / span; // 0 at nozzle → 1 at tail
      const halfw = nw * 0.6 + rel * cols * 0.26;
      const x0 = Math.max(0, Math.floor(cx - halfw));
      const x1 = Math.min(cols - 1, Math.ceil(cx + halfw));
      for (let gx = x0; gx <= x1; gx++) {
        const dx = (gx - cx) / halfw; // -1..1 across the plume
        const core = Math.max(0, 1 - dx * dx);
        const turb = turbulence(gx * 0.33 + 31.7, gy * 0.3 - tt * 6.5);
        let it = core * (1.22 - rel) * (0.55 + 0.72 * turb) * breathe;
        // ragged tail
        if (rel > 0.6) it *= 1 - (rel - 0.6) * 1.6 * (0.5 + turb);
        if (it < 0.09) continue;
        let col: RGB;
        if (it > 0.78) col = hot;
        else if (it > 0.45) col = palette.accent;
        else if (it > 0.22) col = palette.accentSoft;
        else col = palette.faint;
        c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, it)})`;
        c.fillRect(gx, gy, 1, 1);
      }
    }

    // ---- hold-down clamps either side of the nozzle ----
    c.fillStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},0.8)`;
    c.fillRect(cx - nw * 1.15, 0, 1.4, y0 * 0.6);
    c.fillRect(cx + nw * 1.15 - 1.4, 0, 1.4, y0 * 0.6);
  }

  return {
    setup(c, r) {
      cols = c;
      rows = r;
    },
    paint,
    staticTime: 0.55,
  };
}
