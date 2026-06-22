import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operator OS — High Agency Design System",
  robots: { index: false, follow: false },
};

/* Tiny monochrome outline icons (stroke: currentColor — color comes from context). */
const Flame = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2c1 3 4 4 4 8a4 4 0 1 1-8 0c0-1 .5-2 1-2.5C9 9 8.5 11 7 12c-1-1.5-1-3-1-4 0 0-2 2-2 6a8 8 0 1 0 16 0c0-5-4-8-8-12Z" />
  </svg>
);
const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const Bolt = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
);
const LEVELS = [
  { n: "01", name: "Cadet", xp: "0", on: false },
  { n: "02", name: "Builder", xp: "100", on: true },
  { n: "03", name: "Operator", xp: "300", on: false },
  { n: "04", name: "Closer", xp: "700", on: false },
  { n: "05", name: "Architect", xp: "1300", on: false },
];

const SURFACES = [
  ["--bg", "#F5F2EB", "Paper canvas"],
  ["--surface", "#FFFFFF", "Floating cards"],
  ["--surface-2", "#F1EDE4", "Inset / hover"],
  ["--surface-3", "#FBFAF6", "Nested inset"],
  ["--border", "#E9E4D8", "Hairline"],
  ["--border-strong", "#D8D2C4", "Strong edge"],
];
const EMBER = [
  ["--accent", "#FF5A1E", "Action"],
  ["--accent-hover", "#F04E14", "Hover"],
  ["--accent-press", "#CE400C", "3D base edge"],
  ["--accent-soft", "rgba", "Tint"],
];
const LIME = [
  ["--signal", "#C6F24E", "Earned fill"],
  ["--signal-text", "#3F8F1C", "Earned text"],
  ["--signal-press", "#8FB534", "3D base edge"],
  ["--signal-soft", "rgba", "Tint"],
];
const FUNC = [
  ["--success", "#3F8F1C", "Verified"],
  ["--warn", "#C2790F", "Returned"],
  ["--danger", "#D63A2C", "Error"],
];

