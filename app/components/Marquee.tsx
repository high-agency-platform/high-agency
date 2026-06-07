"use client";

const ITEMS = [
  "Stanford", "MIT", "High schools", "Dorm rooms", "Garages",
  "Hackathons", "Discord servers", "Bedrooms",
];

/** Infinite horizontal marquee of origin labels. Track is duplicated so the
 *  CSS translateX(-50%) loop is seamless. */
export default function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {[0, 1].map((dup) => (
          <div className="marquee__group" key={dup}>
            <span className="marquee__label">Operators building from</span>
            {ITEMS.map((item) => (
              <span className="marquee__item" key={item}>
                {item}
                <span className="marquee__sep">/</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
