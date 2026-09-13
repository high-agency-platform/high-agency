"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function AnimatedScene({ children, className }: { children: ReactNode; className: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let visible = false;
    const sync = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return <div ref={host} className={`animated-scene ${className}${active ? " is-playing" : ""}`}>{children}</div>;
}
