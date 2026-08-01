import "server-only";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

export function createTotpSecret(): string { return new OTPAuth.Secret({ size: 20 }).base32; }
function totp(secret: string, username: string) { return new OTPAuth.TOTP({ issuer: "อยู่เย็นเป็นสุข วิศวกรรม", label: username, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) }); }
export function verifyTotp(secret: string, username: string, token: string): boolean { return totp(secret, username).validate({ token, window: 1 }) !== null; }
export async function createTotpQr(secret: string, username: string): Promise<string> { return QRCode.toDataURL(totp(secret, username).toString(), { errorCorrectionLevel: "M", margin: 2, width: 260 }); }
