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

  it("normalizes identity details and rejects impossible values", () => {
    const parsed = updateTenantProfileSchema.parse({ nationalId: "1-1017-00230-70-8", birthDate: "2000-02-29" });
    expect(parsed.nationalId).toBe("1101700230708");
    expect(parsed.birthDate?.toISOString()).toBe("2000-02-29T00:00:00.000Z");
    // ส่ง null มาคือล้างค่า ต้องผ่าน
    expect(updateTenantProfileSchema.safeParse({ nationalId: null, birthDate: null }).success).toBe(true);
    expect(updateTenantProfileSchema.safeParse({ nationalId: "1101700230709" }).success).toBe(false);
    // ปี พ.ศ. ใส่ลงช่อง ค.ศ. กลายเป็นวันในอนาคต ต้องไม่ผ่าน
    expect(updateTenantProfileSchema.safeParse({ birthDate: "2543-01-01" }).success).toBe(false);
    expect(updateTenantProfileSchema.safeParse({ birthDate: "1899-12-31" }).success).toBe(false);
    expect(updateTenantProfileSchema.safeParse({ birthDate: "01/02/2000" }).success).toBe(false);
    expect(updateTenantProfileSchema.safeParse({ ownerNote: "x".repeat(2001) }).success).toBe(false);
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
