"use client";

import { useCallback, useEffect, useState } from "react";
import Reveal from "./components/Reveal";
import Counter from "./components/Counter";
import Marquee from "./components/Marquee";
import Faq from "./components/Faq";
import ApplyModal from "./components/ApplyModal";
import { PLATFORM_ENABLED } from "./lib/flags";

function CaptureForm({
  label,
  onApply,
}: {
  label: string;
  onApply: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  return (
    <form
      className="capture"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(email.trim());
      }}
    >
      <div className="capture__field">
        <input
          type="email"
          name="email"
          placeholder="you@email.com"
          autoComplete="email"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn--primary">
        {label}
      </button>
    </form>
  );
}

export default function Waitlist() {
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState("");
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("ha_application") || "null"
      );
      if (saved && saved.submitted) setApplied(true);
    } catch {}
  }, []);

  const openModal = useCallback((email = "") => {
    setPrefillEmail(email);
    setModalOpen(true);
  }, []);

  const applyLabel = applied ? "Applied" : "Apply";

  return (
    <>
      {/* ===================== NAV ===================== */}
      <header className="nav">
        <div className="wrap nav__inner">
          <a className="brand" href="#top">
            <span className="brand__mark" />
            HIGH&nbsp;AGENCY
          </a>
          <nav className="nav__right">
            <div className="nav__links">
              <a href="#problem">Problem</a>
              <a href="#system">What you join</a>
              <a href="#faq">FAQ</a>
              {PLATFORM_ENABLED && <a href="/login">Log in</a>}
            </div>
            <button
              className="btn btn--primary nav__cta"
              onClick={() => openModal()}
            >
              {applyLabel}
            </button>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* ===================== HERO ===================== */}
        <section className="hero">
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <Reveal className="eyebrow hero__tag">
                <span className="dot" />
                Founding Batch 01
              </Reveal>
              <Reveal as="h1" className="display" d={1}>
                School is a <span className="strike">waiting room.</span>
                <br />
                You weren&apos;t built to wait.
              </Reveal>
              <Reveal as="p" className="lead hero__sub" d={2}>
                For operators who&apos;d rather <span className="em">build</span>{" "}
                than study.
              </Reveal>
              <Reveal d={2}>
                <CaptureForm label="Request Access" onApply={openModal} />
              </Reveal>
              <Reveal className="capture__note" d={3}>
                <span><b>By application</b> · Free · Ages 13–19</span>
              </Reveal>
            </div>
          </div>
        </section>

        {/* proof strip, infinite marquee */}
        <div className="strip">
          <Marquee />
        </div>

        {/* ===================== PROBLEM ===================== */}
        <section className="section" id="problem">
          <div className="wrap">
            <div className="shead">
              <Reveal className="eyebrow">
                <span className="dot" />
                The diagnosis
              </Reveal>
              <Reveal as="h2" className="h2" d={1}>
                School optimizes for the wrong thing.
              </Reveal>
              <Reveal as="p" className="lead" d={2}>
                It rewards conformity. The world rewards nerve.
              </Reveal>
            </div>

            <div className="dossier">
              <div className="stat">
                <div className="stat__n">
                  <Counter to={75} />
                  <span className="u">%</span>
                </div>
                <div className="stat__d">feel unprepared for real decisions.</div>
                <span className="stat__tag">01</span>
              </div>
              <div className="stat">
                <div className="stat__n">
                  <Counter to={3} />
                  <span className="u">/4</span>
                </div>
                <div className="stat__d">say school feels meaningless.</div>
                <span className="stat__tag">02</span>
              </div>
              <div className="stat">
                <div className="stat__n">
                  <Counter to={22} />
                  <span className="u">%</span>
                </div>
                <div className="stat__d">feel a real sense of purpose.</div>
                <span className="stat__tag">03</span>
              </div>
              <div className="stat">
                <div className="stat__n">
                  &lt;<Counter to={10} />
                  <span className="u">%</span>
                </div>
                <div className="stat__d">of unis teach any AI literacy.</div>
                <span className="stat__tag">04</span>
              </div>
            </div>

            <Reveal as="p" className="problem__punch" d={2}>
              You already know this.{" "}
              <span className="accent">Stop waiting for permission.</span>
            </Reveal>
          </div>
        </section>

        <div className="divider" />

        {/* ===================== THE SYSTEM / PILLARS ===================== */}
        <section className="section" id="system">
          <div className="wrap">
            <div className="shead">
              <Reveal className="eyebrow eyebrow--accent">
                <span className="dot" />
                What you join
              </Reveal>
              <Reveal as="h2" className="h2" d={1}>
                Not school. A launchpad.
              </Reveal>
            </div>

            <div className="pillars">
              <Reveal as="article" className="pillar" d={1}>
                <div className="pillar__ic">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 2C9 6 7 8 7 13a5 5 0 0 0 10 0c0-2-1-3.5-2-5-.5 1.5-1.5 2-2.5 2 .5-3-.5-6-.5-8Z" />
                  </svg>
                </div>
                <h3 className="h3">Ignition</h3>
                <p>Live workshops + office hours with operators who&apos;ve done it.</p>
              </Reveal>

              <Reveal as="article" className="pillar" d={2}>
                <div className="pillar__ic">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="3.4" />
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                  </svg>
                </div>
                <h3 className="h3">Operational Zone</h3>
                <p>Real milestones, verified by a mentor — never a quiz.</p>
              </Reveal>

              <Reveal as="article" className="pillar" d={3}>
                <div className="pillar__ic">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="8" cy="9" r="3" />
                    <circle cx="16" cy="9" r="3" />
                    <path d="M3 19c0-2.8 2.2-5 5-5M21 19c0-2.8-2.2-5-5-5M9.5 19h5" />
                  </svg>
                </div>
                <h3 className="h3">Unit</h3>
                <p>A founding team of 5–6, building one real thing together.</p>
              </Reveal>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ===================== HOW IT WORKS ===================== */}
        <section className="section">
          <div className="wrap how">
            <div className="how__copy">
              <div className="shead" style={{ marginBottom: 0 }}>
                <Reveal className="eyebrow">
                  <span className="dot" />
                  The loop
                </Reveal>
                <Reveal as="h2" className="h2" d={1}>
                  Ambition in.
                  <br />
                  Momentum out.
                </Reveal>
              </div>
              <Reveal className="steps" d={2}>
                <div className="step">
                  <div className="step__n">01</div>
                  <div>
                    <h3 className="h3">Apply &amp; get matched</h3>
                    <p>Apply, then get placed in a Unit.</p>
                  </div>
                </div>
                <div className="step">
                  <div className="step__n">02</div>
                  <div>
                    <h3 className="h3">Hit real milestones</h3>
                    <p>Verified by a mentor, not a quiz.</p>
                  </div>
                </div>
                <div className="step">
                  <div className="step__n">03</div>
                  <div>
                    <h3 className="h3">Ship something real</h3>
                    <p>Leave with a launched product and first revenue.</p>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* track map */}
            <Reveal className="track" d={2} aria-hidden="true">
              <div className="track__head">
                <span className="track__title">Unit · Skill Track</span>
                <span className="live">
                  <span className="blip" />
                  IN PROGRESS
                </span>
              </div>
              <div className="node done">
                <span className="node__dot">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 12l5 5L19 7" />
                  </svg>
                </span>
                <span className="node__label">Form your Unit</span>
                <span className="node__meta">Verified</span>
              </div>
              <div className="node done">
                <span className="node__dot">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 12l5 5L19 7" />
                  </svg>
                </span>
                <span className="node__label">Define the initiative</span>
                <span className="node__meta">Verified</span>
              </div>
              <div className="node active">
                <span className="node__dot" />
                <span className="node__label">Ship your MVP</span>
                <span className="node__meta">Active</span>
              </div>
              <div className="node locked">
                <span className="node__dot" />
                <span className="node__label">Land your first user</span>
                <span className="node__meta">Locked</span>
              </div>
              <div className="node locked">
                <span className="node__dot" />
                <span className="node__label">First $100 MRR</span>
                <span className="node__meta">Locked</span>
              </div>
            </Reveal>
          </div>
        </section>

        <div className="divider" />

        {/* ===================== MENTOR ===================== */}
        <section className="section">
          <div className="wrap mentor">
            <Reveal className="mentor__photo">
              <img
                className="mentor__img"
                src="/images/joshua_newall.jpg"
                alt="Joshua Newall, Founder and Lead Mentor at High Agency"
              />
              <div className="mentor__badge">
                <div className="nm">Joshua Newall</div>
                <div className="rl">Founder &amp; Lead Mentor · High Agency</div>
              </div>
            </Reveal>
            <div className="mentor__copy">
              <Reveal className="eyebrow">
                <span className="dot" />
                Who you learn from
              </Reveal>
              <Reveal as="h2" className="h2" d={1}>
                Mentors who&apos;ve done it.
              </Reveal>
              <Reveal as="p" className="lead" d={2}>
                Build next to someone who&apos;s already walked the road.
              </Reveal>
              <Reveal className="creds" d={2}>
                <div className="cred">
                  <span className="cred__k">Enterprise</span>
                  <span className="cred__v">Advised Fortune 500s at scale.</span>
                </div>
                <div className="cred">
                  <span className="cred__k">Frontier</span>
                  <span className="cred__v">Worked on space startups.</span>
                </div>
                <div className="cred">
                  <span className="cred__k">Research</span>
                  <span className="cred__v">Published research background.</span>
                </div>
                <div className="cred">
                  <span className="cred__k">Mission</span>
                  <span className="cred__v">Teaches what school can&apos;t.</span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ===================== FAQ ===================== */}
        <section className="section" id="faq">
          <div className="wrap faq-grid">
            <div className="faq-grid__head">
              <Reveal className="eyebrow" style={{ marginBottom: 18 }}>
                <span className="dot" />
                Before you apply
              </Reveal>
              <Reveal as="h2" className="h2" d={1}>
                Questions, answered straight.
              </Reveal>
            </div>
            <Reveal d={1}>
              <Faq />
            </Reveal>
          </div>
        </section>

        {/* ===================== FINAL CTA ===================== */}
        <section className="section final">
          <div className="wrap">
            <div className="final__inner">
              <Reveal className="eyebrow eyebrow--accent">
                <span className="dot" />
                Applications open
              </Reveal>
              <Reveal as="h2" d={1}>
                Ambition is the only prerequisite.
              </Reveal>
              <Reveal as="p" className="lead" d={2}>
                Stop rehearsing. Start building.
              </Reveal>
              <Reveal d={2}>
                <CaptureForm label="Apply Now" onApply={openModal} />
              </Reveal>
              <Reveal className="capture__note" d={3}>
                <span><b>By application</b> · Free</span>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ===================== FOOTER ===================== */}
        <footer className="footer">
          <div className="wrap footer__inner">
            <a className="brand" href="#top">
              <span className="brand__mark" />
              HIGH&nbsp;AGENCY
            </a>
            <div className="footer__links">
              <a href="#problem">Problem</a>
              <a href="#system">What you join</a>
              <a href="#faq">FAQ</a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  openModal();
                }}
              >
                Apply
              </a>
            </div>
            <small>© 2026 High Agency · A launchpad.</small>
          </div>
        </footer>
      </main>

      <ApplyModal
        open={modalOpen}
        prefillEmail={prefillEmail}
        onClose={() => setModalOpen(false)}
        onApplied={() => setApplied(true)}
      />
    </>
  );
}
