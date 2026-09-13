"use client";

import { useEffect, useId, useRef } from "react";

export default function HeroLaunch() {
  const id = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rocketRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const rocket = rocketRef.current;
    if (!host || !canvas || !rocket) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const styles = getComputedStyle(host);
    const orange = styles.getPropertyValue("--accent").trim();
    const paper = styles.getPropertyValue("--surface-3").trim();
    const surface = styles.getPropertyValue("--surface").trim();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let time = 0;
    let lastFrame = 0;
    let raf = 0;
    let visible = false;
    let running = false;

    const pose = (t: number) => ({
      x: 326 + Math.sin(t * 0.52) * 18,
      y: 244 + Math.sin(t * 0.52 + 0.65) * 20,
      angle: 34 + Math.sin(t * 0.52 + 0.35) * 3.6,
    });

    const paint = (t: number) => {
      const p = pose(t);
      rocket.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${p.angle}) translate(-286 -220)`);
      ctx.fillStyle = surface;
      ctx.fillRect(0, 0, 560, 620);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle * Math.PI / 180);
      ctx.translate(-286, -220);

      // Both layers follow the same centerline and heat pulse, anchored at the nozzle.
      const thrust = Math.sin(t * 5) * 0.6 + Math.sin(t * 8.3) * 0.4;
      const length = 216 + thrust * 11;
      const center = (s: number) => 286 + s * s * Math.sin(t * 2.4) * 2;
      const ribbon = (reach: number, width: number, color: string, opacity: number) => {
        const gradient = ctx.createLinearGradient(0, 355, 0, 355 + length * reach);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.18, color);
        gradient.addColorStop(1, `${color}00`);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        for (const side of [-1, 1]) {
          for (let i = 0; i <= 28; i++) {
            const s = (side === -1 ? i : 28 - i) / 28 * reach;
            const pulse = 1 + Math.sin(t * 7 - s * 10) * 0.055 * s;
            const halfWidth = width / 2 * Math.pow(1 - s / reach, 0.7) * pulse;
            const x = center(s) + side * halfWidth;
            const y = 354 + s * length;
            if (side === -1 && i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.fill();
      };
      ribbon(1, 43, orange, 0.76 + thrust * 0.035);
      ribbon(0.66, 18, paper, 0.86 + thrust * 0.025);
      ctx.restore();

      // Small cooling embers follow earlier ship positions, so turns leave a wake.
      for (let i = 0; i < 18; i++) {
        const age = (t * 0.65 + i / 18) % 1;
        const old = pose(t - age * 0.9);
        const angle = old.angle * Math.PI / 180;
        const spread = Math.sin(i * 12.7) * (8 + age * 28);
        const distance = 143 + age * 260;
        ctx.globalAlpha = Math.sin(age * Math.PI) * (1 - age) * 0.26;
        ctx.fillStyle = orange;
        ctx.beginPath();
        ctx.arc(old.x + spread * Math.cos(angle) - distance * Math.sin(angle), old.y + spread * Math.sin(angle) + distance * Math.cos(angle), 1 + age * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * dpr));
      canvas.height = Math.max(1, Math.round(bounds.height * dpr));
      ctx.setTransform(canvas.width / 560, 0, 0, canvas.height / 620, 0, 0);
      paint(motion.matches ? 0 : time);
    };

    // Match the existing canvas lifecycle: cap work at 60 fps and pause offscreen.
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (lastFrame && now - lastFrame < 1000 / 60 - 1) return;
      time += lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
      lastFrame = now;
      paint(time);
    };
    const sync = () => {
      const shouldRun = visible && !document.hidden && !motion.matches;
      if (shouldRun && !running) {
        lastFrame = 0;
        raf = requestAnimationFrame(tick);
      } else if (!shouldRun && running) {
        cancelAnimationFrame(raf);
      }
      running = shouldRun;
      if (motion.matches) paint(0);
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const observer = new ResizeObserver(resize);
    intersection.observe(host);
    observer.observe(host);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    resize();
    return () => {
      cancelAnimationFrame(raf);
      intersection.disconnect();
      observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <div className="hero-launch" ref={hostRef} aria-hidden="true">
      <canvas ref={canvasRef} />
      <svg viewBox="0 0 560 620" fill="none">
        <defs>
          <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <path d="M0 0V7" className="launch-hatch" />
          </pattern>
          <pattern id={`${id}-graph`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" className="launch-graph-line" />
          </pattern>
        </defs>
        <g className="launch-workbench">
          <g transform="rotate(-9 135 190)">
            <path d="M49 92H208L226 110V292H49Z" className="launch-draft-paper" />
            <path d="M49 92H208L226 110V292H49Z" fill={`url(#${id}-graph)`} />
            <path d="M208 92V110H226" className="launch-draft-line" />
            <text x="67" y="121" className="launch-draft-label">YOUR FIRST IDEA</text>
            <path d="M67 145L207 147L205 247L66 245ZM67 162H206" className="launch-draft-line" />
            <circle cx="75" cy="154" r="1.5" className="launch-draft-dot" />
            <circle cx="82" cy="154" r="1.5" className="launch-draft-dot" />
            <path d="M80 177H135M80 186H115M80 204H121V229H80ZM140 177H192V229H140Z" className="launch-draft-line" />
            <path d="M148 217L160 203L173 210L185 191M177 192L185 191L185 199" className="launch-draft-line" />
            <path d="M72 198Q98 194 129 197L129 235Q99 239 73 235Z" className="launch-pencil-mark" />
            <path d="M181 271Q158 264 122 245M127 253L120 244L132 246" className="launch-pencil-mark" />
            <text x="70" y="276" className="launch-pencil-note">start small</text>
          </g>
          <g transform="rotate(6 440 454)">
            <path d="M347 400H529V489H409L389 507V489H347Z" className="launch-draft-paper" />
            <path d="M362 418H377M362 422H372" className="launch-pencil-mark" />
            <text x="388" y="423" className="launch-draft-label">MENTOR INPUT</text>
            <text x="362" y="450" className="launch-mentor-note">
              <tspan x="362">What would</tspan><tspan x="362" dy="21">you test first?</tspan>
            </text>
            <path d="M401 477Q448 482 493 476" className="launch-pencil-mark" />
          </g>
        </g>
        <g ref={rocketRef} transform="translate(326 256) rotate(35.2) translate(-286 -220)">
          <path d="M255 250L217 310V351L264 323M315 250L353 310V351L306 323" className="launch-fin" />
          <path d="M255 250L217 310V351L264 323M315 250L353 310V351L306 323" fill={`url(#${id}-hatch)`} />
          <path d="M259 330L251 359H320L310 330" className="launch-nozzle" />
          <path d="M257 359H314M260 345H312M254 352H317" className="launch-ink-line" />

          <path d="M251 327V178C251 133 265 104 286 83C307 104 321 133 321 178V327Q286 341 251 327Z" className="launch-body" />
          <path d="M286 83C308 118 310 158 310 195V331Q316 330 321 327V178C321 133 307 104 286 83Z" className="launch-shade" />
          <path d="M251 178Q286 190 321 178M251 307Q286 321 321 307" className="launch-ink-line" />
          <path d="M262 178C262 149 269 122 277 108" className="launch-highlight" />
          <path d="M262 199V302M310 199V302" className="launch-seam" />
          <circle cx="286" cy="220" r="20" className="launch-window-ring" />
          <circle cx="286" cy="220" r="13" className="launch-window" />
          <path d="M279 224L290 213M285 229L296 218" className="launch-window-glint" />
          <path d="M276 265H296M276 273H296M276 281H288" className="launch-ink-line" />
          <path d="M286 301L279 341L286 358L293 341Z" className="launch-center-fin" />
          <g className="launch-rivets">
            {[198, 244, 290].map(y => <g key={y}><circle cx="256" cy={y} r="1.5" /><circle cx="316" cy={y} r="1.5" /></g>)}
          </g>
        </g>
      </svg>
    </div>
  );
}
