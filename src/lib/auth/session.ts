import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import type { SessionView } from "@/types/auth";

export const SESSION_COOKIE = "ecosync_session";

const TOKEN_BYTES = 32;
const MAX_TTL_HOURS = 24 * 7;
const DEFAULT_TTL_HOURS = 12;

function sessionTtlHours(): number {
  const raw = Number(process.env.SESSION_TTL_HOURS ?? DEFAULT_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 && raw <= MAX_TTL_HOURS
    ? raw
    : DEFAULT_TTL_HOURS;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreateSessionInput {
  subject: "TEAM" | "ADMIN";
  teamId?: number;
  adminId?: number;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Creates a database-backed session. The browser receives a random bearer
 * token in an httpOnly cookie; only its SHA-256 hash is stored server-side,
 * so a database leak does not leak usable tokens.
 */
export async function createSession(input: CreateSessionInput): Promise<void> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlHours() * 3_600_000);

  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    subject: input.subject,
    teamId: input.teamId ?? null,
    adminId: input.adminId ?? null,
    expiresAt,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Resolves the cookie to a safe session view. Returns null for missing,
 * unknown, or expired tokens (expired rows are cleaned up opportunistically).
 */
export async function getSessionView(): Promise<SessionView | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const record = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, hashToken(token)),
    with: { team: true, admin: true },
  });

  if (!record) return null;

  if (record.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, record.id));
    return null;
  }

  return {
    subject: record.subject,
    expiresAt: record.expiresAt,
    team: record.team
      ? { id: record.team.id, name: record.team.name, isActive: record.team.isActive }
      : undefined,
    admin: record.admin
      ? { id: record.admin.id, username: record.admin.username }
      : undefined,
  };
}

/** Destroys all active sessions for a given team, enforcing single-session-per-team. */
export async function destroySessionsForTeam(teamId: number): Promise<void> {
  await db.delete(sessions).where(
    sql`${sessions.subject} = 'TEAM' AND ${sessions.teamId} = ${teamId}`,
  );
}

/** Destroys the session row and clears the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}
