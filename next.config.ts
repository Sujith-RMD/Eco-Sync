import os from "node:os";
import type { NextConfig } from "next";

/**
 * Dev-only origins allowed to fetch Next's dev resources.
 *
 * Next 16 blocks those resources for any origin other than localhost unless it
 * is listed here, and it blocks them with a 403 that the page never surfaces:
 * the HTML arrives, the roster renders, and the client bundle that would make
 * it interactive does not run. The console warning names the blocked path, but
 * a team mid-round sees only a screen where nothing responds.
 *
 * That matters here because the runbook's rehearsal step is "from an actual
 * phone", which by definition is a LAN origin — the exact case that gets
 * blocked.
 *
 * Derived from this machine's own interfaces rather than hardcoded: the LAN
 * address changes with the network, and a stale literal would silently
 * reintroduce the block. Never populated in production, where the list is
 * meaningless anyway.
 */
function allowedDevOrigins(): string[] {
  if (process.env.NODE_ENV === "production") return [];

  const hosts = new Set<string>(["localhost", "127.0.0.1"]);
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) hosts.add(address.address);
    }
  }
  return [...hosts];
}

/**
 * Baseline security headers for every response.
 *
 * The CSP is deliberately narrow: only the directives that carry zero breakage
 * risk for this app are set. `script-src`/`style-src` are left open because
 * Next's hydration inline scripts and the Vercel analytics/insights tags would
 * need nonce plumbing (middleware + request-scoped CSP) to lock down, and a
 * broken hydration mid-event costs more than it protects here. The set ones
 * still cover clickjacking (frame-ancestors + X-Frame-Options), form-target
 * injection (form-action), MIME sniffing, referrer leakage and privileged APIs.
 */
const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: allowedDevOrigins(),
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
