"use client";

/* Google Calendar for mentors: one card that says whether this mentor's
   calendar is connected, and the button that connects or disconnects it.
   Sessions get their Meet room from here. */

import { useEffect, useState, useSyncExternalStore } from "react";
import { calendarStatus, connectCalendar, disconnectCalendar, syncCalendar, type CalendarStatus } from "../lib/api";
import { CheckIcon } from "./ui";

/** Fetched once per mount. `null` while loading. */
export function useCalendarStatus(): {
  status: CalendarStatus | null;
  refresh: () => void;
  error: string;
} {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let stale = false;
    calendarStatus()
      .then((s) => !stale && setStatus(s))
      .catch(() => !stale && setError("Couldn't check the calendar connection."));
    return () => {
      stale = true;
    };
  }, [tick]);
  return { status, error, refresh: () => { setStatus(null); setError(""); setTick((t) => t + 1); } };
}

/** The `?calendar=` value this page load came back from Google with. Latched
 *  at module scope on first read so it survives the history rewrite below —
 *  the URL is cleared, but the message it produced stays on screen until the
 *  next real navigation. Also keeps the snapshot stable, which
 *  useSyncExternalStore requires. */
let landedWith: string | null = null;

function readLanded(): string {
  if (landedWith === null) {
    landedWith = new URL(window.location.href).searchParams.get("calendar") ?? "";
  }
  return landedWith;
}

/** What the browser came back with after the OAuth round trip, read from the
 *  URL once and then cleared so a reload doesn't repeat the message. Read
 *  through useSyncExternalStore rather than an effect: the URL is an external
 *  store, and the server snapshot ("") keeps hydration honest. */
function useReturnFlash(): string {
  const landed = useSyncExternalStore(
    () => () => {}, // fixed for the life of the page load
    readLanded,
    () => ""
  );

  useEffect(() => {
    if (!landed) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("calendar");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [landed]);

  return landed === "connected"
    ? "Google Calendar connected."
    : landed === "denied"
      ? "No access was granted — nothing changed."
      : landed === "sync-error"
        ? "Connected. Session sync needs a retry."
      : landed
        ? "Couldn't connect. Try again."
        : "";
}

export function CalendarConnect({
  returnTo,
  compact = false,
}: {
  /** App path to land on after Google. */
  returnTo: string;
  /** One line + button, for the home screen. */
  compact?: boolean;
}) {
  const { status, refresh, error: statusError } = useCalendarStatus();
  const flash = useReturnFlash();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function connect() {
    setBusy(true);
    setErr("");
    try {
      await connectCalendar(returnTo);
    } catch {
      setErr("Couldn't start the connection. Try again.");
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Calendar? Future synced session copies will be removed; hosted events stay on your calendar.")) return;
    setBusy(true);
    setErr("");
    try {
      await disconnectCalendar();
      refresh();
    } catch (error) {
      setErr(error instanceof Error && error.message === "invitation-sync-incomplete" ? "Disconnected. Session invitations need a retry." : "Couldn't disconnect. Try again.");
    } finally {
      refresh();
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setErr("");
    try { await syncCalendar(); refresh(); }
    catch { setErr("Session sync is incomplete. Please retry."); }
    finally { setBusy(false); }
  }

  if (statusError) return <div className="notice"><span role="alert">{statusError}</span><button className="btn btn--ghost btn--sm" onClick={refresh}>Retry</button></div>;
  if (status === null) return <span className="meta muted">Checking calendar…</span>;
  const unavailable = !status.configured;
  const hint = status.connected ? "Your enrolled sessions sync automatically. Click to sync again." : "Add your enrolled sessions to Google Calendar automatically.";

  return (
    <div className={compact ? "calendar-connect-inline" : "tile calendar-connect"}>
      <button className="btn btn--ghost btn--sm" onClick={status.connected || status.syncError ? sync : connect} disabled={busy || unavailable} title={hint}>
        {/* Official Google Calendar product artwork. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/google-calendar.webp" width={19} height={19} alt="" />
        {busy ? "Working…" : status.syncError ? "Retry calendar sync" : status.connected ? "Google Calendar" : "Connect Google Calendar"}
        {status.connected && !status.syncError && <CheckIcon size={14} />}
      </button>
      {!compact && status.connected && <button className="btn btn--ghost btn--sm" onClick={disconnect} disabled={busy}>Disconnect</button>}
      {flash && <span className="meta" role="status">{flash}</span>}
      {(err || status.syncError) && <span className="form-err" role="alert">{err || "Some sessions need another sync."}</span>}
    </div>
  );
}
