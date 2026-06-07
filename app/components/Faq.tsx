"use client";

import { useRef, useState } from "react";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "Who is this actually for?",
    a: "Ambitious people roughly 13–19 who'd rather build than wait. You don't need to be technical, rich, or “qualified.” You need genuine drive and a willingness to do real things in the real world. If you've ever felt school was too slow for you, you're who we're looking for.",
  },
  {
    q: "Is it free?",
    a: "The founding batch is completely free, cohorts, the skill track, community, and gamification stay free to maximize who can join. Down the line, the live mentorship layer (expert workshops + office hours) becomes a premium add-on. Everything that builds your tribe and momentum stays free.",
  },
  {
    q: "How selective is it?",
    a: "It's by application, and the founding batch is intentionally small. We read every application and care far more about trajectory and drive than your résumé. This isn't a course you buy your way into, it's a Unit you earn your way into.",
  },
  {
    q: "Do I need a startup idea already?",
    a: "No. Plenty of operators arrive with raw ambition and no idea yet. Your Unit and the skill track help you find the thing worth building, then actually build it. Showing up with momentum matters more than showing up with a pitch deck.",
  },
  {
    q: "What's the time commitment?",
    a: "Enough to build real momentum, think a live cadence of workshops plus the work your Unit does between sessions. Streaks and accountability are designed to keep you consistent without taking over your life. You get out what you put in.",
  },
  {
    q: "I'm under 18. What about my parents?",
    a: "If you're under 18, a parent or guardian gives consent before you get full access, it's a quick, required step we take seriously for safety and compliance. They don't run the experience; you do. We'll guide you both through it after you're accepted.",
  },
];

function QaItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const ansRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`qa${open ? " open" : ""}`}>
      <button
        className="qa__q"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {q}
        <span className="qa__plus" />
      </button>
      <div
        ref={ansRef}
        className="qa__a"
        style={{ maxHeight: open ? ansRef.current?.scrollHeight : 0 }}
      >
        <p>{a}</p>
      </div>
    </div>
  );
}

export default function Faq() {
  return (
    <div className="faq">
      {ITEMS.map((item) => (
        <QaItem key={item.q} {...item} />
      ))}
    </div>
  );
}
