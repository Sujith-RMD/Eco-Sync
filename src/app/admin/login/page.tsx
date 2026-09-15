import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { getSessionView } from "@/lib/auth/session";
import { Backdrop } from "@/components/fx/backdrop";
import { CaseFileHeader } from "@/components/layout/case-file-header";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { AdminLoginForm } from "@/components/auth/admin-login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Command Deck Access",
};

export default async function AdminLoginPage() {
  const session = await getSessionView();
  if (session?.subject === "ADMIN") redirect("/admin");
  if (session?.subject === "TEAM") redirect("/lobby");

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Backdrop />
      <Topbar>
        <StatusPill tone="warn" label="restricted area" />
      </Topbar>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-14 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <CaseFileHeader label="Command deck" className="mb-4" />
          <Panel
            title="Command deck access"
            aside={<ShieldCheck className="h-4 w-4 text-caution" />}
          >
            <p className="mb-6 font-mono text-[12px] leading-relaxed text-mist">
              Authorized operators only. Attempts are audited and rate-limited;
              actions on this deck are irreversible by design.
            </p>
            <AdminLoginForm />
          </Panel>

          <div className="mt-5 flex flex-col items-start gap-2 font-mono text-[10px] uppercase leading-snug tracking-[0.12em] sm:flex-row sm:items-center sm:justify-between sm:text-[11px] sm:tracking-[0.2em]">
            <span className="text-dim">Not an operator?</span>
            <span className="flex flex-wrap items-center gap-3">
              <Link href="/" className="text-dim transition-colors hover:text-mist">
                Home
              </Link>
              <span aria-hidden className="h-3 w-px bg-line" />
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-mist transition-colors hover:text-acid"
              >
                Team terminal
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
