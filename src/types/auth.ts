/**
 * Auth/session types that are safe to share with client components.
 * Never put secrets, tokens, or hashes here.
 */

export type SessionSubject = "TEAM" | "ADMIN";

export interface TeamIdentity {
  id: number;
  name: string;
  isActive: boolean;
}

export interface AdminIdentity {
  id: number;
  username: string;
}

/** Public view of a server-side session (no raw token, no hash). */
export interface SessionView {
  subject: SessionSubject;
  expiresAt: Date;
  team?: TeamIdentity;
  admin?: AdminIdentity;
}

/** Shared state shape for authentication server actions. */
export interface AuthActionState {
  ok: boolean;
  message?: string;
}

export const initialAuthState: AuthActionState = { ok: false };
