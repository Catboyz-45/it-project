/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “property memberships.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { updatePropertyMembershipsSchema } from "@/lib/domain/property-memberships";

describe("updatePropertyMembershipsSchema", () => {
  it("deduplicates property ids", () => {
    const propertyId = "clx1234567890123456789012";
    expect(updatePropertyMembershipsSchema.parse({ propertyIds: [propertyId, propertyId] }))
      .toEqual({ propertyIds: [propertyId] });
  });

  it("allows removing access from every property", () => {
    expect(updatePropertyMembershipsSchema.parse({ propertyIds: [] }))
      .toEqual({ propertyIds: [] });
  });

  it("rejects unknown fields and invalid ids", () => {
    expect(() => updatePropertyMembershipsSchema.parse({ propertyIds: ["invalid"], role: "SUPER_ADMIN" }))
      .toThrow();
  });
});
