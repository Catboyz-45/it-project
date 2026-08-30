/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ totp-key-rotation.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const original = {
  legacy: process.env.TOTP_ENCRYPTION_KEY,
  keyring: process.env.TOTP_ENCRYPTION_KEYS,
  current: process.env.TOTP_ENCRYPTION_CURRENT_VERSION,
};

afterEach(() => {
  if (original.legacy === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
  else process.env.TOTP_ENCRYPTION_KEY = original.legacy;
  if (original.keyring === undefined) delete process.env.TOTP_ENCRYPTION_KEYS;
  else process.env.TOTP_ENCRYPTION_KEYS = original.keyring;
  if (original.current === undefined)
    delete process.env.TOTP_ENCRYPTION_CURRENT_VERSION;
  else process.env.TOTP_ENCRYPTION_CURRENT_VERSION = original.current;
  vi.resetModules();
});

describe("TOTP encryption key rotation", () => {
  it("decrypts old secrets and encrypts new secrets with the current key", async () => {
    const first = Buffer.alloc(32, 11).toString("base64");
    const second = Buffer.alloc(32, 22).toString("base64");
    process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
    process.env.SESSION_SECRET ??=
      "test-session-secret-at-least-32-characters-long";
    process.env.APP_URL ??= "http://localhost:3000";
    process.env.TOTP_ENCRYPTION_KEY = first;
    process.env.TOTP_ENCRYPTION_KEYS = JSON.stringify({ 1: first, 2: second });
    process.env.TOTP_ENCRYPTION_CURRENT_VERSION = "2";
    vi.resetModules();

    const crypto = await import("@/server/security/crypto");
    const secret = "JBSWY3DPEHPK3PXP";
    const oldCiphertext = crypto.encryptSecret(secret, 1);
    const newCiphertext = crypto.encryptSecret(secret);

    expect(crypto.currentTotpKeyVersion()).toBe(2);
    expect(crypto.decryptSecret(oldCiphertext, 1)).toBe(secret);
    expect(crypto.decryptSecret(newCiphertext, 2)).toBe(secret);
    expect(() => crypto.decryptSecret(oldCiphertext, 2)).toThrow();
  });

  it("fails closed when the current key is missing", async () => {
    const first = Buffer.alloc(32, 33).toString("base64");
    process.env.TOTP_ENCRYPTION_KEY = first;
    process.env.TOTP_ENCRYPTION_KEYS = JSON.stringify({ 1: first });
    process.env.TOTP_ENCRYPTION_CURRENT_VERSION = "2";
    vi.resetModules();

    const { currentTotpKeyVersion } = await import("@/server/security/crypto");
    expect(() => currentTotpKeyVersion()).toThrow(
      "Missing TOTP encryption key version 2",
    );
  });
});
