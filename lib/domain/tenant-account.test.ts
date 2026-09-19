import { describe, expect, it } from "vitest";
import { updateOwnTenantProfileSchema } from "@/lib/domain/tenant-account";

describe("tenant account validation", () => {
  // ช่องที่ไม่บังคับและกรอกว่างมา ต้องเก็บเป็น null ไม่ใช่สตริงว่าง จะได้เช็คที่เดียวทั้งระบบ
  it("normalizes optional empty profile fields to null", () => {
    const result = updateOwnTenantProfileSchema.parse({
      displayName: "สุดา สุขใจ",
      phone: "0891234567",
      address: "",
      emergencyName: "",
      emergencyPhone: "",
    });
    expect(result).toMatchObject({
      address: null,
      emergencyName: null,
      emergencyPhone: null,
    });
  });

  // ฟิลด์แปลกปลอมอย่าง role ต้องไม่ผ่าน ไม่งั้นผู้เช่าจะยกระดับสิทธิ์ตัวเองผ่านหน้าแก้โปรไฟล์ได้
  it("rejects unknown and invalid fields", () => {
    expect(updateOwnTenantProfileSchema.safeParse({
      displayName: "ส",
      phone: "123",
      address: "",
      emergencyName: "",
      emergencyPhone: "",
      role: "SUPER_ADMIN",
    }).success).toBe(false);
  });
});
