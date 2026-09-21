import { test } from "node:test";
import assert from "node:assert/strict";
import { accessVerificationUrl, verificationInvite } from "../app/lib/accessLink.ts";

test("production verification keeps the invite and bypasses the intermediate handler", () => {
  const url = new URL(accessVerificationUrl(
    "https://example.firebaseapp.com/__/auth/action?apiKey=synthetic&mode=signIn&oobCode=synthetic-code",
    "https://high-agency.io/login/verify?invite=synthetic-invite",
  ));
  assert.equal(url.origin, "https://high-agency.io");
  assert.equal(url.pathname, "/login/verify");
  assert.equal(url.searchParams.get("invite"), "synthetic-invite");
  assert.equal(url.searchParams.get("oobCode"), "synthetic-code");
  assert.equal(url.searchParams.get("mode"), "signIn");
});

test("verification rejects incomplete or unrelated action credentials", () => {
  assert.throws(() => accessVerificationUrl("https://example.test/?mode=signIn", "https://high-agency.io/login/verify"));
  assert.throws(() => accessVerificationUrl("https://example.test/?mode=resetPassword&apiKey=x&oobCode=y", "https://high-agency.io/login/verify"));
});

test("older action links preserve nested invitations during login recovery", () => {
  const old = new URL("https://high-agency.io/login?mode=signIn&oobCode=synthetic");
  old.searchParams.set("continueUrl", "https://high-agency.io/login/verify?invite=cohort");
  assert.equal(verificationInvite(old.toString()), "cohort");
  assert.equal(verificationInvite("https://high-agency.io/login/verify?invite=direct"), "direct");
  assert.equal(verificationInvite("https://high-agency.io/login/verify"), null);
});
