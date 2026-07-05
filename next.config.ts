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
// Clerk sources (#111 chunk 3, ADR 0004): the Frontend API + hosted assets
// (script/connect/img), avatar images from Google + img.clerk.com, telemetry on
// clerk-telemetry.com, and the Cloudflare Turnstile bot-check iframe. The Clerk
// host is derived per-deployment from the publishable key (see below), so the
// dev host covers localhost/preview and a prod instance's host is picked up
// automatically — no manual CSP edit when production lands.
const isDev = process.env.NODE_ENV === "development";

// Derive the Clerk Frontend API host from the publishable key. The host is
// base64-encoded inside the key (after the `pk_test_`/`pk_live_` prefix, with a
// trailing `$`), so decoding it makes the CSP match whichever Clerk instance a
// deployment's keys point at — the dev host on localhost/preview, the prod host
// on a production instance — with nothing to keep in sync by hand. Falls back to
// the dev wildcard if the key is unset (a keyless build, which otherwise can't
// happen since ClerkProvider needs the key).
function clerkFrontendApiHost(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return null;
  try {
    const decoded = Buffer.from(
      key.replace(/^pk_(test|live)_/, ""),
      "base64",
    ).toString("utf8");
    const host = decoded.replace(/\$+$/, "").trim();
    return /^[a-z0-9.-]+$/i.test(host) ? host : null;
  } catch {
    return null;
  }
}

const clerkHost = clerkFrontendApiHost();
// The instance host serves Clerk's browser JS + Frontend API; shared assets come
// from *.clerk.com. Both go in script-src/connect-src (and the host in img-src).
const CLERK_HOSTS = [
  clerkHost ? `https://${clerkHost}` : "https://*.clerk.accounts.dev",
  "https://*.clerk.com",
].join(" ");
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
