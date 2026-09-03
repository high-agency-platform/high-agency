"use client";

/* The daily move. Streak flame + the one-line composer, in one tile: ember
   while today is unshipped, lime once a line has gone out. The server writes
   the log and the streak together; the live profile listener flips the tile. */

import { useState } from "react";
import type { Profile } from "../lib/types";
import { postBuildLog } from "../lib/api";
import { localDay } from "../lib/streaks";
import { CheckIcon, FlameIcon } from "./ui";

export function ShipLine({ profile, consentPending }: { profile: Profile; consentPending: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const today = localDay();
  const loggedToday = profile.lastBuildLogDay === today;
  const alive = profile.lastActiveDay === today;

  async function post() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await postBuildLog(text.trim());
      setText("");
    } catch {
      /* the composer keeps the text so they can retry */
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`tile ${loggedToday ? "tile--lime" : "tile--ember"}`}>
      <div className="tile__head">
        <h2 className="h3">
          {loggedToday ? (
            <>
              <span className="signal"><CheckIcon /></span> Shipped today
            </>
          ) : (
            <>
              <span className="flame"><FlameIcon /></span> Ship one line
            </>
          )}
        </h2>
        <span
          className={`hud__stat ${alive ? "hud__stat--fire" : ""}`}
          title={alive ? `${profile.streak}-day streak — counted today` : "Ship something today to keep it"}
        >
          <FlameIcon size={14} /> {profile.streak}
          {profile.streakFreezes > 0 && (
            <span className="micro" title="Freezes banked — each covers one missed day">
              · ❄ {profile.streakFreezes}
            </span>
          )}
        </span>
      </div>
      <div className="composer">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && post()}
          placeholder={loggedToday ? "Shipped more? Log it." : "What did you build today?"}
          maxLength={300}
          disabled={consentPending}
        />
        <button className="btn btn--primary" disabled={busy || !text.trim() || consentPending} onClick={post}>
          {busy ? "…" : "Ship"}
        </button>
      </div>
      {!loggedToday && <span className="micro" style={{ display: "block", marginTop: 8 }}>keeps the streak · so does proof</span>}
    </section>
  );
}
