import { afterEach, test, mock } from "node:test";
import assert from "node:assert/strict";
import { sendAccessEmail } from "../app/lib/accessEmail.ts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.RESEND_API_KEY;
process.env.RESEND_API_KEY = "synthetic-key";
const params = { to: "synthetic@example.test", signInUrl: "https://example.test/sign-in?code=synthetic" };
afterEach(() => { mock.restoreAll(); globalThis.fetch = originalFetch; });
const limited = (name = "rate_limit_exceeded", retryAfter = "1") => Response.json({ name, message: "synthetic failure" }, { status: 429, headers: { "retry-after": retryAfter } });
function fastClock() {
  let now = 0;
  const waits: number[] = [];
  const timer = globalThis.setTimeout;
  mock.method(Date, "now", () => now);
  mock.method(Math, "random", () => 0.5);
  mock.method(globalThis, "setTimeout", (cb: () => void, delay: number) => {
    waits.push(delay); now += delay; return timer(cb, 0);
  });
  return waits;
}

test("Burst retries respect Retry-After and reuse one idempotency key", async () => {
  const waits = fastClock();
  const keys: string[] = [];
  globalThis.fetch = async (_input, init) => {
    keys.push(new Headers(init?.headers).get("idempotency-key") ?? "");
    return keys.length < 3 ? limited("rate_limit_exceeded", "2") : Response.json({ id: "synthetic" });
  };
  assert.equal(await sendAccessEmail(params), "sent");
  assert.equal(keys.length, 3);
  assert.ok(keys[0].startsWith("access-"));
  assert.equal(new Set(keys).size, 1);
  assert.ok(waits.every(delay => delay >= 2000));
});

test("Daily/monthly quota failures are not retried", async () => {
  for (const code of ["daily_quota_exceeded", "monthly_quota_exceeded"]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return limited(code); };
    await assert.rejects(sendAccessEmail(params), new RegExp(code));
    assert.equal(calls, 1);
  }
});

test("Repeated throttling is bounded within the route duration", async () => {
  const waits = fastClock();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return limited(); };
  await assert.rejects(sendAccessEmail(params), /rate_limit_exceeded/);
  assert.ok(calls <= 12);
  assert.ok(waits.reduce((a, b) => a + b, 0) < 45_000);
});

test("Fifty concurrent mail requests drain through a mocked ten-per-second provider", async () => {
  let window = 0;
  let used = 0;
  let accepted = 0;
  const ids = new Set<string>();
  globalThis.fetch = async (_input, init) => {
    const current = Math.floor(Date.now() / 1000);
    if (current !== window) { window = current; used = 0; }
    if (used >= 10) return limited();
    used++; accepted++;
    ids.add(new Headers(init?.headers).get("idempotency-key") ?? "");
    return Response.json({ id: "synthetic" });
  };
  const results = await Promise.all(Array.from({ length: 50 }, (_, i) => sendAccessEmail({ ...params, to: `synthetic-${i}@example.test` })));
  assert.equal(results.filter(r => r === "sent").length, 50);
  assert.equal(accepted, 50);
  assert.equal(ids.size, 50);
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
});
