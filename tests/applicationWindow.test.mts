import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, writeBatch } from "firebase/firestore";
import { APPLICATION_DEADLINE, APPLICATION_DEADLINE_ISO, applicationsClosed } from "../app/lib/applicationWindow.ts";

const rules = readFileSync("firestore.rules", "utf8");
const guard = `request.time < timestamp.value('${APPLICATION_DEADLINE_ISO}')`;
const application = { name: "Deadline test", email: "deadline@example.test", age: "16", building: "A project", boldest: "Built it" };

test("the deadline is 7 PM Toronto / New York time, inclusive at closure", () => {
  assert.equal(APPLICATION_DEADLINE, Date.parse("2026-09-14T19:00:00-04:00"));
  assert.equal(applicationsClosed(APPLICATION_DEADLINE - 1), false);
  assert.equal(applicationsClosed(APPLICATION_DEADLINE), true);
  assert.equal(applicationsClosed(APPLICATION_DEADLINE + 1), true);
  assert.equal(rules.split(guard).length, 2, "one server-clock guard must match the UI deadline");
});

test("the deployed rule expression allows before the deadline and denies at / after it", async () => {
  for (const delta of [-1, 0, 1]) {
    // Only substitute the clock operand; keep the production comparison and cutoff.
    const now = new Date(APPLICATION_DEADLINE + delta).toISOString();
    const fixture = rules.replace(guard, guard.replace("request.time", `timestamp.value('${now}')`));
    const env = await initializeTestEnvironment({ projectId: `demo-deadline-boundary-${delta + 1}`, firestore: { rules: fixture } });
    try {
      const write = setDoc(doc(env.unauthenticatedContext().firestore(), "applications", "boundary"), application);
      await (delta < 0 ? assertSucceeds(write) : assertFails(write));
    } finally {
      await env.cleanup();
    }
  }
});

test("a closed window rejects backdated submissions and rolls back the whole batch", async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-deadline-closed",
    firestore: { rules: rules.replace(APPLICATION_DEADLINE_ISO, "2000-01-01T00:00:00.000Z") },
  });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "meta", "waitlist"), { count: 46 });
    });
    const db = env.unauthenticatedContext().firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, "applications", "late"), { ...application, ts: 0 });
    batch.set(doc(db, "meta", "waitlist"), { count: 47 });
    await assertFails(batch.commit());
    assert.equal((await getDoc(doc(db, "meta", "waitlist"))).data()?.count, 46);
    await env.withSecurityRulesDisabled(async ctx => {
      assert.equal((await getDoc(doc(ctx.firestore(), "applications", "late"))).exists(), false);
    });
  } finally {
    await env.cleanup();
  }
});
