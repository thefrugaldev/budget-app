import type { NextConfig } from "next";

// Defense-in-depth response headers applied to every route. The app renders no
// untrusted HTML today (no dangerouslySetInnerHTML / eval anywhere), so the CSP
// keeps 'unsafe-inline' to stay compatible with Next's inline bootstrap and
// Tailwind styles without nonce middleware. Tighten to nonce-based script-src
// when auth/middleware lands.
//
// 'unsafe-eval' is added to script-src ONLY in development: Next's dev runtime
// uses eval() for source-map / callstack reconstruction, which the strict CSP
// would otherwise block (a noisy console error on every page). Production never
// uses eval(), so the deployed CSP stays strict.
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
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
