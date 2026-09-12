import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { toEventStamp } from "@/lib/utils/time";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit Trail — Command Deck",
};

function fmtMeta(meta: unknown): string {
  if (!meta) return "";
  try {
    const text = JSON.stringify(meta);
    return text.length > 90 ? `${text.slice(0, 90)}…` : text;
  } catch {
    return "";
  }
}

export default async function AdminAuditPage() {
  const { admin } = await requireAdmin();
  let entries: Awaited<ReturnType<typeof loadEntries>> = [];
  let loadFailed = false;

  async function loadEntries() {
    return db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
  }

  try {
    entries = await loadEntries();
  } catch {
    loadFailed = true;
  }

  return (
    <AdminShell
      active="audit"
      eyebrow="Command deck // custody chain"
      title="AUDIT TRAIL"
      adminName={admin.username}
    >
      <div className="overflow-x-auto border border-line/80 bg-abyss-900/70 backdrop-blur-md">
        <table className="w-full font-mono text-[11px] sm:min-w-[860px] sm:text-[12px]">
          <thead>
            <tr className="border-b border-line/70 text-left text-[9px] uppercase tracking-[0.12em] text-dim sm:text-[10px] sm:tracking-[0.22em]">
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">
                Timestamp (IST)
              </th>
              <th className="px-2 py-2.5 font-medium sm:px-3 sm:py-3">Actor</th>
              <th className="px-2 py-2.5 font-medium sm:px-3 sm:py-3">Action</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">
                Entity
              </th>
              <th className="hidden px-3 py-3 font-medium lg:table-cell">Meta</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">IP</th>
            </tr>
          </thead>
          <tbody>
            {loadFailed || entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-dim">
                  {loadFailed ? "Audit store unavailable." : "No events recorded yet."}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-b border-line/40 align-top">
                  <td className="px-2 py-2.5 whitespace-nowrap tabular-nums text-dim sm:px-4">
                    {toEventStamp(entry.createdAt)}
                  </td>
                  <td className="px-2 py-2 break-words text-mist sm:px-3 sm:py-2.5">
                    {entry.actorType}
                    {entry.actorId !== null ? ` #${entry.actorId}` : ""}
                  </td>
                  <td className="px-2 py-2 break-all text-ink sm:px-3 sm:py-2.5 sm:break-normal">
                    {entry.action}
                  </td>
                  <td className="hidden px-3 py-2.5 whitespace-nowrap text-mist md:table-cell">
                    {entry.entity ?? "—"}
                    {entry.entityId ? ` · ${entry.entityId}` : ""}
                  </td>
                  <td className="hidden max-w-[16rem] truncate px-3 py-2.5 text-dim lg:table-cell">
                    {fmtMeta(entry.meta)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-dim md:table-cell">
                    {entry.ip ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
