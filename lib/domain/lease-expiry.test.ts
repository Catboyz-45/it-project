/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “lease expiry.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { daysUntilLeaseExpiry, leaseDisplayStatus, leaseExpiryWindow } from "@/lib/domain/lease-expiry";

const now = new Date("2026-08-11T08:00:00.000Z");

describe("lease expiry", () => {
  it("calculates remaining calendar days", () => {
    expect(daysUntilLeaseExpiry("2026-08-11", now)).toBe(0);
    expect(daysUntilLeaseExpiry("2026-12-09", now)).toBe(120);
  });

  it("derives expiring and expired display statuses from the end date", () => {
    expect(leaseDisplayStatus("ACTIVE", "2026-12-09", now)).toBe("EXPIRING");
    expect(leaseDisplayStatus("ACTIVE", "2026-12-10", now)).toBe("ACTIVE");
    expect(leaseDisplayStatus("ACTIVE", "2026-08-10", now)).toBe("EXPIRED");
    expect(leaseDisplayStatus("CANCELLED", "2026-12-09", now)).toBe("CANCELLED");
  });

  it("builds an inclusive 120-day notification window", () => {
    expect(leaseExpiryWindow(now)).toEqual({
      from: new Date("2026-08-11T00:00:00.000Z"),
      to: new Date("2026-12-09T00:00:00.000Z"),
    });
  });
});
