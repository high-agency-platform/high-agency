"use client";

import { useRef, useState } from "react";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "Who is this for?",
    a: "Ambitious 13–19 year-olds who'd rather build than wait. No technical background needed — just drive.",
  },
  {
    q: "Is it free?",
    a: "The founding batch is free. Live mentorship becomes a premium add-on later.",
  },
  {
    q: "How selective is it?",
    a: "By application, intentionally small. We weigh drive over résumé.",
  },
  {
    q: "Do I need a startup idea?",
    a: "No. Your Unit helps you find the thing worth building.",
  },
  {
    q: "What's the time commitment?",
    a: "Enough to build momentum. You get out what you put in.",
  },
  {
    q: "I'm under 18. What about my parents?",
    a: "A guardian gives consent before full access. They don't run it — you do.",
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
