"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, Loader2, LogOut } from "lucide-react";
import { forceLogoutTeamAction } from "@/server/admin/actions";
import { initialAdminActionState, type AdminActionState } from "@/types/admin";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

function ForceLogoutSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="danger" disabled={pending}>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <LogOut className="h-3.5 w-3.5" />
      )}
      {pending ? "Terminating" : "Force Logout"}
    </Button>
  );
}

function Message({ state }: { state: AdminActionState }) {
  if (!state.message) return null;
  const ok = state.status === "ok";
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 border px-3.5 py-3 font-mono text-[12px] leading-relaxed",
        ok ? "border-acid/40 bg-acid/10 text-acid" : "border-alert/40 bg-alert/10 text-alert",
      )}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {state.message}
    </div>
  );
}

/**
 * Force-logout panel for the admin team detail page.
 * Terminates all active sessions for a team so they can log in from a new device.
 */
export function ForceLogoutPanel({
  teamId,
  teamName,
}: {
  teamId: number;
  teamName: string;
}) {
  const [state, formAction] = useActionState(
    forceLogoutTeamAction,
    initialAdminActionState,
  );

  return (
    <Panel
      title="Force Logout"
      aside={<span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">{teamName}</span>}
    >
      <div className="space-y-3">
        <p className="font-mono text-[11px] leading-relaxed text-mist">
          Use this when {teamName} is locked out — they are logged in on
          another device and cannot sign in again. This terminates all their
          active sessions immediately.
        </p>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="teamId" value={teamId} />
          <ForceLogoutSubmit />
          <Message state={state} />
        </form>
      </div>
    </Panel>
  );
}
