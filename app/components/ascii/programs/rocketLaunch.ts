/**
 * rocketLaunch — hero set-piece.
 *
 * Seamless autonomous loop with continuous camera coverage. The vehicle
 * flies one physical arc (launch → apogee → landing) and a single smooth
 * camera flies with it — no hard cuts, only dolly moves:
 *
 *   1. PAD WIDE   — idle venting, ignition, first seconds of climb.
 *   2. PUSH-IN    — as the nose nears the frame top the camera eases into
 *                   a 1.35× chase. Tracking uses speed-proportional lag,
 *                   so the accelerating rocket visibly pulls upward
 *                   through the frame rather than sitting pinned.
 *   3. DOLLY-OUT  — approaching apogee the camera pulls wide to 0.5×:
 *                   engine cutoff, gentle lateral drift, and the Earth
 *                   fades in below — an ember-lit limb with atmosphere
 *                   glow and a dusk-graded body.
 *   4. DOLLY-IN   — the camera pushes back to 1.3× on the falling
 *                   booster (lag now makes it sink through the frame as
 *                   it accelerates); the landing burn flares mid-air and
 *                   the vehicle climbs back up the frame as it brakes.
 *   5. SETTLE     — on final approach the framing eases home to the
 *                   identity pad shot; touchdown lands in exactly the
 *                   idle framing, closing the loop with no seam.
 *
 * Ported from docs/reference/ascii-hero-prototype.html; landing + camera
 * rig added. The "camera" is a translate/scale transform over the world
 * pass; star parallax is driven by actual camera velocity.
 */

import type { AsciiFrame, AsciiPalette, AsciiProgram, RGB } from "../AsciiCanvas";
import { mixRGB } from "../AsciiCanvas";

type Phase = "idle" | "ignite" | "ascend" | "coast" | "descend" | "touchdown";

interface Particle {
  x: number;
  y: number;
  vx: number; // cells / second
  vy: number;
  life: number;
  decay: number; // life lost / second
  kind: 0 | 1 | 2; // 0 = hot core, 1 = cooling, 2 = smoke
  size: number;
}

interface Star {
  x: number; // 0..1
  y: number;
  s: number; // brightness / parallax
}

