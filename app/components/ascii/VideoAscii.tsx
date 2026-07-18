"use client";

/**
 * VideoAscii — turns any real footage into on-brand generative ASCII.
 *
 * Plays a hidden muted/looping video, draws each frame into the engine's
 * low-res pass, and maps luminance to the char ramp: bright/hot pixels
 * render in ember, midtones in ink, shadows dissolve into the paper.
 *
 * Graceful fallback: the src is probed with a HEAD request first (so a
 * missing file never logs a resource error), and any decode/load failure
 * swaps in the provided procedural fallback program. Drop a licensed
 * clip at the src path under /public and this upgrades itself —
 * see docs/ASCII-NOTES.md.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsciiCanvas, {
  type AsciiProgram,
  type CellMapper,
} from "./AsciiCanvas";

interface VideoAsciiProps {
  /** Video under /public, e.g. "/video/launch.mp4" (mp4/webm). */
  src: string;
  /** Procedural program used when the video is missing or fails. */
  fallback: () => AsciiProgram;
  cell?: number;
  className?: string;
  /** Luminance (0–1) above which pixels render in ember. */
  hotLuma?: number;
}

export default function VideoAscii({
  src,
  fallback,
  cell,
  className = "",
  hotLuma = 0.62,
}: VideoAsciiProps) {
  // The procedural fallback renders from frame one; the probe only swaps
  // in the video pipeline if the file actually exists — so the animation
  // never waits on a network round-trip to start.
  const [mode, setMode] = useState<"fallback" | "video">("fallback");
  const [repaint, setRepaint] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(src, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") ?? "";
        // A missing /public file comes back as an HTML 404 page.
        if (alive && r.ok && !type.includes("text/html")) setMode("video");
      })
      .catch(() => {}); // stay on the procedural fallback
    return () => {
      alive = false;
    };
  }, [src]);

  // Cover-crops the current video frame into the low-res scene each tick.
  const videoProgram = useMemo(() => {
    return (): AsciiProgram => ({
      paint({ ctx, cols, rows }) {
        const v = videoRef.current;
        if (!v || v.readyState < 2 || !v.videoWidth) return;
        const va = v.videoWidth / v.videoHeight;
        const ca = cols / rows;
        let sx = 0;
        let sy = 0;
        let sw = v.videoWidth;
        let sh = v.videoHeight;
        if (va > ca) {
          sw = v.videoHeight * ca;
          sx = (v.videoWidth - sw) / 2;
        } else {
          sh = v.videoWidth / ca;
          sy = (v.videoHeight - sh) / 2;
        }
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, cols, rows);
      },
      staticTime: 0,
    });
  }, []);

  const mapLuma: CellMapper = useCallback(
    (r, g, b, a, ramp, palette) => {
      if (a < 40) return null;
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const idx = Math.min(
        ramp.length - 1,
        Math.floor(Math.pow(l, 1.15) * ramp.length)
      );
      const ch = ramp[idx];
      if (ch === " ") return null;
      const hot = l > hotLuma;
      const c = hot ? palette.accent : palette.ink;
      return {
        ch,
        r: c[0],
        g: c[1],
        b: c[2],
        alpha: hot ? 0.35 + 0.65 * l : 0.12 + 0.5 * l,
      };
    },
    [hotLuma]
  );

  // Pause the hidden video while the canvas is off-viewport.
  const handleVisibility = useCallback((visible: boolean) => {
    const v = videoRef.current;
    if (!v) return;
    if (!visible) v.pause();
    else if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      v.play().catch(() => {});
  }, []);

  if (mode === "fallback") {
    return <AsciiCanvas program={fallback} cell={cell} className={className} />;
  }

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        autoPlay
        playsInline
        preload="auto"
        style={{ display: "none" }}
        onError={() => setMode("fallback")}
        onLoadedData={() => {
          const v = videoRef.current;
          if (
            v &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ) {
            v.pause(); // keep the decoded first frame for the static render
          }
          setRepaint((n) => n + 1);
        }}
      />
      <AsciiCanvas
        program={videoProgram}
        cell={cell}
        className={className}
        mapCell={mapLuma}
        repaint={repaint}
        onVisibility={handleVisibility}
      />
    </>
  );
}
