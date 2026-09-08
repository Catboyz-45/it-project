/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “auth.test” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { describe, expect, it } from "vitest";
import { requirePropertyAccess, requireRole, type AuthContext } from "@/lib/server/auth";

const propertyAdmin: AuthContext = {
  userId: "user-1",
  email: "admin@example.com",
  displayName: "Admin",
  role: "PROPERTY_ADMIN",
  propertyIds: ["property-a"],
};

describe("authorization", () => {
  it("allows an assigned property", () => {
    expect(() => requirePropertyAccess(propertyAdmin, "property-a")).not.toThrow();
  });

  it("hides an unassigned property", () => {
    expect(() => requirePropertyAccess(propertyAdmin, "property-b")).toThrowError("ไม่พบข้อมูล");
  });

  it("allows a super admin to access any property", () => {
    expect(() => requirePropertyAccess({ ...propertyAdmin, role: "SUPER_ADMIN", propertyIds: [] }, "property-b")).not.toThrow();
  });

  it("denies a role mismatch", () => {
    expect(() => requireRole(propertyAdmin, "SUPER_ADMIN")).toThrowError("คุณไม่มีสิทธิ์ดำเนินการ");
  });
});
