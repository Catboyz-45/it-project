import { describe, expect, it } from "vitest";
import { updatePropertyMembershipsSchema } from "@/lib/domain/property-memberships";

describe("updatePropertyMembershipsSchema", () => {
  it("deduplicates property ids", () => {
    const propertyId = "clx1234567890123456789012";
    expect(updatePropertyMembershipsSchema.parse({ propertyIds: [propertyId, propertyId] }))
      .toEqual({ propertyIds: [propertyId] });
  });

  // ส่งรายการว่างมาได้ หมายถึงถอนสิทธิ์ทุกหอ ไม่ใช่ข้อมูลผิดรูปแบบ
  it("allows removing access from every property", () => {
    expect(updatePropertyMembershipsSchema.parse({ propertyIds: [] }))
      .toEqual({ propertyIds: [] });
  });

  // ฟิลด์แปลกปลอมอย่าง role ต้องไม่ผ่าน ไม่งั้นจะเป็นช่องยกระดับสิทธิ์ตัวเอง
  it("rejects unknown fields and invalid ids", () => {
    expect(() => updatePropertyMembershipsSchema.parse({ propertyIds: ["invalid"], role: "SUPER_ADMIN" }))
      .toThrow();
  });
});
