/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “password” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;
const FORMAT = "scrypt-v1";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “hash Password” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - password: ค่า “password” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<string> ตามสัญญา TypeScript ของฟังก์ชัน
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `${FORMAT}$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “verify Password” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - password: ค่า “password” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - storedHash: ค่า “stored Hash” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<boolean> ตามสัญญา TypeScript ของฟังก์ชัน
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [format, encodedSalt, encodedKey] = storedHash.split("$");
  if (format !== FORMAT || !encodedSalt || !encodedKey) return false;
  try {
    const expected = Buffer.from(encodedKey, "base64");
    if (expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(password, Buffer.from(encodedSalt, "base64"), expected.length) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
