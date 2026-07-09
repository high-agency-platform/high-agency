// Build-time feature flags. Keep this module dependency-free (no Firebase, no
// client-only APIs) so it is safe to import from both client components and the
// server-side `proxy.ts` gate.

/**
 * Whether the authenticated platform (login + the entire `app/(platform)` shell)
 * is reachable in this environment.
 *
 * Product intent: the deployed site is a **waitlist-only marketing page** until
 * the platform is ready for real users — so the platform is OFF by default in
 * production, and ON automatically during local `next dev`.
 *
 * Resolution:
 *  - `next dev` (NODE_ENV=development) → enabled, no config needed.
 *  - Any production build (Vercel prod/preview, `next build`) → disabled, unless
 *    `NEXT_PUBLIC_PLATFORM_ENABLED=true` is explicitly set to force it on.
 *
 * `NEXT_PUBLIC_` is required because this value is read on the client (to hide
 * the "Log in" link) as well as in the proxy; the value is inlined at build time.
 */
export const PLATFORM_ENABLED =
  process.env.NEXT_PUBLIC_PLATFORM_ENABLED === "true" ||
  process.env.NODE_ENV === "development";
