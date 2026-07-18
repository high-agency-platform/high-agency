"use client";

/**
 * AsciiCanvas — generative ASCII renderer for the marketing page.
 *
 * A "program" paints a low-res scene (1px = 1 character cell) onto an
 * offscreen canvas each tick; the engine samples the pixels and re-draws
 * them as monospace glyphs on the visible canvas (alpha → char-ramp
 * density, pixel color → glyph color). Programs can also push exact
 * glyphs via `frame.overlay` for crisp, hand-placed characters.
 *
 * Technique in the tradition of Andreas Gysin's play.core
 * (github.com/ertdfgcvb/play.core, Apache-2.0) — no code vendored,
 * custom implementation.
 *
 * Perf contract: 30fps cap, fully paused when off-viewport or when the
 * tab is hidden, and a single static frame under prefers-reduced-motion
 * (also forceable with `?ascii=static` for testing). The loop starts in
 * requestIdleCallback so it never competes with first paint / LCP.
 */

import { useEffect, useRef } from "react";

export type RGB = [number, number, number];

export interface AsciiPalette {
  ink: RGB;
  paper: RGB;
  accent: RGB;
  /** Ember mixed toward paper — cooling exhaust, soft heat. */
  accentSoft: RGB;
  faint: RGB;
}

export interface OverlayGlyph {
  /** Cell coordinates (may be fractional for smooth motion). */
  x: number;
  y: number;
  ch: string;
  color: RGB;
  alpha: number;
}

export interface AsciiFrame {
  /** Offscreen context, cols×rows pixels. Paint the scene here. */
  ctx: CanvasRenderingContext2D;
  cols: number;
  rows: number;
  /** Seconds of animation time (excludes paused time). */
  t: number;
  dt: number;
  frame: number;
  palette: AsciiPalette;
  /** Push exact glyphs to draw on top of the sampled pass. */
  overlay: OverlayGlyph[];
  /** True when rendering the single reduced-motion frame. */
  reduced: boolean;
}

export interface AsciiProgram {
  /** Called on mount and whenever the cell grid resizes. */
  setup?(cols: number, rows: number, palette: AsciiPalette): void;
  paint(f: AsciiFrame): void;
  /** Animation time used for the single reduced-motion frame. */
  staticTime?: number;
}

export interface CellSample {
  ch: string;
  r: number;
  g: number;
  b: number;
  alpha: number;
}

export type CellMapper = (
  r: number,
  g: number,
  b: number,
  a: number,
  ramp: string,
  palette: AsciiPalette
) => CellSample | null;

export const DEFAULT_RAMP = " .·:;+=xX#@";

const defaultMapper: CellMapper = (r, g, b, a, ramp) => {
  if (a < 18) return null;
  const idx = Math.min(
    ramp.length - 1,
    Math.round((a / 255) * (ramp.length - 1))
  );
  const ch = ramp[idx];
  if (ch === " ") return null;
  return { ch, r, g, b, alpha: Math.max(0.25, a / 255) };
};

