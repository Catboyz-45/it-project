import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "@/server/security/crypto";
import { generateRecoveryCodes, normalizeRecoveryCode } from "@/server/security/recovery";
import { createTotpSecret } from "@/server/security/totp";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-characters-long";
process.env.TOTP_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.APP_URL ??= "http://localhost:3000";

describe("authentication cryptography", () => {
  it("hashes passwords with Argon2id and rejects a wrong password", async () => {
    const hash = await hashPassword("Correct-Horse1!");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "Correct-Horse1!")).toBe(true);
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });
  it("encrypts TOTP secrets with a randomized authenticated payload", () => {
    const secret = createTotpSecret();
    const first = encryptSecret(secret); const second = encryptSecret(secret);
    expect(first).not.toBe(second);
    expect(first.startsWith("v1.")).toBe(true);
    expect(decryptSecret(first)).toBe(secret);
    expect(() => decryptSecret(`${first.slice(0, -1)}x`)).toThrow();
  });
  it("generates ten unique one-time recovery codes and stores different hashes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes.map(item => item.plain)).size).toBe(10);
    expect(new Set(codes.map(item => item.hash)).size).toBe(10);
    expect(normalizeRecoveryCode(codes[0].plain.toLowerCase())).toHaveLength(12);
    expect(codes.every(item => !item.hash.includes(item.plain))).toBe(true);
  });
});
