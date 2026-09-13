// September 14, 2026 at 7 PM in Toronto / New York (EDT).
export const APPLICATION_DEADLINE_ISO = "2026-09-14T23:00:00.000Z";
export const APPLICATION_DEADLINE = Date.parse(APPLICATION_DEADLINE_ISO);
export const APPLICATIONS_CLOSED_MESSAGE = "Applications closed on September 14 at 7 PM ET.";

export function applicationsClosed(now = Date.now()): boolean {
  return now >= APPLICATION_DEADLINE;
}
