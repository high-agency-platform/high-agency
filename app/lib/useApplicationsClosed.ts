"use client";

import { useSyncExternalStore } from "react";
import { APPLICATION_DEADLINE, applicationsClosed } from "./applicationWindow";

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const refresh = () => {
    clearTimeout(timer);
    onChange();
    if (!applicationsClosed()) {
      timer = setTimeout(refresh, Math.min(APPLICATION_DEADLINE - Date.now(), 2_147_483_647));
    }
  };
  refresh();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  return () => {
    clearTimeout(timer);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
  };
}

export function useApplicationsClosed(initiallyClosed: boolean) {
  return useSyncExternalStore(subscribe, () => initiallyClosed || applicationsClosed(), () => initiallyClosed);
}
