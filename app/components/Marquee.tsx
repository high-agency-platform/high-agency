const ITEMS = [
  "Stanford", "MIT", "High schools", "Dorm rooms",
  "Garages", "Hackathons", "Bedrooms",
];

/** Static, flat proof strip of where operators build from.
 *  No animation — see /design-system.md (no ambient motion). */
export default function Marquee() {
  return (
    <div className="wrap strip__inner">
      <span className="strip__label">Operators building from</span>
      {ITEMS.map((item, i) => (
        <span className="strip__item" key={item}>
          {item}
          {i < ITEMS.length - 1 && <span className="strip__sep"> · </span>}
        </span>
      ))}
    </div>
  );
}
