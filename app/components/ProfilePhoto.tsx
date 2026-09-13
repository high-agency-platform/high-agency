"use client";

import { useRef, useState } from "react";
import { fileToSquareIcon } from "../lib/image";
import { Avatar } from "./ui";

export function ProfilePhoto({ name, value, onChange, onBusy }: { name: string; value: string; onChange: (value: string) => void; onBusy: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(file?: File) {
    if (!file) return;
    setError("");
    if (file.size > 10 * 1024 * 1024) { setError("Choose a photo under 10 MB."); return; }
    setBusy(true);
    onBusy(true);
    try { onChange(await fileToSquareIcon(file)); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't read that photo."); }
    finally { setBusy(false); onBusy(false); }
  }

  return (
    <div className="profile-photo">
      <Avatar name={name} photoUrl={value} size="lg" />
      <div>
        <div className="profile-photo__actions">
          <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Processing…" : value ? "Change photo" : "Upload photo"}</button>
          {value && <button type="button" className="link-btn" disabled={busy} onClick={() => onChange("")}>Remove</button>}
        </div>
        <p>Shown to program members.</p>
        {error && <p className="form-err" role="alert">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Profile photo" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
