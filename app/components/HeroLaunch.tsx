"use client";

import { useId } from "react";
import AnimatedScene from "./AnimatedScene";

export default function HeroLaunch() {
  const id = useId();
  return (
    <AnimatedScene className="hero-launch">
      <svg viewBox="0 0 560 620" fill="none" aria-hidden="true">
        <defs>
          <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <path d="M0 0V7" className="launch-hatch" />
          </pattern>
          <pattern id={`${id}-dots`} width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.9" className="launch-dot" />
          </pattern>
          <linearGradient id={`${id}-exhaust`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx="286" cy="286" r="232" fill={`url(#${id}-dots)`} />
        <g className="launch-heading">
          <g className="launch-flight">
            <g className="launch-exhaust">
              <path d="M265 351C255 388 248 436 264 518L286 575L307 518C324 436 315 388 305 351Z" fill={`url(#${id}-exhaust)`} className="launch-plume" />
              <path d="M278 357C267 414 285 460 283 510M298 356C307 401 290 438 291 477" className="launch-exhaust-line" />
              <g className="launch-speed">
                <path d="M244 390V438M328 408V470M259 495V525M311 520V552" />
              </g>

            </g>

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
        </g>

        <path d="M104 560H458M124 560V568M438 560V568" className="launch-ground" />
      </svg>
    </AnimatedScene>
  );
}
