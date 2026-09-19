import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// scrypt เป็นอัลกอริทึมที่ออกแบบให้ช้าและกินหน่วยความจำโดยตั้งใจ ทำให้ไล่เดารหัสผ่านไม่คุ้ม
// ใช้ของที่มาใน Node เลย ไม่ต้องพึ่งไลบรารีภายนอกที่ต้องคอยตามอัปเดต
const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;
// เก็บชื่อรูปแบบไว้ในค่าที่บันทึก เผื่อวันหลังเปลี่ยนอัลกอริทึมจะได้แยกของเก่ากับของใหม่ออก
const FORMAT = "scrypt-v1";

// เข้ารหัสรหัสผ่านก่อนเก็บ ระบบไม่เคยเก็บรหัสจริงไว้ที่ไหนเลย
export async function hashPassword(password: string): Promise<string> {
  // salt สุ่มใหม่ทุกครั้ง คนละคนใช้รหัสเดียวกันก็จะได้ค่าที่เก็บต่างกัน
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  // เก็บรูปแบบ salt และค่าที่ได้ไว้ในสตริงเดียว จะได้ไม่ต้องเพิ่มคอลัมน์ในฐานข้อมูล
  return `${FORMAT}$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [format, encodedSalt, encodedKey] = storedHash.split("$");
  // ค่าที่เก็บไว้ผิดรูปแบบก็ถือว่าไม่ผ่าน ดีกว่าโยน error ให้ผู้โจมตีรู้ว่ามีอะไรผิดปกติ
  if (format !== FORMAT || !encodedSalt || !encodedKey) return false;
  try {
    const expected = Buffer.from(encodedKey, "base64");
    if (expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(password, Buffer.from(encodedSalt, "base64"), expected.length) as Buffer;
    // timingSafeEqual ใช้เวลาเท่ากันเสมอ ไม่ว่าจะต่างกันที่ตัวแรกหรือตัวสุดท้าย
    // การเทียบด้วย === จะจบเร็วกว่าเมื่อต่างกันตั้งแต่ต้น ซึ่งเป็นช่องให้จับเวลาแล้วไล่เดารหัสทีละตัว
    return timingSafeEqual(actual, expected);
  } catch {
    // ค่าที่เก็บไว้เสียหรือถอดรหัส base64 ไม่ได้ ก็ถือว่าไม่ผ่าน ไม่ปล่อยให้ error หลุดขึ้นไป
    return false;
  }
}
