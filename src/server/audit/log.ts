import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditActorType = "TEAM" | "ADMIN" | "SYSTEM";

export interface AuditEntry {
  actorType: AuditActorType;
  actorId: number | null;
  /** Dot-namespaced action, e.g. "auth.login.success", "round1.start". */
  action: string;
  entity?: string;
  entityId?: string | number;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Appends to the immutable audit trail. Logging failures are swallowed
 * (and reported to the server console) so telemetry never breaks gameplay;
 * critical admin operations will additionally assert via transactions in
 * later phases.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity ?? null,
      entityId:
        entry.entityId === undefined || entry.entityId === null
          ? null
          : String(entry.entityId),
      meta: entry.meta ?? null,
      ip: entry.ip ?? null,
    });
  } catch (error) {
    console.error("[audit] failed to persist audit log entry", error);
  }
}
