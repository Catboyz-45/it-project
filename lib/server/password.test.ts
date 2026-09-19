import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/server/password";

describe("password hashing", () => {
  it("verifies the correct password and rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  // รหัสเดียวกันต้องได้ค่าที่เก็บต่างกัน ไม่งั้นฐานข้อมูลรั่วแล้วเดารหัสทีเดียวได้หลายบัญชี
  it("uses a unique salt for every password", async () => {
    const first = await hashPassword("same secure password");
    const second = await hashPassword("same secure password");
    expect(first).not.toBe(second);
  });

  // ค่าที่เก็บไว้เสียต้องตอบว่าไม่ผ่าน ไม่ใช่โยน error ให้หลุดขึ้นไปเป็นข้อความผิดพลาดของระบบ
  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("password", "not-a-valid-hash")).toBe(false);
  });
});
