/** Send the Firebase credential directly to the application's verification page. */
export function accessVerificationUrl(generatedLink: string, continueUrl: string): string {
  const generated = new URL(generatedLink);
  const verification = new URL(continueUrl);
  for (const key of ["apiKey", "mode", "oobCode"]) {
    const value = generated.searchParams.get(key);
    if (!value) throw new Error("Invalid generated sign-in link");
    verification.searchParams.set(key, value);
  }
  if (verification.searchParams.get("mode") !== "signIn") throw new Error("Invalid sign-in mode");
  return verification.toString();
}

export function verificationInvite(link: string): string | null {
  const url = new URL(link);
  const direct = url.searchParams.get("invite");
  if (direct) return direct;
  try {
    return new URL(url.searchParams.get("continueUrl") ?? "").searchParams.get("invite");
  } catch {
    return null;
  }
}
