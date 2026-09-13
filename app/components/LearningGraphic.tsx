"use client";

import { useId } from "react";
import AnimatedScene from "./AnimatedScene";

export default function LearningGraphic({ kind }: { kind: "mentorship" | "build" }) {
  const id = useId();

  return (
    <AnimatedScene className="learning-graphic">
      <svg viewBox="0 0 520 400" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>
          {kind === "mentorship"
            ? "A direct conversation between you, Fortune 500 leaders, and startup operators."
            : "A sketch becomes a working product with a mentor's feedback."}
        </title>
        <defs>
          <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <path d="M0 0V6" className="art-hatch" />
          </pattern>
          <pattern id={`${id}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" className="art-grid" />
          </pattern>
        </defs>
        <g aria-hidden="true">
          <path d="M20 30h12m-6-6v12M490 360h12m-6-6v12M24 360h12m-6-6v12" className="art-registration" />
          {kind === "mentorship" ? (
            <>
              <ellipse cx="260" cy="219" rx="209" ry="129" className="art-orbit" />
              <path d="M145 196V227Q145 250 174 250H228Q260 250 260 278M386 201V227Q386 250 355 250H292Q260 250 260 278" className="art-wire" />
              <path d="M260 278Q260 250 228 250H174Q145 250 145 227V196" className="art-signal art-signal--out" />
              <path d="M386 201V227Q386 250 355 250H292Q260 250 260 278" className="art-signal" />

              <g transform="rotate(-8 145 133)">
                <g className="art-float">
                  <rect x="57" y="54" width="176" height="161" rx="10" fill={`url(#${id}-hatch)`} />
                  <rect x="49" y="46" width="176" height="161" rx="10" className="art-paper" />
                  <path d="M49 171H225" className="art-rule" />
                  <path d="M88 153V90L130 67L173 90V153" className="art-building" />
                  <path d="M130 67V153M88 90L130 112L173 90M130 112V153" className="art-rule" />
                  {[0, 1, 2].map((row) => (
                    <g key={row} className="art-window">
                      <path d={`M98 ${102 + row * 16}l10 5v7l-10-5zM115 ${111 + row * 12}l7 4v7l-7-4z`} />
                      <path d={`M139 ${119 + row * 12}l8-4v7l-8 4zM155 ${110 + row * 12}l8-4v7l-8 4z`} />
                    </g>
                  ))}
                  <path d="M77 153H185M130 53V62" className="art-ink-line" />
                  <text x="137" y="194" textAnchor="middle" className="art-label">FORTUNE 500</text>
                </g>
              </g>

              <g transform="rotate(8 385 138)">
                <g className="art-float art-float--later">
                  <rect x="308" y="62" width="164" height="153" rx="10" fill={`url(#${id}-hatch)`} />
                  <rect x="300" y="54" width="164" height="153" rx="10" className="art-paper" />
                  <path d="M300 171H464" className="art-rule" />
                  <path d="M326 149V130H349V112H373V91H397V71H425V149Z" className="art-building" />
                  <path d="M326 149H425M349 130V149M373 112V149M397 91V149" className="art-rule" />
                  <path d="M324 108L351 91L372 95L409 58M396 58H409V71" className="art-growth" />
                  <text x="382" y="194" textAnchor="middle" className="art-label">SCALING STARTUPS</text>
                </g>
              </g>

              <g transform="rotate(-3 260 318)">
                <rect x="156" y="287" width="222" height="80" rx="12" className="art-shadow" />
                <rect x="149" y="280" width="222" height="80" rx="12" className="art-ember" />
                <path d="M169 298H197V318H180L174 325V318H169Z" className="art-chat" />
                <path d="M176 304H190M176 311H186" className="art-chat" />
                <text x="212" y="307" className="art-label">YOU</text>
                <text x="169" y="344" className="art-question">Where do I start?</text>
              </g>
              <g className="art-spark">
                <path d="M258 204V218M251 211H265M273 220l7 7m0-7-7 7" className="art-growth" />
              </g>
            </>
          ) : (
            <>
              <g transform="rotate(-8 145 193)">
                <rect x="39" y="68" width="205" height="262" rx="4" fill={`url(#${id}-hatch)`} />
                <rect x="31" y="60" width="205" height="262" rx="4" className="art-paper" />
                <rect x="32" y="61" width="203" height="260" fill={`url(#${id}-grid)`} />
                <path d="M55 94H134M55 102H103M56 130L203 128L205 197L54 200Z M56 219H121V266H54ZM141 218H204V265H140Z" className="art-sketch" />
                <path d="M63 184L90 158L114 175L149 143L181 162M166 148L181 162L165 172" className="art-pencil-line" />
                <text x="55" y="301" className="art-label">YOUR IDEA</text>
                <path d="M43 117Q144 102 217 119L217 212Q123 223 44 211Z" pathLength="1" className="art-feedback" />
              </g>

              <path d="M169 45C230 6 304 19 339 72M324 65L340 74L340 56" pathLength="1" className="art-feedback-arrow" />
              <text x="211" y="11" transform="rotate(7 211 11)" className="art-note">mentor input</text>

              <g>
                <rect x="244" y="106" width="254" height="232" rx="12" className="art-shadow" />
                <rect x="236" y="98" width="254" height="232" rx="12" className="art-paper" />
                <path d="M237 127H489" className="art-rule" />
                {[250, 262, 274].map((x) => <circle key={x} cx={x} cy="113" r="3" className="art-dot" />)}
                <path d="M432 113H473" className="art-rule" />
                <g className="art-assemble">
                  <rect x="255" y="146" width="216" height="72" rx="5" className="art-ember" />
                  <path d="M274 171H352M274 181H325M274 200H306" className="art-product-line" />
                  <path d="M405 194L440 160M415 160H440V185" className="art-product-arrow" />
                </g>
                <g className="art-assemble art-assemble--later">
                  {[255, 331, 407].map((x) => (
                    <g key={x}>
                      <rect x={x} y="234" width="64" height="46" rx="4" className="art-building" />
                      <path d={`M${x + 9} 246h25M${x + 9} 255h42M${x + 9} 264h33`} className="art-rule" />
                    </g>
                  ))}
                  <path d="M255 301H309M255 310H292" className="art-rule" />
                  <rect x="394" y="295" width="77" height="19" rx="4" className="art-ink" />
                </g>
              </g>
              <text x="363" y="358" textAnchor="middle" className="art-label">SOMETHING REAL</text>
              <g className="art-pencil">
                <path d="M151 321L202 253L212 261L161 329L148 335Z" className="art-ember" />
                <path d="M151 321L161 329L148 335ZM198 259L208 267" className="art-ink-line" />
              </g>
            </>
          )}
        </g>
      </svg>
    </AnimatedScene>
  );
}
