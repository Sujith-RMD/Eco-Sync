/** Shared state shapes for admin server actions (client-safe). */

export interface AdminActionState {
  status: "idle" | "ok" | "error";
  message?: string;
}

export const initialAdminActionState: AdminActionState = { status: "idle" };

export interface SeedTeamCredential {
  name: string;
  accessCode: string;
}

export interface SeedActionState {
  status: "idle" | "ok" | "error";
  message?: string;
  result?: {
    teams: SeedTeamCredential[];
    adminUsername: string;
    teamCount: number;
    puzzleCounts: { round1: number; round2: number };
  };
}

export const initialSeedActionState: SeedActionState = { status: "idle" };
