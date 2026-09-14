import { z } from "zod";

/** Input contracts for authentication flows (server-enforced). */

export const teamLoginSchema = z.object({
  teamName: z
    .string()
    .trim()
    .min(2, "Team designation is too short.")
    .max(80, "Team designation is too long."),
  accessCode: z.string().min(1, "Access code is required.").max(128),
});

export const adminLoginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Operator ID is too short.")
    .max(80, "Operator ID is too long."),
  password: z.string().min(1, "Passphrase is required.").max(128),
});

export type TeamLoginInput = z.infer<typeof teamLoginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
