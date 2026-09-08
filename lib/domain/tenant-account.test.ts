/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “tenant account.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { updateOwnTenantProfileSchema } from "@/lib/domain/tenant-account";

describe("tenant account validation", () => {
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
