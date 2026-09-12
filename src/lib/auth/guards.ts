import "server-only";
import { redirect } from "next/navigation";
import { destroySession, getSessionView } from "@/lib/auth/session";
import type { AdminIdentity, SessionView, TeamIdentity } from "@/types/auth";

export interface TeamContext {
  session: SessionView;
  team: TeamIdentity;
}

export interface AdminContext {
  session: SessionView;
  admin: AdminIdentity;
}

/** Current team identity, or null when unauthenticated. */
export async function getTeamIdentity(): Promise<TeamContext | null> {
  const session = await getSessionView();
  if (!session || session.subject !== "TEAM" || !session.team) return null;
  return { session, team: session.team };
}

/** Resolve team identity and enforce that the account is still active. */
export async function requireTeam(): Promise<TeamContext> {
  const context = await getTeamIdentity();
  if (!context) redirect("/login");
  if (!context.team.isActive) {
    await destroySession();
    redirect("/login");
  }
  return context;
}

/** Current admin identity, or null when unauthenticated. */
export async function getAdminIdentity(): Promise<AdminContext | null> {
  const session = await getSessionView();
  if (!session || session.subject !== "ADMIN" || !session.admin) return null;
  return { session, admin: session.admin };
}

export async function requireAdmin(): Promise<AdminContext> {
  const context = await getAdminIdentity();
  if (!context) redirect("/admin/login");
  return context;
}
