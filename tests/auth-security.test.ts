/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ auth-security.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  verifyPassword,
} from "@/server/security/crypto";
import {
  generateRecoveryCodes,
  normalizeRecoveryCode,
} from "@/server/security/recovery";
import { createTotpSecret, verifyTotpTimeStep } from "@/server/security/totp";
import * as OTPAuth from "otpauth";
import {
  authThrottleBuckets,
  authThrottleKey,
  calculateLockout,
  calculateProgressiveDelaySeconds,
  retryAfterSeconds,
} from "@/server/auth/throttle";
import { resolveForwardedClientIp } from "@/server/security/client-ip";
import { sessionCookieOptionsFor } from "@/server/auth/session";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.SESSION_SECRET ??=
  "test-session-secret-at-least-32-characters-long";
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
    const first = encryptSecret(secret);
    const second = encryptSecret(secret);
    expect(first).not.toBe(second);
    expect(first.startsWith("v1.")).toBe(true);
    expect(decryptSecret(first)).toBe(secret);
    const replacement = first.endsWith("x") ? "y" : "x";
    expect(() => decryptSecret(`${first.slice(0, -1)}${replacement}`)).toThrow();
  });
  it("returns the exact accepted TOTP time-step", () => {
    const secret = createTotpSecret();
    const username = "replay-test";
    const now = Date.UTC(2026, 7, 13, 12, 0, 0);
    const generator = new OTPAuth.TOTP({ issuer: "อยู่เย็นเป็นสุข วิศวกรรม", label: username, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
    const token = generator.generate({ timestamp: now });
    expect(verifyTotpTimeStep(secret, username, token, now)).toBe(Math.floor(now / 30_000));
  });
  it("generates ten unique one-time recovery codes and stores different hashes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes.map((item) => item.plain)).size).toBe(10);
    expect(new Set(codes.map((item) => item.hash)).size).toBe(10);
    expect(normalizeRecoveryCode(codes[0].plain.toLowerCase())).toHaveLength(
      12,
    );
    expect(codes.every((item) => !item.hash.includes(item.plain))).toBe(true);
  });
  it("separates throttle buckets by authentication purpose, account, and IP", () => {
    const ipHash = "hashed-ip";
    expect(authThrottleKey("totp", "account-ip", `admin-1:${ipHash}`)).not.toBe(
      authThrottleKey("recovery", "account-ip", `admin-1:${ipHash}`),
    );
    expect(authThrottleKey("totp", "account", "admin-1")).not.toBe(
      authThrottleKey("totp", "account", "admin-2"),
    );
    const buckets = authThrottleBuckets("login", "owner", ipHash);
    expect(buckets).toHaveLength(3);
    expect(buckets.map((bucket) => bucket.thresholdMultiplier)).toEqual([1, 5, 1]);
    expect(new Set(buckets.map((bucket) => bucket.key)).size).toBe(3);
  });
  it("applies an exponential delay before the full lockout", () => {
    expect(calculateProgressiveDelaySeconds(1, 5)).toBe(0);
    expect(calculateProgressiveDelaySeconds(2, 5)).toBe(1);
    expect(calculateProgressiveDelaySeconds(3, 5)).toBe(2);
    expect(calculateProgressiveDelaySeconds(4, 5)).toBe(4);
    expect(calculateProgressiveDelaySeconds(5, 5)).toBe(0);
    expect(calculateProgressiveDelaySeconds(21, 25)).toBe(0);
    expect(calculateProgressiveDelaySeconds(22, 25)).toBe(1);
  });
  it("returns a positive Retry-After value for an active lock", () => {
    const now = Date.now();
    const lockedUntil = calculateLockout(5, 5, 15, now);
    expect(lockedUntil).not.toBeNull();
    expect(retryAfterSeconds(lockedUntil!, now)).toBe(900);
  });
  it("ignores forwarding headers unless trusted proxy hops are configured", () => {
    expect(resolveForwardedClientIp("198.51.100.10", 0)).toBeNull();
    expect(resolveForwardedClientIp("198.51.100.10", 1)).toBe("198.51.100.10");
  });
  it("selects from the trusted right side of a forwarded chain", () => {
    expect(
      resolveForwardedClientIp("203.0.113.99, 198.51.100.10", 1),
    ).toBe("198.51.100.10");
    expect(
      resolveForwardedClientIp("203.0.113.99, 198.51.100.10", 2),
    ).toBe("203.0.113.99");
    expect(resolveForwardedClientIp("spoofed, 198.51.100.10", 1)).toBeNull();
  });
  it("always hardens the production session cookie", () => {
    expect(sessionCookieOptionsFor("production")).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(sessionCookieOptionsFor("development").secure).toBe(false);
  });
});
