import "server-only";
import { randomBytes } from "node:crypto";
import { keyedHash } from "./crypto";

export function normalizeRecoveryCode(value: string): string { return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
export function generateRecoveryCodes(count = 10): Array<{ plain: string; hash: string }> {
  return Array.from({ length: count }, () => { const raw = randomBytes(6).toString("hex").toUpperCase(); const plain = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`; return { plain, hash: keyedHash(normalizeRecoveryCode(plain)) }; });
}
