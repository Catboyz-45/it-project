/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “property management.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import {
  superAdminPropertyUpdateSchema,
  updatePropertySettingsSchema,
  updateTenantProfileSchema,
} from "@/lib/domain/property-management";

describe("property management validation", () => {
  it("rejects invalid billing days and PromptPay identifiers", () => {
    const base = {
      address: "1 ถนนทดสอบ",
      contactPhone: "0812345678",
      waterUnitRate: 10,
      electricityUnitRate: 8,
      billingDay: 1,
      dueDay: 5,
      lateFeePerDay: 0,
      invoicePrefix: "INV",
    };
    expect(updatePropertySettingsSchema.safeParse({ ...base, billingDay: 29 }).success).toBe(false);
    expect(updatePropertySettingsSchema.safeParse({ ...base, promptPayId: "invalid" }).success).toBe(false);
    expect(updatePropertySettingsSchema.safeParse(base).success).toBe(true);
  });

  it("rejects empty tenant changes", () => {
    expect(updateTenantProfileSchema.safeParse({}).success).toBe(false);
  });

  it("validates normalized tenant vehicle changes", () => {
    expect(updateTenantProfileSchema.safeParse({
      vehicle: {
        type: "MOTORCYCLE",
        licensePlate: "1กข 1234",
        province: "กรุงเทพมหานคร",
      },
    }).success).toBe(true);
    expect(updateTenantProfileSchema.safeParse({
      vehicle: { type: "CAR", licensePlate: "" },
    }).success).toBe(false);
    expect(updateTenantProfileSchema.safeParse({ vehicle: null }).success).toBe(true);
  });

  it("rejects legacy embedded subscription updates", () => {
    expect(superAdminPropertyUpdateSchema.safeParse({
      subscription: {
        planName: "ทดลอง",
        status: "TRIAL",
        maxProperties: 1,
        maxRooms: 0,
        startsAt: "2026-01-01",
        expiresAt: "2027-01-01",
      },
    }).success).toBe(false);
  });
});
