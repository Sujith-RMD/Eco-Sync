import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP for rate limiting and audit trails. */
export async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const realIp = requestHeaders.get("x-real-ip");
  return realIp ? realIp.slice(0, 45) : null;
}

/** Truncated user agent for session forensics. */
export async function getUserAgent(): Promise<string | null> {
  const requestHeaders = await headers();
  return requestHeaders.get("user-agent")?.slice(0, 255) ?? null;
}