function Swatch({ varName, hex, label }: { varName: string; hex: string; label: string }) {
  return (
    <div className="sg-swatch">
      <span className="sg-chip" style={{ background: `var(${varName})` }} />
      <div className="sg-swatch-meta">
        <b className="mono">{varName}</b>
        <small className="mono">{hex}</small>
        <em>{label}</em>
      </div>
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <div className="sg">
      {/* glass nav — the real component */}
      <nav className="nav">
        <div className="wrap nav__inner">
          <span className="brand"><span className="brand__mark" />High&nbsp;Agency</span>
          <div className="nav__right">
            <div className="nav__links">
              <a>System</a><a>Color</a><a>Type</a><a>Gamify</a>
            </div>
            <span className="badge badge--level"><span className="badge__dot" />Operator OS · v3</span>
          </div>
        </div>
      </nav>

      {/* cover */}
      <header className="sg-cover blueprint">
        <div className="wrap" style={{ paddingTop: "clamp(56px,8vw,104px)", paddingBottom: "clamp(48px,7vw,88px)" }}>
          <span className="eyebrow eyebrow--accent" style={{ marginBottom: 22 }}>
            <span className="dot" /> Design System — v3.0 · Light
          </span>
          <h1 className="display" style={{ maxWidth: 12 + "ch" }}>
            Operator&nbsp;<span className="accent">OS</span>
          </h1>
          <p className="lead" style={{ marginTop: 24 }}>
            The visual language of a launchpad that rewards proof. Warm paper canvas, white
            cards that float, two accents with one job each, a tactile 3D push button, and
            mono for every number you earned.
          </p>

          <div className="sg-legend">
            <div className="sg-legend-card">
              <span className="sg-legend-dot" style={{ background: "var(--accent)" }} />
              <div>
                <b className="mono">EMBER · #FF5A1E</b>
                <p>Energy &amp; action. The primary CTA, active states, the ignite.</p>
              </div>
            </div>
            <div className="sg-legend-card">
              <span className="sg-legend-dot" style={{ background: "var(--signal)" }} />
              <div>
                <b className="mono">LIME · #C6F24E</b>
                <p>Proof. XP, levels, streaks, verified milestones — what you earned.</p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 40, flexWrap: "wrap" }}>
            <button className="btn btn--primary">Apply to the founding batch</button>
            <button className="btn btn--signal"><Check /> Verify milestone</button>
            <button className="btn btn--ghost">View track</button>
          </div>
        </div>
      </header>

      <div className="wrap sg-body">
        {/* COLOR */}
        <section className="sg-section">
          <div className="sg-head">
            <span className="eyebrow"><span className="dot" /> 01 — Foundation</span>
            <h2 className="h2">Color</h2>
            <p className="lead">Neutrals carry the page. The two accents land hard because they&apos;re scarce.</p>
          </div>
          <div className="sg-grid-4">
            <div><p className="kicker sg-label">Surfaces</p><div className="sg-swatches">{SURFACES.map((s) => <Swatch key={s[0]} varName={s[0]} hex={s[1]} label={s[2]} />)}</div></div>
            <div><p className="kicker sg-label">Ember</p><div className="sg-swatches">{EMBER.map((s) => <Swatch key={s[0]} varName={s[0]} hex={s[1]} label={s[2]} />)}</div></div>
            <div><p className="kicker sg-label">Lime</p><div className="sg-swatches">{LIME.map((s) => <Swatch key={s[0]} varName={s[0]} hex={s[1]} label={s[2]} />)}</div></div>
            <div><p className="kicker sg-label">Functional</p><div className="sg-swatches">{FUNC.map((s) => <Swatch key={s[0]} varName={s[0]} hex={s[1]} label={s[2]} />)}</div></div>
          </div>
        </section>

        <div className="divider" />

        {/* TYPE */}
        <section className="sg-section">
          <div className="sg-head">
            <span className="eyebrow"><span className="dot" /> 02 — Foundation</span>
            <h2 className="h2">Typography</h2>
            <p className="lead">Bricolage headlines. Hanken body. Geist Mono for data. Three faces, three jobs.</p>
          </div>
          <div className="sg-type">
            <div className="sg-type-row">
              <span className="kicker sg-type-tag">Display · Bricolage 800</span>
              <span className="display" style={{ fontSize: "clamp(40px,6vw,76px)" }}>Build the thing.</span>
            </div>
            <div className="sg-type-row">
              <span className="kicker sg-type-tag">H2 · Bricolage 700</span>
              <span className="h2">Access you earn, not buy.</span>
            </div>
            <div className="sg-type-row">
              <span className="kicker sg-type-tag">H3 · Bricolage 600</span>
              <span className="h3">Verified by a human, not a quiz.</span>
            </div>
            <div className="sg-type-row">
              <span className="kicker sg-type-tag">Lead · Hanken 400</span>
              <span className="lead" style={{ margin: 0 }}>A selective squad for ambitious young operators who&apos;d rather ship than study.</span>
            </div>
            <div className="sg-type-row">
              <span className="kicker sg-type-tag">Body · Hanken 400</span>
              <span style={{ fontSize: 16, color: "var(--text-muted)", maxWidth: "60ch" }}>The cheapest action that keeps a streak alive is a one-line build log. Progress is earned by doing real things — and the interface treats it that way.</span>
            </div>
            <div className="sg-type-row">
              <span className="kicker sg-type-tag">Eyebrow · Geist Mono</span>
              <span className="eyebrow eyebrow--signal"><span className="dot" /> IGNITION TRACK · WEEK 03</span>
            </div>
            <div className="sg-type-row">
              <span className="kicker sg-type-tag">Data · Geist Mono</span>
              <span className="mono" style={{ fontSize: 34, fontWeight: 600, color: "var(--signal)", letterSpacing: "-0.03em" }}>240&nbsp;XP&nbsp;<span style={{ color: "var(--text-faint)", fontSize: 16 }}>/ 300</span></span>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* CONTROLS */}
        <section className="sg-section">
          <div className="sg-head">
            <span className="eyebrow"><span className="dot" /> 03 — Components</span>
            <h2 className="h2">Controls</h2>
            <p className="lead">Tactile and rounded. The primary CTA is a 3D &quot;push&quot; button — it sits on a base edge, lifts on hover, and travels down when you click.</p>
          </div>
          <div className="sg-grid-2">
            <div className="panel">
              <div className="panel__head"><span className="h3">Buttons</span><span className="kicker">.btn</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <button className="btn btn--primary">Ignite</button>
                <button className="btn btn--signal"><Check /> Verified</button>
                <button className="btn btn--neutral">Neutral</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <button className="btn btn--ghost">Ghost</button>
                <button className="btn btn--primary" disabled>Disabled</button>
              </div>
            </div>
            <div className="panel">
              <div className="panel__head"><span className="h3">Fields &amp; chips</span><span className="kicker">.field · .pick</span></div>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Mission, one line</label>
                <input placeholder="Tutoring marketplace for my school district" defaultValue="" />
              </div>
              <div className="chip-row">
                <span className="pick sel">Fintech</span>
                <span className="pick">Hardware</span>
                <span className="pick">Climate</span>
                <span className="pick sel">AI tools</span>
                <span className="chip chip--open">Open to all</span>
                <span className="chip chip--gate">L3 gate</span>
              </div>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* GAMIFICATION — the centerpiece */}
        <section className="sg-section">
          <div className="sg-head">
            <span className="eyebrow eyebrow--signal"><span className="dot" /> 04 — The system</span>
            <h2 className="h2">Earned status</h2>
            <p className="lead">The gamification language. Ember for what you&apos;re doing, lime for what you&apos;ve proven.</p>
          </div>

          {/* operator levels */}
          <p className="kicker sg-label">Operator levels</p>
          <div className="sg-levels">
            {LEVELS.map((l) => (
              <div key={l.n} className={`sg-level ${l.on ? "sg-level--on" : ""}`}>
                <span className="mono sg-level-n">{l.n}</span>
                <b>{l.name}</b>
                <span className="mono sg-level-xp">{l.xp} XP</span>
                {l.on && <span className="badge badge--level" style={{ marginTop: 6 }}><span className="badge__dot" />You</span>}
              </div>
            ))}
          </div>

          {/* HUD stat cards — like the dashboard */}
          <div className="stats" style={{ marginTop: 32, marginBottom: 32 }}>
            <div className="stat-card">
              <span className="stat-card__label">Streak</span>
              <span className="stat-card__n">12<small>days</small></span>
              <span className="stat-card__hint">2 freezes banked · longest run yet</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Operator level</span>
              <span className="stat-card__n stat-card__n--sm">Builder</span>
              <span className="meter meter--wide"><i style={{ width: "70%" }} /></span>
              <span className="stat-card__hint">240 / 300 XP to Operator</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Ignition track</span>
              <span className="stat-card__n">3<small>/ 7 verified</small></span>
              <span className="meter meter--wide meter--ember"><i style={{ width: "43%" }} /></span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Next ritual</span>
              <span className="stat-card__n stat-card__n--sm">Thu 18:00</span>
              <span className="stat-card__hint">Squad demo · 4 of 5 confirmed</span>
            </div>
          </div>

          <div className="sg-grid-2">
            {/* milestone track */}
            <div className="panel">
              <div className="panel__head"><span className="h3">Ignition Track</span><span className="kicker">.track</span></div>
              <div className="track">
                <div className="track__item done">
                  <div className="track__rail"><span className="track__dot"><Check /></span></div>
                  <div className="track__body">
                    <div className="track__top"><b>Mission Locked</b><span className="track__meta">M1 · Peer-verified</span></div>
                    <span className="track__mine track__mine--ok mono">+40 XP · verified by squad lead</span>
                  </div>
                </div>
                <div className="track__item done">
                  <div className="track__rail"><span className="track__dot"><Check /></span></div>
                  <div className="track__body">
                    <div className="track__top"><b>First Build</b><span className="track__meta">M2 · Peer-verified</span></div>
                    <span className="track__mine track__mine--ok mono">+60 XP · verified</span>
                  </div>
                </div>
                <div className="track__item active">
                  <div className="track__rail"><span className="track__dot">3</span></div>
                  <div className="track__body">
                    <div className="track__top"><b>First Users</b><span className="track__meta">M3 · In review</span></div>
                    <span className="track__why">Show 5 humans who aren&apos;t your mom using it.</span>
                    <div className="track__returned">
                      <span>Returned — needs proof, not a screenshot.</span>
                      <i>&ldquo;Add a short clip of someone using it live.&rdquo;</i>
                      <button className="btn btn--primary track__btn">Resubmit evidence</button>
                    </div>
                  </div>
                </div>
                <div className="track__item">
                  <div className="track__rail"><span className="track__dot">4</span></div>
                  <div className="track__body">
                    <div className="track__top"><b>First Revenue</b><span className="track__meta">M4 · Mentor-verified · Locked</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* build log + streak */}
            <div className="cohort-side">
              <div className="panel">
                <div className="panel__head"><span className="h3">Build log</span><span className="xp-pill mono">+10 <small>XP / day</small></span></div>
                <div className="log-composer">
                  <textarea placeholder="What did you ship today? One line." />
                  <button className="btn btn--signal">Log</button>
                </div>
                <div className="log-feed">
                  <div className="log-row"><div><b>Today</b><p>Shipped onboarding email flow, 3 signups overnight.</p></div></div>
                  <div className="log-row"><div><b className="mono">Yesterday</b><p>Cold-DMed 10 schools. 2 replies, 1 demo booked.</p></div></div>
                  <div className="log-row"><div><b className="mono">Mon</b><p>Fixed the broken checkout. Live again.</p></div></div>
                </div>
              </div>

              {/* a cohort card (mine) */}
              <div className="ccard ccard--mine">
                <div className="ccard__top">
                  <span className="h3">Velocity Squad</span>
                  <span className="ccard__count mono">5 / 8 · 4wk streak</span>
                </div>
                <p className="ccard__mission">Each operator ships their own venture; the squad keeps the cadence.</p>
                <div className="ccard__tags">
                  <span className="chip chip--on">AI tools</span>
                  <span className="chip">B2B</span>
                  <span className="chip chip--why"><Flame /> 88% match</span>
                </div>
                <span className="meter meter--wide" style={{ marginTop: 4 }}><i style={{ width: "62%" }} /></span>
                <div className="ccard__foot">
                  <span className="ccard__founder">Founded by Maya R.</span>
                  <span className="ccard__status">Active</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* GLASS + motion notes */}
        <section className="sg-section">
          <div className="sg-head">
            <span className="eyebrow"><span className="dot" /> 05 — Surfaces &amp; motion</span>
            <h2 className="h2">Float &amp; depth</h2>
            <p className="lead">Cards float on soft, warm, layered shadows by default. Frosted glass is reserved for elevated chrome.</p>
          </div>
          <div className="sg-grid-3">
            <div className="glass sg-glass">
              <span className="badge badge--earned"><Check /> Earned</span>
              <b className="h3" style={{ marginTop: 14, display: "block" }}>Verified seal</b>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>Lime-tinted glass for milestones a human signed off.</p>
            </div>
            <div className="glass sg-glass">
              <span className="side__streak" style={{ display: "inline-flex" }}><Flame /> <b className="mono">12-day</b> streak</span>
              <b className="h3" style={{ marginTop: 14, display: "block" }}>HUD chip</b>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>The streak rides in the glass sidebar rail.</p>
            </div>
            <div className="pillar" style={{ margin: 0 }}>
              <span className="pillar__no mono">DEPTH</span>
              <div className="pillar__ic"><Bolt /></div>
              <h3>Soft elevation</h3>
              <p>Cards lift on hover with a soft shadow — tactile, not flat. The single colored glow is the ignite button.</p>
            </div>
          </div>
          <p className="kicker sg-label" style={{ marginTop: 40 }}>Signature interaction</p>
          <div className="notice" style={{ marginTop: 12 }}>
            <b>The 3D push button</b> — the ember CTA rests on a solid darker-ember base edge. Hover
            and it lifts; click and it travels down 4px as the base collapses, like a real button being
            pressed. The lime &quot;verify&quot; button does the same in green. Everything respects
            <span className="mono"> prefers-reduced-motion</span>.
          </div>
        </section>

        <footer className="footer" style={{ marginTop: 48 }}>
          <div className="footer__inner">
            <span className="brand"><span className="brand__mark" />High&nbsp;Agency</span>
            <small className="mono">OPERATOR OS · DESIGN SYSTEM v2.0 · /styleguide</small>
          </div>
        </footer>
      </div>

      {/* styleguide-only scaffolding (not part of the product CSS) */}
      <style>{`
        .sg { min-height: 100vh; }
        .sg-cover { border-bottom: 1px solid var(--border); }
        .sg-body { padding-bottom: 80px; }
        .sg-section { padding: clamp(48px,6vw,84px) 0; }
        .sg-head { max-width: 680px; margin-bottom: clamp(28px,4vw,44px); }
        .sg-head .eyebrow { margin-bottom: 16px; }
        .sg-head h2 { margin-bottom: 14px; }
        .sg-label { display: block; margin-bottom: 16px; color: var(--text-faint); }
        .sg-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-gap); align-items: start; }
        .sg-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: var(--space-gap); }
        .sg-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: var(--space-gap); }
        .sg-swatches { display: flex; flex-direction: column; gap: 10px; }
        .sg-swatch { display: flex; align-items: center; gap: 12px; }
        .sg-chip { width: 40px; height: 40px; border-radius: 10px; flex: 0 0 auto; border: 1px solid var(--border-strong); box-shadow: var(--shadow-sm); }
        .sg-swatch-meta { display: flex; flex-direction: column; line-height: 1.35; min-width: 0; }
        .sg-swatch-meta b { font-size: 12px; color: var(--text); }
        .sg-swatch-meta small { font-size: 11px; color: var(--text-faint); }
        .sg-swatch-meta em { font-size: 11px; font-style: normal; color: var(--text-muted); }
        .sg-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 40px; max-width: 720px; }
        .sg-legend-card { display: flex; gap: 14px; align-items: flex-start; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 18px 20px; box-shadow: var(--shadow-sm); }
        .sg-legend-dot { width: 12px; height: 12px; border-radius: 999px; flex: 0 0 auto; margin-top: 5px; }
        .sg-legend-card b { font-size: 12px; display: block; }
        .sg-legend-card p { font-size: 14px; color: var(--text-muted); margin-top: 4px; line-height: 1.45; }
        .sg-type { display: flex; flex-direction: column; }
        .sg-type-row { display: grid; grid-template-columns: 180px 1fr; gap: 28px; align-items: baseline; padding: 22px 0; border-top: 1px solid var(--border); }
        .sg-type-row:last-child { border-bottom: 1px solid var(--border); }
        .sg-type-tag { color: var(--text-faint); }
        .sg-levels { display: grid; grid-template-columns: repeat(5,1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-card); overflow: hidden; box-shadow: var(--shadow-md); }
        .sg-level { display: flex; flex-direction: column; gap: 6px; padding: 22px 20px; background: var(--surface); }
        .sg-level--on { background: var(--surface-2); box-shadow: inset 3px 0 0 var(--accent); }
        .sg-level-n { font-size: 12px; color: var(--text-faint); }
        .sg-level b { font-family: var(--font-head); font-size: 19px; font-weight: 700; letter-spacing: -0.02em; }
        .sg-level--on b { color: var(--accent); }
        .sg-level-xp { font-size: 12px; color: var(--text-muted); }
        .sg-glass { border-radius: var(--radius-card); padding: 22px; }
        @media (max-width: 1000px) {
          .sg-grid-4 { grid-template-columns: 1fr 1fr; }
          .sg-grid-3 { grid-template-columns: 1fr; }
          .sg-levels { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 760px) {
          .sg-grid-2 { grid-template-columns: 1fr; }
          .sg-grid-4 { grid-template-columns: 1fr; }
          .sg-legend { grid-template-columns: 1fr; }
          .sg-type-row { grid-template-columns: 1fr; gap: 6px; }
          .sg-levels { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
