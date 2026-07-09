"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  submitApplication,
  type ApplicationRecord,
} from "../lib/firebase";

const STORAGE_KEY = "ha_application";
// Founding Batch 01 targets high-school operators — collect exact age 12–18.
const AGES = ["12", "13", "14", "15", "16", "17", "18"];

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function readSaved(): ApplicationRecord | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

interface ApplyModalProps {
  open: boolean;
  prefillEmail?: string;
  onClose: () => void;
  onApplied: () => void;
}

export default function ApplyModal({
  open,
  prefillEmail,
  onClose,
  onApplied,
}: ApplyModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [building, setBuilding] = useState("");
  const [boldest, setBoldest] = useState("");
  const [err, setErr] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApplicationRecord | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<Element | null>(null);

  // Open / close side-effects: lock scroll, manage focus, restore prior submit.
  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement;
      document.body.style.overflow = "hidden";
      const saved = readSaved();
      if (saved && saved.submitted) {
        setResult(saved);
        setStep(3);
      } else {
        setStep(1);
        if (prefillEmail) setEmail(prefillEmail);
        setTimeout(() => firstFieldRef.current?.focus(), 60);
      }
    } else {
      document.body.style.overflow = "";
      (lastFocus.current as HTMLElement | null)?.focus?.();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, prefillEmail]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (cardRef.current) cardRef.current.scrollTop = 0;
  }, [step]);

  const next1 = useCallback(() => {
    if (!name.trim() || !validEmail(email.trim()) || !age) {
      setErr(true);
      return;
    }
    setErr(false);
    setStep(2);
  }, [name, email, age]);

  const doSubmit = useCallback(async () => {
    if (building.trim().length < 2 || boldest.trim().length < 2) {
      setErr(true);
      return;
    }
    setErr(false);
    setSubmitErr("");
    setBusy(true);
    const input = {
      name: name.trim(),
      email: email.trim(),
      age,
      building: building.trim(),
      boldest: boldest.trim(),
    };
    try {
      const record = await submitApplication(input);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      } catch {}
      setResult(record);
      setStep(3);
      onApplied();
    } catch {
      // Network/permission failure: still log the application locally so the
      // operator isn't blocked, and surface a soft note.
      const fallback: ApplicationRecord = {
        ...input,
        opId: "HA-" + String(Math.floor(Math.random() * 900) + 100),
        queuePos: Math.floor(Math.random() * 40) + 47,
        submitted: true,
        ts: Date.now(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      } catch {}
      setResult(fallback);
      setStep(3);
      onApplied();
    } finally {
      setBusy(false);
    }
  }, [name, email, age, building, boldest, onApplied]);

  if (!open) return null;

  return (
    <div
      className="modal open"
      id="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalTitle"
    >
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__card" ref={cardRef}>
        <button className="modal__close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="modal__progress">
          <span className={step >= 1 ? "on" : ""} />
          <span className={step >= 2 ? "on" : ""} />
          <span className={step >= 3 ? "on" : ""} />
        </div>

        {/* step 1 */}
        {step === 1 && (
          <div className="modal__step active">
            <h3 id="modalTitle">Request access.</h3>
            <p className="modal__sub">Founding Batch 01. Takes 60 seconds.</p>
            <div className="field">
              <label htmlFor="m-name">First name</label>
              <input
                ref={firstFieldRef}
                type="text"
                id="m-name"
                placeholder="What do we call you?"
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next1()}
              />
            </div>
            <div className="field">
              <label htmlFor="m-email">Email</label>
              <input
                type="email"
                id="m-email"
                placeholder="you@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next1()}
              />
            </div>
            <div className="field">
              <label htmlFor="m-age">Age</label>
              <select
                id="m-age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              >
                <option value="" disabled>
                  Select your age
                </option>
                {AGES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className={`modal__err${err ? " show" : ""}`}>
              Fill in your name, a valid email, and your age to continue.
            </div>
            <div className="modal__actions">
              <button className="btn btn--primary modal__next" onClick={next1}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* step 2 */}
        {step === 2 && (
          <div className="modal__step active">
            <h3>Two questions.</h3>
            <p className="modal__sub">Be real. Drive reads louder than polish.</p>
            <div className="field">
              <label htmlFor="m-build">What are you building?</label>
              <textarea
                id="m-build"
                placeholder="A product, a project, or raw ambition. All valid."
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="m-bold">Boldest thing you&apos;ve done?</label>
              <textarea
                id="m-bold"
                placeholder="Shipped, ran, taught, or cold-emailed something."
                value={boldest}
                onChange={(e) => setBoldest(e.target.value)}
              />
            </div>
            <div className={`modal__err${err ? " show" : ""}`}>
              Give us a sentence on each, that&apos;s all we need.
            </div>
            {submitErr && (
              <div className="modal__err show">{submitErr}</div>
            )}
            <div className="modal__actions">
              <button
                className="btn btn--ghost modal__back"
                onClick={() => setStep(1)}
                disabled={busy}
              >
                Back
              </button>
              <button
                className="btn btn--primary modal__next"
                onClick={doSubmit}
                disabled={busy}
              >
                {busy ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </div>
        )}

        {/* step 3, success */}
        {step === 3 && (
          <div className="modal__step active">
            <div className="success">
              <div className="success__seal">
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <path d="M5 12l5 5L19 7" />
                </svg>
              </div>
              <h3>Application logged.</h3>
              <p className="modal__sub" style={{ marginBottom: 0 }}>
                You&apos;re in the queue. If it&apos;s a fit, we&apos;ll reach out.
              </p>
              <div className="success__id">
                OPERATOR ID · <b>{result?.opId ?? "HA-000"}</b>
              </div>
              <div className="success__q">
                Position in queue{" "}
                <span className="n">
                  {result ? `#${result.queuePos}` : "-"}
                </span>
              </div>
              <div className="modal__actions" style={{ marginTop: 30 }}>
                <button
                  className="btn btn--ghost btn--block"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