export function mixRGB(a: RGB, b: RGB, k: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

function parseColor(s: string): RGB | null {
  const m = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

/** Resolve the design-system palette + mono stack from CSS custom properties. */
function resolveTheme(host: HTMLElement): {
  palette: AsciiPalette;
  mono: string;
} {
  const probe = document.createElement("span");
  probe.style.display = "none";
  host.appendChild(probe);
  const read = (v: string, fallback: RGB): RGB => {
    probe.style.color = `var(${v})`;
    return parseColor(getComputedStyle(probe).color) ?? fallback;
  };
  const ink = read("--text", [33, 28, 23]);
  const paper = read("--bg", [245, 242, 235]);
  const accent = read("--accent", [255, 90, 30]);
  const faint = read("--text-faint", [156, 147, 133]);
  probe.style.fontFamily = "var(--font-mono)";
  const mono = getComputedStyle(probe).fontFamily || "monospace";
  host.removeChild(probe);
  return {
    palette: { ink, paper, accent, accentSoft: mixRGB(accent, paper, 0.45), faint },
    mono,
  };
}

interface AsciiCanvasProps {
  /** Program factory — pass a stable (module-level) function. */
  program: () => AsciiProgram;
  /** Cell size in px (clamped to a 10px minimum). */
  cell?: number;
  /** Extra classes on the host <div class="ascii-host">. */
  className?: string;
  /** Custom pixel→glyph mapper (pass a stable reference). */
  mapCell?: CellMapper;
  ramp?: string;
  maxFps?: number;
  /** Bump to re-render the static frame (reduced-motion only). */
  repaint?: number;
  /** Reports viewport visibility (drives e.g. video play/pause). */
  onVisibility?: (visible: boolean) => void;
}

export default function AsciiCanvas({
  program,
  cell = 11,
  className = "",
  mapCell,
  ramp = DEFAULT_RAMP,
  maxFps = 30,
  repaint = 0,
  onVisibility,
}: AsciiCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<{ repaintStatic: () => void } | null>(null);
  const onVisibilityRef = useRef(onVisibility);

  useEffect(() => {
    onVisibilityRef.current = onVisibility;
  }, [onVisibility]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { palette, mono } = resolveTheme(host);
    const cellPx = Math.max(10, cell);
    const prog = program();
    const map = mapCell ?? defaultMapper;
    const font = `700 ${cellPx}px ${mono}`;
    const forceStatic =
      typeof location !== "undefined" && /[?&]ascii=static/.test(location.search);
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isReduced = () => forceStatic || mql.matches;

    let W = 0;
    let H = 0;
    let cols = 0;
    let rows = 0;
    let octx: CanvasRenderingContext2D | null = null;
    let frameNo = 0;
    let tAcc = 0;
    let lastNow = 0;
    let raf = 0;
    let running = false;
    let visible = false;
    let disposed = false;
    const overlay: OverlayGlyph[] = [];

    function resize(): boolean {
      if (!host || !canvas || !ctx) return false;
      const r = host.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      if (Math.round(r.width) === W && Math.round(r.height) === H && octx)
        return true;
      W = Math.round(r.width);
      H = Math.round(r.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(1, Math.floor(W / cellPx));
      rows = Math.max(1, Math.floor(H / cellPx));
      const off = document.createElement("canvas");
      off.width = cols;
      off.height = rows;
      octx = off.getContext("2d", { willReadFrequently: true });
      prog.setup?.(cols, rows, palette);
      return true;
    }

    function render(t: number, dt: number, reduced: boolean) {
      if (!octx || !ctx) return;
      octx.clearRect(0, 0, cols, rows);
      overlay.length = 0;
      prog.paint({
        ctx: octx,
        cols,
        rows,
        t,
        dt,
        frame: frameNo,
        palette,
        overlay,
        reduced,
      });
      const img = octx.getImageData(0, 0, cols, rows).data;
      ctx.clearRect(0, 0, W, H);
      ctx.font = font;
      ctx.textBaseline = "top";
      for (let gy = 0; gy < rows; gy++) {
        const rowOff = gy * cols;
        for (let gx = 0; gx < cols; gx++) {
          const i = (rowOff + gx) * 4;
          const s = map(img[i], img[i + 1], img[i + 2], img[i + 3], ramp, palette);
          if (!s) continue;
          ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${s.alpha})`;
          ctx.fillText(s.ch, gx * cellPx, gy * cellPx);
        }
      }
      for (const g of overlay) {
        if (g.alpha <= 0.01) continue;
        ctx.fillStyle = `rgba(${g.color[0]},${g.color[1]},${g.color[2]},${g.alpha})`;
        ctx.fillText(g.ch, g.x * cellPx, g.y * cellPx);
      }
      frameNo++;
    }

    const minFrameMs = 1000 / Math.min(60, Math.max(1, maxFps));
    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      if (now - lastNow < minFrameMs - 4) return;
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 30;
      lastNow = now;
      tAcc += dt;
      render(tAcc, dt, false);
    }

    function renderStatic() {
      if (!resize()) return;
      render(prog.staticTime ?? 0, 1 / 30, true);
    }

    function sync() {
      if (disposed) return;
      const reduced = isReduced();
      const should = visible && !document.hidden && !reduced;
      if (should && !running) {
        running = true;
        lastNow = 0;
        raf = requestAnimationFrame(tick);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
      if (reduced && visible) renderStatic();
    }

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              visible = entries.some((e) => e.isIntersecting);
              onVisibilityRef.current?.(visible);
              sync();
            },
            { rootMargin: "80px" }
          )
        : null;
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (resize() && isReduced() && visible) renderStatic();
          })
        : null;

    apiRef.current = {
      repaintStatic: () => {
        if (isReduced()) renderStatic();
      },
    };

    // Defer everything past first paint so the hero copy stays the LCP.
    let idleId = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const start = () => {
      if (disposed) return;
      resize();
      if (io) io.observe(host);
      else {
        visible = true;
        sync();
      }
      ro?.observe(host);
      document.addEventListener("visibilitychange", sync);
      mql.addEventListener("change", sync);
      // Re-render the static frame once the real mono font is available.
      document.fonts?.ready.then(() => {
        if (!disposed && isReduced() && visible) renderStatic();
      });
    };
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(start, { timeout: 350 });
    } else {
      timerId = setTimeout(start, 80);
    }

    return () => {
      disposed = true;
      if (idleId && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timerId) clearTimeout(timerId);
      cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      mql.removeEventListener("change", sync);
      apiRef.current = null;
    };
  }, [program, cell, mapCell, ramp, maxFps]);

  // External nudge to refresh the reduced-motion static frame
  // (e.g. once a video's first frame is decoded).
  useEffect(() => {
    if (repaint > 0) apiRef.current?.repaintStatic();
  }, [repaint]);

  return (
    <div ref={hostRef} className={`ascii-host ${className}`.trim()} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
