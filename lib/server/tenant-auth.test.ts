/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “tenant auth.test” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { describe, expect, it } from "vitest";
import { canAccessTenantFinancialRecords, parseTenantRecordId } from "@/lib/server/tenant-auth";

describe("tenant record ownership policy", () => {
  it("allows financial records only for an active primary occupant", () => {
    expect(canAccessTenantFinancialRecords("PRIMARY", "ACTIVE")).toBe(true);
    expect(canAccessTenantFinancialRecords("PRIMARY", "PENDING")).toBe(false);
    expect(canAccessTenantFinancialRecords("CO_OCCUPANT", "ACTIVE")).toBe(false);
  });

  it("returns not-found semantics for malformed record identifiers", () => {
    expect(() => parseTenantRecordId("../../../invoice")).toThrow("ไม่พบข้อมูล");
  });
});
