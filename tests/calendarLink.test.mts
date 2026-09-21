import assert from "node:assert/strict";
import { test } from "node:test";
import { Timestamp } from "firebase/firestore";
import { workshopCalendarUrl, workshopIsUpcoming, type Workshop } from "../app/lib/types.ts";

const session: Workshop = {
  id: "local-calendar-test", title: "Build & learn / Ship #1", mentorName: "Test M.",
  description: "A session with questions? Yes & more.", startsAt: Timestamp.fromDate(new Date("2026-11-01T05:30:00Z")),
  durationMins: 90, meetLink: "https://meet.example.com/local", recordingUrl: "",
};

test("Google Calendar links preserve UTC instants across the DST change", () => {
  const url = new URL(workshopCalendarUrl(session));
  assert.equal(url.origin, "https://calendar.google.com");
  assert.equal(url.pathname, "/calendar/render");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("dates"), "20261101T053000Z/20261101T070000Z");
});

test("Google Calendar links safely encode the session and carry its meeting link", () => {
  const url = new URL(workshopCalendarUrl(session));
  assert.equal(url.searchParams.get("text"), session.title);
  assert.equal(url.searchParams.get("location"), session.meetLink);
  assert.equal(url.searchParams.get("details"), `${session.description}\n\nHosted by Test M.\n\n${session.meetLink}`);
  assert.equal(url.hash, "");
});


test("Sessions stay visible and enrollable throughout the scheduled meeting", () => {
  const start = session.startsAt.toDate().getTime();
  assert.equal(workshopIsUpcoming(session, start - 1), true);
  assert.equal(workshopIsUpcoming(session, start), true);
  assert.equal(workshopIsUpcoming(session, start + 45 * 60_000), true);
  assert.equal(workshopIsUpcoming(session, start + 90 * 60_000 - 1), true);
  assert.equal(workshopIsUpcoming(session, start + 90 * 60_000), false);
});
