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

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOrigins(),
};

export default nextConfig;
