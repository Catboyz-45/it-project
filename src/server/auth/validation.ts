import { z } from "zod";

export const loginSchema = z.object({ username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/), password: z.string().min(8).max(200) }).strict();
export const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
export const passwordSchema = z.object({ password: z.string().min(12).max(200).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).regex(/[^A-Za-z0-9]/), confirm: z.string().max(200) }).strict().refine(value => value.password === value.confirm, { message: "Passwords do not match", path: ["confirm"] });
export const recoverySchema = z.object({ code: z.string().trim().min(9).max(20) }).strict();
