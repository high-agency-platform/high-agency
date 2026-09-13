"use client";

import { useState } from "react";
import type { Profile } from "../lib/types";
import { postBuildLog } from "../lib/api";
import { localDay } from "../lib/streaks";
import { CheckIcon } from "./ui";

export function ShipLine({ profile, consentPending }: { profile: Profile; consentPending: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const today = localDay();
  const loggedToday = profile.lastBuildLogDay === today;

  async function post() {
    if (!text.trim() || busy || consentPending) return;
    setBusy(true);
    setError("");
    try {
      await postBuildLog(text.trim());
      setText("");
    } catch {
      setError("Couldn't post. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="ship-line" onSubmit={(e) => { e.preventDefault(); void post(); }}>
      <div className="composer">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Your community update"
          placeholder={loggedToday ? "Share another update…" : "Share an update…"}
          maxLength={300}
          disabled={consentPending}
        />
        <button type="submit" className="btn btn--ghost" disabled={busy || !text.trim() || consentPending}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
      {loggedToday && <p className="ship-line__success"><CheckIcon size={14} /> Updated today</p>}
      {error && <p className="form-err" role="alert">{error}</p>}
    </form>
  );
}
