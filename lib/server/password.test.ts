/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “password.test” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/server/password";

describe("password hashing", () => {
  it("verifies the correct password and rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("uses a unique salt for every password", async () => {
    const first = await hashPassword("same secure password");
    const second = await hashPassword("same secure password");
    expect(first).not.toBe(second);
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("password", "not-a-valid-hash")).toBe(false);
  });
});
