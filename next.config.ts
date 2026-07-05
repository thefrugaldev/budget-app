import type { NextConfig } from "next";

// Defense-in-depth response headers applied to every route. The app renders no
// untrusted HTML today (no dangerouslySetInnerHTML / eval anywhere), so the CSP
// keeps 'unsafe-inline' to stay compatible with Next's inline bootstrap and
// Tailwind styles without nonce middleware. Migrating to nonce-based script-src
// is a larger effort (Clerk supports it via clerkMiddleware's
// contentSecurityPolicy option) and stays out of this chunk.
//
// 'unsafe-eval' is added to script-src ONLY in development: Next's dev runtime
// uses eval() for source-map / callstack reconstruction, which the strict CSP
// would otherwise block (a noisy console error on every page). Production never
// uses eval(), so the deployed CSP stays strict.
//
// Clerk sources (#111 chunk 3, ADR 0004): the Frontend API + hosted assets on
// `*.clerk.accounts.dev` (script/connect/img), avatar images from Google +
// img.clerk.com, telemetry on clerk-telemetry.com, and the Cloudflare Turnstile
// bot-check iframe. A production Clerk instance on a custom domain serves its
// FAPI from `clerk.<your-domain>` — add that host here when prod is set up.
const isDev = process.env.NODE_ENV === "development";

const CLERK_HOSTS = "https://*.clerk.accounts.dev";
const CLERK_TURNSTILE = "https://challenges.cloudflare.com";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${CLERK_HOSTS} ${CLERK_TURNSTILE}${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https://img.clerk.com https://*.googleusercontent.com ${CLERK_HOSTS}`,
      "font-src 'self' data:",
      `connect-src 'self' ${CLERK_HOSTS} https://clerk-telemetry.com`,
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
      `frame-src 'self' ${CLERK_TURNSTILE}`,
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
