/**
 * หน้าที่ของไฟล์นี้: กลไกความปลอดภัย crypto สำหรับตรวจคำขอ เข้ารหัส หรือยืนยันข้อมูลสำคัญก่อนระบบเชื่อถือ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import argon2 from "argon2";
import { getAuthEnv } from "@/server/env";

/** แปลงรหัสผ่านเป็น Argon2 hash ก่อนเก็บฐานข้อมูล; ไม่สามารถย้อน hash กลับเป็นรหัสผ่านเดิม */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}
/** เปรียบเทียบรหัสผ่านที่กรอกกับ hash โดยไม่เปิดเผยค่าที่เก็บ */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
/** ฟังก์ชันสาธารณะ randomToken เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
/** ฟังก์ชันสาธารณะ sha256 เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
/** ฟังก์ชันสาธารณะ keyedHash เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function keyedHash(value: string): string {
  return createHmac("sha256", getAuthEnv().SESSION_SECRET)
    .update(value)
    .digest("hex");
}
/** ฟังก์ชันสาธารณะ safeEqualHex เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseEncryptionKey(encoded: string, version: number): Buffer {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32)
    throw new Error(
      `TOTP encryption key version ${version} must be a base64-encoded 32-byte key`,
    );
  return key;
}

function encryptionKeys(): {
  currentVersion: number;
  keys: Map<number, Buffer>;
} {
  const env = getAuthEnv();
  const entries = new Map<number, Buffer>([
    [1, parseEncryptionKey(env.TOTP_ENCRYPTION_KEY, 1)],
  ]);
  if (env.TOTP_ENCRYPTION_KEYS) {
    let configured: unknown;
    try {
      configured = JSON.parse(env.TOTP_ENCRYPTION_KEYS);
    } catch {
      throw new Error("TOTP_ENCRYPTION_KEYS must be a JSON object");
    }
    if (
      !configured ||
      Array.isArray(configured) ||
      typeof configured !== "object"
    )
      throw new Error("TOTP_ENCRYPTION_KEYS must be a JSON object");
    for (const [rawVersion, encoded] of Object.entries(configured)) {
      const version = Number(rawVersion);
      if (
        !Number.isSafeInteger(version) ||
        version < 1 ||
        typeof encoded !== "string"
      )
        throw new Error(
          "TOTP_ENCRYPTION_KEYS contains an invalid version or key",
        );
      entries.set(version, parseEncryptionKey(encoded, version));
    }
  }
  if (!entries.has(env.TOTP_ENCRYPTION_CURRENT_VERSION))
    throw new Error(
      `Missing TOTP encryption key version ${env.TOTP_ENCRYPTION_CURRENT_VERSION}`,
    );
  return { currentVersion: env.TOTP_ENCRYPTION_CURRENT_VERSION, keys: entries };
}

/** อ่านข้อมูลที่จำเป็นสำหรับ currentTotpKeyVersion โดยไม่ตั้งใจเปลี่ยนข้อมูลต้นทาง */
export function currentTotpKeyVersion(): number {
  return encryptionKeys().currentVersion;
}

/** แปลงหรือจัดรูปข้อมูลด้วย encryptSecret ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function encryptSecret(
  plainText: string,
  keyVersion = currentTotpKeyVersion(),
): string {
  const key = encryptionKeys().keys.get(keyVersion);
  if (!key)
    throw new Error(`Missing TOTP encryption key version ${keyVersion}`);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
/** แปลงหรือจัดรูปข้อมูลด้วย decryptSecret ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function decryptSecret(payload: string, keyVersion = 1): string {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue)
    throw new Error("Invalid encrypted secret");
  const key = encryptionKeys().keys.get(keyVersion);
  if (!key)
    throw new Error(`Missing TOTP encryption key version ${keyVersion}`);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
