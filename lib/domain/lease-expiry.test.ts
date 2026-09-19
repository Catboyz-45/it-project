import { describe, expect, it } from "vitest";
import { daysUntilLeaseExpiry, leaseDisplayStatus, leaseExpiryWindow } from "@/lib/domain/lease-expiry";

// ตรึงเวลาไว้ ไม่ใช้เวลาจริง ไม่งั้นตัวทดสอบจะพังเองเมื่อเวลาผ่านไป
const now = new Date("2026-08-11T08:00:00.000Z");

describe("lease expiry", () => {
  it("calculates remaining calendar days", () => {
    expect(daysUntilLeaseExpiry("2026-08-11", now)).toBe(0);
    expect(daysUntilLeaseExpiry("2026-12-09", now)).toBe(120);
  });

  // ฐานข้อมูลเก็บแค่ ACTIVE ส่วน EXPIRING กับ EXPIRED คำนวณจากวันหมดอายุตอนแสดงผล
  // สถานะที่ถูกยกเลิกไปแล้วต้องไม่ถูกคำนวณทับ
  it("derives expiring and expired display statuses from the end date", () => {
    expect(leaseDisplayStatus("ACTIVE", "2026-12-09", now)).toBe("EXPIRING");
    expect(leaseDisplayStatus("ACTIVE", "2026-12-10", now)).toBe("ACTIVE");
    expect(leaseDisplayStatus("ACTIVE", "2026-08-10", now)).toBe("EXPIRED");
    expect(leaseDisplayStatus("CANCELLED", "2026-12-09", now)).toBe("CANCELLED");
  });

  // ช่วงเตือนล่วงหน้า 120 วัน นับรวมทั้งวันแรกและวันสุดท้าย
  it("builds an inclusive 120-day notification window", () => {
    expect(leaseExpiryWindow(now)).toEqual({
      from: new Date("2026-08-11T00:00:00.000Z"),
      to: new Date("2026-12-09T00:00:00.000Z"),
    });
  });
});
