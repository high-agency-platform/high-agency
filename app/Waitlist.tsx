"use client";

import { useCallback, useEffect, useState } from "react";
import Reveal from "./components/Reveal";
import Counter from "./components/Counter";
import Marquee from "./components/Marquee";
import Faq from "./components/Faq";
import ApplyModal from "./components/ApplyModal";

function CaptureForm({
  label,
  onApply,
  centered = false,
}: {
  label: string;
  onApply: (email: string) => void;
  centered?: boolean;
}) {
  const [email, setEmail] = useState("");
  return (
    <form
      className="capture"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(email.trim());
      }}
      style={centered ? { justifyContent: "center" } : undefined}
    >
      <div className="capture__field">
        <span className="pre mono">↳</span>
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
        {label} <span className="arr">→</span>
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

  const applyLabel = applied ? "Applied ✓" : "Apply";

  // Cursor-follow glow for the pillar cards.
  const onPillarMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

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
              <a href="#problem">The Problem</a>
              <a href="#system">The System</a>
              <a href="#proof">Proof</a>
              <a href="#faq">FAQ</a>
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
                Founding Batch 01 · By application only
              </Reveal>
              <Reveal as="h1" className="display" d={1}>
                School is a <span className="strike">waiting room.</span>
                <br />
                You weren&apos;t built to wait.
              </Reveal>
              <Reveal as="p" className="lead hero__sub" d={2}>
                For young operators who&apos;d rather{" "}
                <span className="serif-em" style={{ color: "var(--bone)" }}>
                  build the thing
                </span>{" "}
                than study it.
              </Reveal>
              <Reveal d={2}>
                <CaptureForm label="Request Access" onApply={openModal} />
              </Reveal>
              <Reveal className="capture__note" d={3}>
                <span>
                  <b>By application</b>, free to join.
                </span>
                <span>Ages 13–19.</span>
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
                The system is optimized for the wrong outcome.
              </Reveal>
              <Reveal as="p" className="lead" d={2}>
                Conventional education rewards conformity and obedience. The
                real world rewards originality, leverage and nerve. The gap
                between them has never been wider, and AI is widening it by the
                week.
              </Reveal>
            </div>

            <div className="dossier">
              <div className="stat">
                <div className="stat__n">
                  <Counter to={75} />
                  <span className="u">%</span>
                </div>
                <div className="stat__d">
                  of graduates feel unprepared to make real career decisions.
                </div>
                <span className="stat__tag">01</span>
              </div>
              <div className="stat">
                <div className="stat__n">
                  <Counter to={3} />
                  <span className="u">/4</span>
                </div>
                <div className="stat__d">
                  of students say school feels meaningless.
                </div>
                <span className="stat__tag">02</span>
              </div>
              <div className="stat">
                <div className="stat__n">
                  <Counter to={22} />
                  <span className="u">%</span>
                </div>
                <div className="stat__d">
                  report a strong sense of purpose in what they do.
                </div>
                <span className="stat__tag">03</span>
              </div>
              <div className="stat">
                <div className="stat__n">
                  &lt;<Counter to={10} />
                  <span className="u">%</span>
                </div>
                <div className="stat__d">
                  of universities have integrated any AI literacy.
                </div>
                <span className="stat__tag">04</span>
              </div>
            </div>

            <Reveal as="p" className="problem__punch" d={2}>
              You already know this.{" "}
              <span className="serif-em ig">
                The question is whether you&apos;ll keep waiting for permission
              </span>{" "}
              or go build.
            </Reveal>
          </div>
        </section>

        <div className="divider" />

        {/* ===================== THE SYSTEM / PILLARS ===================== */}
        <section className="section" id="system">
          <div className="wrap">
            <div className="shead">
              <Reveal className="eyebrow eyebrow--ignite">
                <span className="dot" />
                What you join
              </Reveal>
              <Reveal as="h2" className="h2" d={1}>
                Not school. Not tutoring.
                <br />A launchpad.
              </Reveal>
              <Reveal as="p" className="lead" d={2}>
                Three systems, working together to convert raw ambition into
                shipped reality.
              </Reveal>
            </div>

            <div className="pillars">
              <Reveal as="article" className="pillar" d={1} onMouseMove={onPillarMove}>
                <div className="pillar__glow" />
                <div className="pillar__no">SYSTEM 01</div>
                <div className="pillar__ic">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 2C9 6 7 8 7 13a5 5 0 0 0 10 0c0-2-1-3.5-2-5-.5 1.5-1.5 2-2.5 2 .5-3-.5-6-.5-8Z" />
                  </svg>
                </div>
                <h3 className="h3">Ignition</h3>
                <p>
                  Live, expert-led workshops and mentor office hours that get
                  you moving, and keep you moving. Learn directly from people
                  who&apos;ve actually done the thing, not lectured about it.
                </p>
                <span className="pillar__tag">
                  Mentorship layer · <b>Premium, later</b>
                </span>
              </Reveal>

              <Reveal as="article" className="pillar" d={2} onMouseMove={onPillarMove}>
                <div className="pillar__glow" />
                <div className="pillar__no">SYSTEM 02</div>
                <div className="pillar__ic">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="3.4" />
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                  </svg>
                </div>
                <h3 className="h3">Operational Zone</h3>
                <p>
                  A shared skill track of real-world milestones, ship an MVP,
                  land your first user, hit your first $100 MRR. Progress is
                  earned by doing real things and verified by a mentor, never by
                  a quiz.
                </p>
                <span className="pillar__tag">
                  The skill track · <b>Free</b>
                </span>
              </Reveal>

              <Reveal as="article" className="pillar" d={3} onMouseMove={onPillarMove}>
                <div className="pillar__glow" />
                <div className="pillar__no">SYSTEM 03</div>
                <div className="pillar__ic">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="8" cy="9" r="3" />
                    <circle cx="16" cy="9" r="3" />
                    <path d="M3 19c0-2.8 2.2-5 5-5M21 19c0-2.8-2.2-5-5-5M9.5 19h5" />
                  </svg>
                </div>
                <h3 className="h3">Unit</h3>
                <p>
                  Your tribe, a tight founding team of 5–6 operators building a
                  real initiative alongside you. Streaks and accountability keep
                  the whole Unit moving between sessions. You don&apos;t do this
                  alone.
                </p>
                <span className="pillar__tag">
                  Your cohort · <b>Free</b>
                </span>
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
                    <p>
                      Submit your profile. If you&apos;re a fit, you&apos;re
                      placed into a Unit of operators on the same trajectory -
                      or you found your own.
                    </p>
                  </div>
                </div>
                <div className="step">
                  <div className="step__n">02</div>
                  <div>
                    <h3 className="h3">Progress real milestones</h3>
                    <p>
                      Your Unit moves through a shared track of practical
                      milestones in the real world. A mentor verifies each one -
                      once, for the whole team.
                    </p>
                  </div>
                </div>
                <div className="step">
                  <div className="step__n">03</div>
                  <div>
                    <h3 className="h3">Ship something real</h3>
                    <p>
                      Build streaks. Bank wins. Walk away with a launched
                      product, first revenue, and a network of people who get
                      it.
                    </p>
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
                Mentors who&apos;ve actually done it.
              </Reveal>
              <Reveal as="p" className="lead" d={2}>
                The fastest way to compress a decade into a season is to build
                next to someone who&apos;s already walked the road. High Agency
                is led by operators with real range, and real receipts.
              </Reveal>
              <Reveal className="creds" d={2}>
                <div className="cred">
                  <span className="cred__k">Enterprise</span>
                  <span className="cred__v">
                    Guides Fortune 500 companies through tax &amp; compliance at
                    scale.
                  </span>
                </div>
                <div className="cred">
                  <span className="cred__k">Frontier</span>
                  <span className="cred__v">
                    Worked on space startups pushing real technical limits.
                  </span>
                </div>
                <div className="cred">
                  <span className="cred__k">Research</span>
                  <span className="cred__v">
                    Published research background, rigor, not just hustle.
                  </span>
                </div>
                <div className="cred">
                  <span className="cred__k">Mission</span>
                  <span className="cred__v">
                    Teaches young operators what school structurally can&apos;t.
                  </span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ===================== PROOF ===================== */}
        <section className="section" id="proof">
          <div className="wrap">
            <div className="shead">
              <Reveal className="eyebrow eyebrow--ignite">
                <span className="dot" />
                Already in motion
              </Reveal>
              <Reveal as="h2" className="h2" d={1}>
                Real Units. Real output.
              </Reveal>
              <Reveal as="p" className="lead" d={2}>
                We&apos;re early, and that&apos;s the point. The founding batch
                writes the origin story. Here&apos;s what&apos;s already on the
                board.
              </Reveal>
            </div>

            <div className="proof proof--bento">
              <Reveal as="article" className="cohort cohort--feature" d={1}>
                <div className="cohort__img">
                  <span className="cohort__badge">Shipped</span>
                </div>
                <div className="cohort__body">
                  <h3>Canary OS</h3>
                  <p>
                    A six-person high-school Unit built an ML scam-detection
                    model, a real, working product, not a class project.
                  </p>
                  <div className="cohort__foot">
                    <span>High-school Unit</span>
                    <span>6 operators</span>
                  </div>
                </div>
              </Reveal>
              <Reveal as="article" className="cohort" d={2}>
                <div className="cohort__img">
                  <span className="cohort__badge">Forming</span>
                </div>
                <div className="cohort__body">
                  <h3>The Frontier Units</h3>
                  <p>
                    Units forming with students from Stanford and MIT -
                    operators already optimizing for leverage over grades.
                  </p>
                  <div className="cohort__foot">
                    <span>Stanford · MIT</span>
                    <span>Recruiting</span>
                  </div>
                </div>
              </Reveal>
              <Reveal as="article" className="cohort" d={3}>
                <div className="cohort__img">
                  <span className="cohort__badge">Open</span>
                </div>
                <div className="cohort__body">
                  <h3>Your Unit</h3>
                  <p>
                    The next seat is unclaimed. Apply to join a forming Unit -
                    or found your own and recruit your team.
                  </p>
                  <div className="cohort__foot">
                    <span>Founding batch 01</span>
                    <span>By application</span>
                  </div>
                </div>
              </Reveal>
            </div>

            <Reveal className="honest">
              <p>
                <span className="serif-em">
                  &quot;We&apos;re not selling a finished thing.
                </span>{" "}
                We&apos;re inviting you to build the thing, and the proof, with
                us. Early is the advantage.&quot;
              </p>
              <button className="btn btn--ghost" onClick={() => openModal()}>
                Claim a seat <span className="arr">→</span>
              </button>
            </Reveal>
          </div>
        </section>

        {/* ===================== COMPETITION TEASER ===================== */}
        <section className="section">
          <div className="wrap">
            <Reveal className="compete">
              <span className="compete__roadmap">On the roadmap</span>
              <div
                className="eyebrow eyebrow--ignite"
                style={{ marginBottom: 20 }}
              >
                <span className="dot" />
                What&apos;s coming
              </div>
              <h2 className="h2">Unit vs. Unit.</h2>
              <p className="lead">
                Soon, cohorts compete on what actually matters, shipped
                outcomes, revenue, real traction. Live leaderboards. Demo days.
                Winning Units earn the rooms most people never get into.
              </p>
              <div className="board">
                <div className="board__row lead-row">
                  <span className="board__rank">01</span>
                  <span className="board__team">Canary OS</span>
                  <span className="board__score">▲ 1,240 pts</span>
                </div>
                <div className="board__row">
                  <span className="board__rank">02</span>
                  <span className="board__team board__blur">████ Unit</span>
                  <span className="board__score board__blur">▲ 1,090</span>
                </div>
                <div className="board__row">
                  <span className="board__rank">03</span>
                  <span className="board__team board__blur">█████ Unit</span>
                  <span className="board__score board__blur">▲ 980</span>
                </div>
                <div className="board__row">
                  <span className="board__rank">04</span>
                  <span className="board__team board__blur">███ Unit</span>
                  <span className="board__score board__blur">▲ 875</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <div className="divider" />

        {/* ===================== FAQ ===================== */}
        <section className="section" id="faq">
          <div className="wrap">
            <div
              className="shead"
              style={{ textAlign: "center", marginLeft: "auto", marginRight: "auto" }}
            >
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
          <div className="final__glow" />
          <div className="wrap">
            <Reveal
              className="eyebrow eyebrow--ignite"
              style={{ justifyContent: "center" }}
            >
              <span className="dot" />
              Founding Batch 01 · Applications open
            </Reveal>
            <Reveal as="h2" d={1}>
              Ambition is the
              <br />
              only prerequisite.
            </Reveal>
            <Reveal as="p" className="lead" d={2}>
              Stop rehearsing for a life that isn&apos;t coming. Apply to the
              founding batch and turn what you&apos;ve got into momentum -
              alongside people who move at your speed.
            </Reveal>
            <Reveal d={2}>
              <CaptureForm label="Apply Now" onApply={openModal} centered />
            </Reveal>
            <Reveal
              className="capture__note"
              d={3}
              style={{ justifyContent: "center" }}
            >
              <span>
                <b>By application.</b> We read every one.
              </span>
              <span>
                <b>Free to join.</b>
              </span>
            </Reveal>
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
              <a href="#system">System</a>
              <a href="#proof">Proof</a>
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
            <small>
              © 2026 High Agency · Not school. Not tutoring. A launchpad.
            </small>
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
