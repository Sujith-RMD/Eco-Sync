import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getSessionView } from "@/lib/auth/session";
import { Backdrop } from "@/components/fx/backdrop";
import { CaseFileHeader } from "@/components/layout/case-file-header";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { TeamLoginForm } from "@/components/auth/team-login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team Access",
};

export default async function TeamLoginPage() {
  const session = await getSessionView();
  if (session?.subject === "TEAM") redirect("/lobby");
  if (session?.subject === "ADMIN") redirect("/admin");

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Backdrop />
      <Topbar>
        <StatusPill tone="ok" label="secure channel" />
      </Topbar>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-4 py-8 sm:px-8 sm:py-14">
        <div className="mx-auto w-full max-w-md">
          <CaseFileHeader label="Team access" className="mb-4" />
          <Panel title="Team access terminal">
            <p className="mb-6 font-mono text-[12px] leading-relaxed text-mist">
              Identify your team. Access codes were issued at check-in.
              Every attempt is written to the custody log.
            </p>
            <TeamLoginForm />
          </Panel>

          <div className="mt-5 flex flex-col items-start gap-2 font-mono text-[10px] uppercase leading-snug tracking-[0.12em] sm:flex-row sm:items-center sm:justify-between sm:text-[11px] sm:tracking-[0.2em]">
            <span className="text-dim">Lost access? Find a coordinator.</span>
            <span className="flex flex-wrap items-center gap-3">
              <Link href="/" className="text-dim transition-colors hover:text-mist">
                Home
              </Link>
              <span aria-hidden className="h-3 w-px bg-line" />
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-1 text-mist transition-colors hover:text-acid"
              >
                Command personnel
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
