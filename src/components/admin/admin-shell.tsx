import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Backdrop } from "@/components/fx/backdrop";
import { Topbar } from "@/components/layout/topbar";
import { Eyebrow } from "@/components/layout/eyebrow";
import { StatusPill } from "@/components/ui/status-pill";
import { LogoutButton } from "@/components/auth/logout-button";

const NAV = [
  { href: "/admin", key: "overview", label: "Overview" },
  { href: "/admin/teams", key: "teams", label: "Teams" },
  { href: "/admin/leaderboard", key: "leaderboard", label: "Leaderboard" },
  { href: "/admin/votes", key: "votes", label: "Votes" },
  { href: "/admin/audit", key: "audit", label: "Audit" },
] as const;

export type AdminNavKey = (typeof NAV)[number]["key"];

export function AdminShell({
  active,
  eyebrow,
  title,
  adminName,
  children,
}: {
  active: AdminNavKey;
  eyebrow: string;
  title: string;
  adminName: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Backdrop />
      <Topbar>
        <StatusPill tone="warn" label={`operator // ${adminName}`} />
        <LogoutButton />
      </Topbar>

      <div className="relative z-10 border-b border-line/60 bg-abyss-950/50">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-2.5 sm:px-8">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors sm:px-3 sm:text-[11px] sm:tracking-[0.2em]",
                active === item.key
                  ? "bg-caution/10 text-caution"
                  : "text-dim hover:text-mist",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <Eyebrow tone="caution">{eyebrow}</Eyebrow>
        <h1 className="mt-4 mb-8 break-words font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}
