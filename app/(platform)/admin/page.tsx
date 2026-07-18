"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import {
  watchAllWorkshops,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  watchPendingConsent,
  grantConsent,
  requestConsentEmail,
  type WorkshopInput,
} from "../../lib/db";
import { TRACK } from "../../lib/milestones";
import { LEVELS } from "../../lib/gamify";
import type { Workshop, Profile } from "../../lib/types";

/* datetime-local <-> Date, both in the browser's local timezone. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

type Draft = {
  title: string;
  mentorName: string;
  description: string;
  kind: "workshop" | "office_hours";
  startsAt: string; // datetime-local string
  durationMins: number;
  meetLink: string;
  open: boolean;
  levelGate: number;
  milestoneId: number;
  recordingUrl: string;
};

function blankDraft(mentorName: string): Draft {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(18, 0, 0, 0);
  return {
    title: "",
    mentorName,
    description: "",
    kind: "workshop",
    startsAt: toLocalInput(d),
    durationMins: 60,
    meetLink: "",
    open: false,
    levelGate: 0,
    milestoneId: 0,
    recordingUrl: "",
  };
}

function draftFrom(w: Workshop): Draft {
  return {
    title: w.title,
    mentorName: w.mentorName,
    description: w.description ?? "",
    kind: w.kind,
    startsAt: toLocalInput(w.startsAt.toDate()),
    durationMins: w.durationMins,
    meetLink: w.meetLink ?? "",
    open: w.open,
    levelGate: w.levelGate,
    milestoneId: w.milestoneId,
    recordingUrl: w.recordingUrl ?? "",
  };
}

function draftToInput(d: Draft): WorkshopInput {
  return {
    title: d.title.trim(),
    mentorName: d.mentorName.trim(),
    description: d.description.trim(),
    kind: d.kind,
    startsAt: new Date(d.startsAt),
    durationMins: d.durationMins,
    meetLink: d.meetLink.trim(),
    open: d.open,
    levelGate: d.levelGate,
    milestoneId: d.milestoneId,
    recordingUrl: d.recordingUrl.trim(),
  };
}

function fmtWhen(w: Workshop): string {
  const d = w.startsAt.toDate();
  return (
    d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

/** Compact "when the consent email went out" label for the queue. */
function fmtSent(ts: { toDate: () => Date }): string {
  const d = ts.toDate();
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

function WorkshopForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  busy,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft({ ...draft, [k]: v });

  return (
    <div className="tile screen__block">
      <div className="field">
        <label>Title</label>
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="The Art of the Cold Ask"
          maxLength={120}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Mentor</label>
          <input
            value={draft.mentorName}
            onChange={(e) => set("mentorName", e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="field">
          <label>Kind</label>
          <div className="chip-row">
            {(["workshop", "office_hours"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`pick ${draft.kind === k ? "sel" : ""}`}
                onClick={() => set("kind", k)}
              >
                {k === "workshop" ? "Workshop" : "Office hours"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field">
        <label>Description</label>
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What operators walk away with."
          maxLength={1000}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Starts</label>
          <input
            type="datetime-local"
            value={draft.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Minutes</label>
          <input
            type="number"
            min={1}
            max={600}
            value={draft.durationMins}
            onChange={(e) => set("durationMins", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field">
        <label>Meet link</label>
        <input
          value={draft.meetLink}
          onChange={(e) => set("meetLink", e.target.value)}
          placeholder="https://meet.google.com/…"
          maxLength={500}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Milestone</label>
          <select
            value={draft.milestoneId}
            onChange={(e) => set("milestoneId", Number(e.target.value))}
          >
            <option value={0}>None</option>
            {TRACK.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}. {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Level gate</label>
          <select
            value={draft.levelGate}
            onChange={(e) => set("levelGate", Number(e.target.value))}
          >
            <option value={0}>No gate</option>
            {LEVELS.filter((l) => l.level > 1).map((l) => (
              <option key={l.level} value={l.level}>
                L{l.level} {l.name}+
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Recording URL</label>
        <input
          value={draft.recordingUrl}
          onChange={(e) => set("recordingUrl", e.target.value)}
          placeholder="Posted after the session"
          maxLength={500}
        />
      </div>

      <label className="admin-check">
        <input
          type="checkbox"
          checked={draft.open}
          onChange={(e) => set("open", e.target.checked)}
        />
        <span>Open to all — the season&apos;s free session</span>
      </label>

      <div className="row-actions">
        <button className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn--primary"
          onClick={onSave}
          disabled={busy || !draft.title.trim() || !draft.mentorName.trim()}
        >
          {busy ? "…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<"workshops" | "members">("workshops");
  const [workshops, setWorkshops] = useState<Workshop[] | null>(null);
  const [pending, setPending] = useState<Profile[] | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null); // null=none, ""=new
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  // Per-operator resend feedback in the consent queue, keyed by uid.
  const [resendState, setResendState] = useState<Record<string, string>>({});
  // Captured once on mount — used to tag past sessions without an impure
  // Date.now() call during render.
  const [now] = useState(() => Date.now());

  const isMentor = profile?.role === "mentor";

  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (user && profile === null) router.replace("/onboarding");
  }, [user, profile, router]);

  useEffect(() => {
    if (!isMentor) return;
    const u1 = watchAllWorkshops(setWorkshops);
    const u2 = watchPendingConsent(setPending);
    return () => {
      u1();
      u2();
    };
  }, [isMentor]);

  const sortedPending = useMemo(
    () =>
      [...(pending ?? [])].sort((a, b) =>
        (a.country + a.name).localeCompare(b.country + b.name)
      ),
    [pending]
  );

  if (!user || !profile) return null;

  if (!isMentor) {
    return (
      <div className="screen">
        <header className="screen__head">
          <h1 className="h1">Mentors only</h1>
        </header>
        <p className="empty">Ask the crew for the mentor role if you should be here.</p>
      </div>
    );
  }

  function startNew() {
    setDraft(blankDraft(profile?.name ?? ""));
    setEditingId("");
  }

  function startEdit(w: Workshop) {
    setDraft(draftFrom(w));
    setEditingId(w.id);
  }

  function cancel() {
    setEditingId(null);
    setDraft(null);
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const input = draftToInput(draft);
      if (editingId) await updateWorkshop(editingId, input);
      else await createWorkshop(input);
      cancel();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this workshop? This can't be undone.")) return;
    await deleteWorkshop(id).catch(() => {});
  }

  async function resendConsent(uid: string) {
    setResendState((s) => ({ ...s, [uid]: "Sending…" }));
    try {
      const res = await requestConsentEmail(uid);
      setResendState((s) => ({
        ...s,
        [uid]: res.ok
          ? res.delivery === "logged"
            ? "Link logged to server (no email provider set)"
            : "Email sent"
          : res.error === "no-parent-email"
            ? "No parent email on file"
            : "Couldn't send — try again",
      }));
    } catch {
      setResendState((s) => ({ ...s, [uid]: "Couldn't send — try again" }));
    }
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="h1">Admin</h1>
        <span className="micro">{profile.name}</span>
      </header>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === "workshops" ? "admin-tab--on" : ""}`}
          onClick={() => setTab("workshops")}
        >
          Workshops {workshops && `(${workshops.length})`}
        </button>
        <button
          className={`admin-tab ${tab === "members" ? "admin-tab--on" : ""}`}
          onClick={() => setTab("members")}
        >
          Consent {pending && pending.length > 0 && `(${pending.length})`}
        </button>
      </div>

      {tab === "workshops" && (
        <section className="screen__block">
          <div className="screen__label">
            <span className="micro">Catalog</span>
            {editingId === null && (
              <button className="btn btn--primary btn--sm" onClick={startNew}>
                New
              </button>
            )}
          </div>

          {editingId === "" && draft && (
            <WorkshopForm
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={cancel}
              busy={busy}
            />
          )}

          {workshops === null ? (
            <p className="empty">Loading…</p>
          ) : workshops.length === 0 ? (
            <p className="empty">No workshops yet.</p>
          ) : (
            <div className="admin-list">
              {workshops.map((w) =>
                editingId === w.id && draft ? (
                  <WorkshopForm
                    key={w.id}
                    draft={draft}
                    setDraft={setDraft}
                    onSave={save}
                    onCancel={cancel}
                    busy={busy}
                  />
                ) : (
                  <div key={w.id} className="tile tile--flat admin-row">
                    <div className="admin-row__body">
                      <div className="admin-row__title">
                        <b>{w.title}</b>
                        {w.startsAt.toDate().getTime() < now && (
                          <span className="chip chip--mute">past</span>
                        )}
                        {w.open && <span className="chip chip--why">open</span>}
                        {w.levelGate > 0 && (
                          <span className="chip chip--on">L{w.levelGate}+</span>
                        )}
                        {w.recordingUrl && <span className="chip">rec</span>}
                      </div>
                      <span className="admin-row__meta">
                        {fmtWhen(w)} · {w.durationMins}m ·{" "}
                        {w.kind === "office_hours" ? "Office hours" : "Workshop"} ·{" "}
                        {w.mentorName}
                        {w.milestoneId > 0 && ` · M${w.milestoneId}`}
                      </span>
                    </div>
                    <div className="row-actions" style={{ marginTop: 0 }}>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => startEdit(w)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => remove(w.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      )}

      {tab === "members" && (
        <section className="screen__block">
          <div className="screen__label">
            <span className="micro">Awaiting parental consent</span>
          </div>
          {pending === null ? (
            <p className="empty">Loading…</p>
          ) : sortedPending.length === 0 ? (
            <p className="empty">Queue clear.</p>
          ) : (
            <div className="admin-list">
              {sortedPending.map((p) => (
                <div key={p.uid} className="tile tile--flat admin-row">
                  <div className="admin-row__body">
                    <div className="admin-row__title">
                      <b>{p.name}</b>
                      <span className="chip">{p.ageBand}</span>
                    </div>
                    <span className="admin-row__meta">
                      {p.country} · {p.headline || p.building}
                    </span>
                    <span className="admin-row__meta">
                      {resendState[p.uid]
                        ? resendState[p.uid]
                        : p.consentEmailSentAt
                          ? `Email sent ${fmtSent(p.consentEmailSentAt)}`
                          : "No consent email sent yet"}
                    </span>
                  </div>
                  <div className="row-actions" style={{ marginTop: 0 }}>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => resendConsent(p.uid)}
                    >
                      Resend
                    </button>
                    <button
                      className="btn btn--verify btn--sm"
                      onClick={() => grantConsent(p.uid).catch(() => {})}
                    >
                      Grant
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
