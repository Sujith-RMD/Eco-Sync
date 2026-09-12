"use server";

import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { admins, teams } from "@/db/schema";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionView } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { adminLoginSchema, teamLoginSchema } from "@/lib/validation/auth";
import { logAudit } from "@/server/audit/log";
import type { AuthActionState } from "@/types/auth";

const DENIED_TEAM = "Access denied. Verify the unit designation and access code.";
const DENIED_ADMIN = "Access denied. Verify operator credentials.";
const NOT_INITIALIZED =
  "System is not initialized. Contact the event coordinators.";

export async function loginTeam(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = teamLoginSchema.safeParse({
    teamName: formData.get("teamName"),
    accessCode: formData.get("accessCode"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Malformed credentials. Check both fields." };
  }

  const { teamName, accessCode } = parsed.data;
  const ip = await getClientIp();
  const userAgent = await getUserAgent();

  const gate = consumeRateLimit(`login:team:${ip ?? "unknown"}`, 10, 5 * 60_000);
  if (!gate.allowed) {
    return {
      ok: false,
      message: `Too many attempts. Stand down for ${gate.retryAfterSeconds}s.`,
    };
  }

  let team: {
    id: number;
    name: string;
    accessCodeHash: string;
    isActive: boolean;
  } | null = null;

  try {
    team =
      (await db.query.teams.findFirst({
        where: sql`lower(${teams.name}) = ${teamName.toLowerCase()}`,
        columns: { id: true, name: true, accessCodeHash: true, isActive: true },
      })) ?? null;
  } catch (error) {
    console.error("[auth] team lookup failed", error);
    return { ok: false, message: NOT_INITIALIZED };
  }

  // Always run the hash comparison to keep response timing uniform.
  const credentialMatch = await verifyPassword(
    accessCode,
    team?.accessCodeHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!team || !team.isActive || !credentialMatch) {
    await logAudit({
      actorType: "TEAM",
      actorId: team?.id ?? null,
      action: "auth.login.denied",
      entity: "team",
      entityId: team ? team.id : teamName,
      meta: {
        reason: !team
          ? "unknown_team"
          : !team.isActive
            ? "team_disabled"
            : "bad_credentials",
      },
      ip,
    });
    return { ok: false, message: DENIED_TEAM };
  }

  await logAudit({
    actorType: "TEAM",
    actorId: team.id,
    action: "auth.login.success",
    entity: "team",
    entityId: team.id,
    ip,
  });

  await createSession({ subject: "TEAM", teamId: team.id, ip, userAgent });
  redirect("/lobby");
}

export async function loginAdmin(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = adminLoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Malformed credentials. Check both fields." };
  }

  const { username, password } = parsed.data;
  const ip = await getClientIp();
  const userAgent = await getUserAgent();

  const gate = consumeRateLimit(`login:admin:${ip ?? "unknown"}`, 8, 10 * 60_000);
  if (!gate.allowed) {
    return {
      ok: false,
      message: `Too many attempts. Stand down for ${gate.retryAfterSeconds}s.`,
    };
  }

  let admin: {
    id: number;
    username: string;
    passwordHash: string;
  } | null = null;

  try {
    admin =
      (await db.query.admins.findFirst({
        where: sql`lower(${admins.username}) = ${username.toLowerCase()}`,
        columns: { id: true, username: true, passwordHash: true },
      })) ?? null;
  } catch (error) {
    console.error("[auth] admin lookup failed", error);
    return { ok: false, message: NOT_INITIALIZED };
  }

  const credentialMatch = await verifyPassword(
    password,
    admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!admin || !credentialMatch) {
    await logAudit({
      actorType: "ADMIN",
      actorId: admin?.id ?? null,
      action: "auth.admin_login.denied",
      entity: "admin",
      entityId: admin ? admin.id : username,
      meta: { reason: !admin ? "unknown_admin" : "bad_credentials" },
      ip,
    });
    return { ok: false, message: DENIED_ADMIN };
  }

  await logAudit({
    actorType: "ADMIN",
    actorId: admin.id,
    action: "auth.admin_login.success",
    entity: "admin",
    entityId: admin.id,
    ip,
  });

  await createSession({ subject: "ADMIN", adminId: admin.id, ip, userAgent });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const view = await getSessionView();
  if (view) {
    await logAudit({
      actorType: view.subject,
      actorId: view.team?.id ?? view.admin?.id ?? null,
      action: "auth.logout",
      entity: "session",
    });
  }
  await destroySession();
  redirect("/");
}
