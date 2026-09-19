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
    // วันออกบิลเกิน 28 ไม่ได้ เพราะกุมภาพันธ์ไม่มีวันที่ 29 ทุกปี
    expect(updatePropertySettingsSchema.safeParse({ ...base, billingDay: 29 }).success).toBe(false);
    expect(updatePropertySettingsSchema.safeParse({ ...base, promptPayId: "invalid" }).success).toBe(false);
    expect(updatePropertySettingsSchema.safeParse(base).success).toBe(true);
  });

  // ส่ง object ว่างมาต้องไม่ผ่าน เพราะไม่ได้แก้อะไรเลย จะได้ไม่มีคำขอที่ทำงานเปล่า ๆ
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
    // ส่ง null มาได้ หมายถึงไม่มีรถ ต่างจากไม่ส่งมาเลยซึ่งแปลว่าไม่ได้แก้ส่วนนี้
    expect(updateTenantProfileSchema.safeParse({ vehicle: null }).success).toBe(true);
  });

  // แพ็กเกจมี endpoint ของตัวเองแล้ว รูปแบบเก่าที่ฝังมาด้วยต้องไม่ผ่าน กันของเก่าแอบเข้ามาแก้สิทธิ์
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