const IDLE_S = 4.2;
const IGNITE_S = 0.95;
const TOUCH_S = 1.15;
/** Height (fraction of rows) where the landing burn lights. */
const BURN_H = 0.55;
/** Touchdown descent speed the landing burn flares toward (cells/s). */
const TOUCH_V = -4;
/** Altitude (in rows) where ascent hands over to the apogee coast. */
const COAST_ALT = 2.2;
/** Vehicle height in world cells (body + nose) — used for camera framing. */
const ROCKET_H = 24;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smoothstep = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function rocketLaunch(): AsciiProgram {
  let cols = 0;
  let rows = 0;
  let pal: AsciiPalette;
  let phase: Phase = "idle";
  let firstCycle = true; // first idle is short so visitors see the launch
  let pt = 0; // seconds in current phase
  let ry = 0; // rocket rise above pad (cells)
  let rv = 0; // vertical speed (cells / second, + up)
  let chase = false; // camera has begun following the ascent
  let latPhase = 0; // lateral drift oscillator (coast + descent)
  // camera state — smoothed every frame toward per-phase targets
  let camY = 0; // world y the camera looks at
  let camZ = 1; // zoom
  let camA = 0.5; // anchor: screen fraction where camY lands
  let camPrev: number | null = null; // previous camY (for star parallax)
  let parts: Particle[] = [];
  let stars: Star[] = [];

  const padY = () => rows * 0.8;
  const rocketX = () => cols * 0.55;

  function reset() {
    phase = "idle";
    firstCycle = true;
    pt = 0;
    ry = 0;
    rv = 0;
    chase = false;
    latPhase = 0;
    camY = rows * 0.5;
    camZ = 1;
    camA = 0.5;
    camPrev = null;
    parts = [];
  }

  function spawnExhaust(x: number, y: number, n: number, wide: number) {
    for (let i = 0; i < n; i++) {
      const hot = Math.random() < 0.65;
      parts.push({
        x: x + (Math.random() - 0.5) * wide,
        y,
        vx: (Math.random() - 0.5) * 9,
        vy: 14 + Math.random() * 26,
        life: 1,
        decay: 1.1 + Math.random() * 1.6,
        kind: hot ? 0 : 1,
        size: Math.random() < 0.5 ? 2 : 1,
      });
    }
  }

  /** Ground smoke rolling outward along the pad on ignition. */
  function spawnPadSmoke(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      parts.push({
        x: x + dir * (2 + Math.random() * 2),
        y: y + (Math.random() - 0.5) * 1.5,
        vx: dir * (6 + Math.random() * 16),
        vy: -(0.5 + Math.random() * 2.5),
        life: 0.9,
        decay: 0.5 + Math.random() * 0.5,
        kind: 2,
        size: Math.random() < 0.6 ? 2 : 1,
      });
    }
  }

  /** Faint venting wisps drifting up the fuselage while idle. */
  function spawnVent(x: number, y: number) {
    parts.push({
      x: x + (Math.random() < 0.5 ? -5 : 5) + (Math.random() - 0.5) * 1.5,
      y: y - 6 - Math.random() * 8,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -(0.8 + Math.random() * 1.4),
      life: 0.5,
      decay: 0.28 + Math.random() * 0.2,
      kind: 2,
      size: 1,
    });
  }

  function drawRocket(c: CanvasRenderingContext2D, sx: number, base: number) {
    const bodyW = 8;
    const bodyH = 17;
    const ink = `rgb(${pal.ink[0]},${pal.ink[1]},${pal.ink[2]})`;
    c.fillStyle = ink;
    // body
    c.beginPath();
    c.roundRect(sx - bodyW / 2, base - bodyH, bodyW, bodyH, 1.6);
    c.fill();
    // nose cone
    c.beginPath();
    c.moveTo(sx - bodyW / 2, base - bodyH + 0.5);
    c.quadraticCurveTo(sx - 1.4, base - bodyH - 4.5, sx, base - bodyH - 7);
    c.quadraticCurveTo(sx + 1.4, base - bodyH - 4.5, sx + bodyW / 2, base - bodyH + 0.5);
    c.closePath();
    c.fill();
    // fins
    c.beginPath();
    c.moveTo(sx - bodyW / 2, base - 5.5);
    c.lineTo(sx - bodyW / 2 - 4, base + 0.5);
    c.lineTo(sx - bodyW / 2, base);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + bodyW / 2, base - 5.5);
    c.lineTo(sx + bodyW / 2 + 4, base + 0.5);
    c.lineTo(sx + bodyW / 2, base);
    c.closePath();
    c.fill();
    // engine skirt
    c.fillRect(sx - 2.6, base, 5.2, 1.4);
    // porthole — the one ember detail on the airframe
    c.fillStyle = `rgb(${pal.accent[0]},${pal.accent[1]},${pal.accent[2]})`;
    c.beginPath();
    c.arc(sx, base - bodyH + 5, 2, 0, 7);
    c.fill();
  }

  function drawPad(c: CanvasRenderingContext2D, rx: number, py: number) {
    c.fillStyle = `rgb(${pal.ink[0]},${pal.ink[1]},${pal.ink[2]})`;
    c.fillRect(rx - 10, py + 1, 20, 1.4);
    c.fillRect(rx - 8, py + 2.4, 2.5, 1.2);
    c.fillRect(rx + 5.5, py + 2.4, 2.5, 1.2);
    // gantry tower
    c.globalAlpha = 0.85;
    c.fillRect(rx - 12.5, py - 24, 1.6, 25);
    for (let i = 0; i < 4; i++) c.fillRect(rx - 12.5, py - 20 + i * 5.4, 4.5, 0.9);
    c.globalAlpha = 1;
  }

  /** The Earth from altitude: dusk-graded body, ember limb, atmosphere. */
  function drawHorizon(c: CanvasRenderingContext2D, alpha: number) {
    const cx = cols * 0.5;
    const R = rows * 2.2;
    const cy = rows * 0.74 + R; // limb crest at ~74% height
    const body = mixRGB(pal.accent, pal.ink, 0.55);
    const dusk = mixRGB(pal.accent, body, 0.5);
    const ac = pal.accent;
    const glow = pal.accentSoft;

    // body fill, brightening toward the limb (low sun across the surface)
    const g = c.createRadialGradient(cx, cy, R * 0.86, cx, cy, R);
    g.addColorStop(0, `rgba(${body[0]},${body[1]},${body[2]},${0.12 * alpha})`);
    g.addColorStop(0.8, `rgba(${body[0]},${body[1]},${body[2]},${0.3 * alpha})`);
    g.addColorStop(1, `rgba(${dusk[0]},${dusk[1]},${dusk[2]},${0.5 * alpha})`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fill();

    // bright ember limb
    c.strokeStyle = `rgba(${ac[0]},${ac[1]},${ac[2]},${0.6 * alpha})`;
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.stroke();

    // layered atmosphere glow above the limb
    c.strokeStyle = `rgba(${glow[0]},${glow[1]},${glow[2]},${0.4 * alpha})`;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, R + 1.6, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = `rgba(${glow[0]},${glow[1]},${glow[2]},${0.18 * alpha})`;
    c.beginPath();
    c.arc(cx, cy, R + 3.2, 0, Math.PI * 2);
    c.stroke();
  }

  function particleColor(p: Particle): RGB {
    if (p.kind === 2) return pal.faint;
    if (p.kind === 0 && p.life > 0.45)
      return p.life > 0.75 ? pal.accent : pal.accentSoft;
    return pal.faint;
  }

  function paint(f: AsciiFrame) {
    const { ctx: c, dt, reduced } = f;
    pal = f.palette;

    if (reduced) {
      paintStatic(c);
      return;
    }

    // ---- phase machine (one continuous flight) ----
    pt += dt;
    if (phase === "idle" && pt > (firstCycle ? 1.1 : IDLE_S)) {
      phase = "ignite";
      firstCycle = false;
      pt = 0;
    } else if (phase === "ignite" && pt > IGNITE_S) {
      phase = "ascend";
      pt = 0;
    } else if (phase === "ascend") {
      rv = Math.min(70, rv + (26 + rv * 1.5) * dt);
      ry += rv * dt;
      if (ry > rows * COAST_ALT) {
        phase = "coast"; // MECO — a short drift over the top of the arc
        pt = 0;
        rv = 9;
        latPhase = 0;
      }
    } else if (phase === "coast") {
      rv -= 9 * dt; // rise, stall, tip over — kept brief
      ry += rv * dt;
      if (rv < -8 || pt > 3.5) {
        phase = "descend";
        pt = 0;
      }
    } else if (phase === "descend") {
      if (ry > rows * BURN_H) {
        rv = Math.max(rv - 30 * dt, -52); // free fall, terminal-ish velocity
      } else {
        rv += (TOUCH_V - rv) * Math.min(1, 3 * dt); // landing burn flare
      }
      ry += rv * dt;
      if (ry <= 0) {
        ry = 0;
        rv = 0;
        phase = "touchdown";
        pt = 0;
      }
    } else if (phase === "touchdown" && pt > TOUCH_S) {
      phase = "idle";
      pt = 0;
      chase = false;
    }

    const burning = phase === "descend" && ry <= rows * BURN_H;
    const rx = rocketX();
    const py = padY();
    const base = py - ry; // rocket base, world coords
    const worldMid = base - ROCKET_H * 0.5;
    const speed = Math.abs(rv);
    const shake =
      phase === "ignite" || burning
        ? (Math.random() - 0.5) * (burning ? 0.7 : 0.9)
        : 0;
    // gentle lateral drift through coast + descent, damping out near the pad
    if (phase === "coast" || phase === "descend") {
      latPhase += (phase === "coast" ? 0.9 : 1.7) * dt;
    }
    const latAmp =
      phase === "coast" || phase === "descend" ? Math.min(1.8, ry * 0.02) : 0;
    const sway = Math.sin(latPhase) * latAmp;
    const sx = rx + shake + sway;

    // ---- camera rig: smooth targets, no cuts ----
    // screenY = (worldY - camY) * zoom + rows * anchor
    let ty = rows * 0.5; // identity ⇒ the pad-wide framing
    let tz = 1;
    let ta = 0.5;
    let kY = 3; // camY tracking rate; lag lets the rocket move in frame
    if (phase === "ascend") {
      // hold the pad wide until the nose nears the frame top, then ease
      // into the chase — a push-in, not a cut
      if (!chase && base - ROCKET_H < rows * 0.3) chase = true;
      if (chase) {
        tz = 1.35;
        ta = 0.55;
        kY = 2 + speed * 0.06; // speed-proportional: fast rocket leads the cam
        const maxCam = py + 4 - (rows * (1 - ta)) / tz; // keep ground off-frame
        ty = Math.min(worldMid, maxCam);
      }
    } else if (phase === "coast") {
      tz = 0.5;
      ta = 0.42;
      ty = worldMid;
      kY = 2.2;
    } else if (phase === "descend" || phase === "touchdown") {
      tz = 1.3;
      ta = 0.32;
      kY = 2 + speed * 0.06;
      const maxCam = py + 4 - (rows * (1 - ta)) / tz;
      ty = Math.min(worldMid, maxCam);
      // final approach: ease the targets home to the identity pad framing
      const k = smoothstep(1 - Math.min(1, ry / (rows * 0.5)));
      if (k > 0) {
        tz = lerp(tz, 1, k);
        ta = lerp(ta, 0.5, k);
        ty = lerp(ty, rows * 0.5, k);
        kY = Math.max(kY, 4);
      }
    }
    const aZ = Math.min(1, 2 * dt); // zoom/anchor glide (~0.5s time constant)
    camZ += (tz - camZ) * aZ;
    camA += (ta - camA) * aZ;
    camY += (ty - camY) * Math.min(1, kY * dt);

    // ---- stars: parallax driven by actual camera motion ----
    const dScreen = camPrev === null ? 0 : (camPrev - camY) * camZ;
    camPrev = camY;
    const rate = Math.abs(dScreen) / Math.max(dt, 1e-3); // cells/s of camera travel
    const streak = Math.min(5, rate * 0.05);
    c.fillStyle = `rgb(${pal.ink[0]},${pal.ink[1]},${pal.ink[2]})`;
    for (const st of stars) {
      st.y += (dScreen / rows) * (0.25 + st.s * 0.45) + 0.0045 * st.s * dt;
      if (st.y > 1) {
        st.y -= 1;
        st.x = Math.random();
      } else if (st.y < 0) {
        st.y += 1;
        st.x = Math.random();
      }
      c.globalAlpha = 0.32 * st.s;
      c.fillRect(st.x * cols, st.y * rows, 1, 1 + streak * st.s);
    }
    c.globalAlpha = 1;

    // ---- the Earth, visible only from altitude (rides the dolly-out) ----
    const horizonAlpha = clamp01((0.95 - camZ) / 0.45);
    if (horizonAlpha > 0.02) drawHorizon(c, horizonAlpha);

    // ---- world pass (pad, rocket, particles) through the camera ----
    c.save();
    c.translate(rx, rows * camA);
    c.scale(camZ, camZ);
    c.translate(-rx, -camY);

    drawPad(c, rx, py);
    drawRocket(c, sx, base);

    // emitters (world coords; engine is cut off while coasting)
    if (phase === "idle" && Math.random() < dt * 9) spawnVent(sx, py);
    if (phase === "ignite") {
      spawnExhaust(sx, base + 0.5, Math.round(320 * dt), 3.4);
      spawnPadSmoke(sx, py + 1, Math.round(150 * dt));
    }
    if (phase === "ascend") {
      spawnExhaust(sx, base + 0.5, Math.round(420 * dt), 3);
    }
    if (burning) {
      // landing burn: throttle with how hard the engine is still braking
      const throttle = Math.min(1, Math.max(0.25, (speed - 2) / 20));
      spawnExhaust(sx, base + 0.5, Math.round(300 * throttle * dt), 2.6);
      if (ry < 5) spawnPadSmoke(sx, py + 1, Math.round(110 * dt));
    }
    if (phase === "touchdown" && pt < 0.45) {
      spawnPadSmoke(sx, py + 1, Math.round(60 * dt));
    }

    // integrate + draw particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      p.vx *= 1 - 0.6 * dt;
      p.vy *= 1 - (p.kind === 2 ? 1.4 : 0.9) * dt;
      if (p.life <= 0 || p.y > py + 6 || p.y < base - rows * 2) {
        parts.splice(i, 1);
        continue;
      }
      const col = particleColor(p);
      const a = p.kind === 2 ? Math.min(0.5, p.life * 0.7) : Math.min(1, p.life * 1.4);
      c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
      const sz = p.life > 0.7 ? p.size : 1;
      c.fillRect(p.x - sz / 2, p.y, sz, sz);
    }

    c.restore();
  }

  /** One representative frame: rocket held on the pad, gently venting. */
  function paintStatic(c: CanvasRenderingContext2D) {
    const rx = rocketX();
    const py = padY();
    c.fillStyle = `rgb(${pal.ink[0]},${pal.ink[1]},${pal.ink[2]})`;
    for (const st of stars) {
      c.globalAlpha = 0.32 * st.s;
      c.fillRect(st.x * cols, st.y * rows, 1, 1);
    }
    c.globalAlpha = 1;
    drawPad(c, rx, py);
    drawRocket(c, rx, py);
    // a soft pre-ignition wisp under the skirt
    for (let i = 0; i < 8; i++) {
      const soft = mixRGB(pal.faint, pal.paper, i / 10);
      c.fillStyle = `rgba(${soft[0]},${soft[1]},${soft[2]},${0.4 - i * 0.04})`;
      c.fillRect(rx - 1 + (i % 3) - 1, py + 2.6 + i * 0.7, 2, 1);
    }
  }

  return {
    setup(c, r, palette) {
      cols = c;
      rows = r;
      pal = palette;
      stars = Array.from({ length: 70 }, () => ({
        x: Math.random(),
        y: Math.random(),
        s: 0.3 + Math.random() * 0.9,
      }));
      reset();
    },
    paint,
    staticTime: 1,
  };
}
