/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “leases.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { createLeaseSchema, renewLeaseSchema, updateLeaseSchema } from "@/lib/domain/leases";
import { leaseStatusTransitions } from "@/lib/domain/enums";

describe("lease lifecycle", () => {
  it("rejects an end date before the start date", () => {
    expect(createLeaseSchema.safeParse({
      roomId: "cm12345678901234567890123",
      startDate: "2027-01-01",
      endDate: "2026-01-01",
      monthlyRent: 3000,
    }).success).toBe(false);
  });

  it("requires optimistic version for edits", () => {
    expect(updateLeaseSchema.safeParse({ monthlyRent: 3500 }).success).toBe(false);
    expect(updateLeaseSchema.safeParse({ expectedVersion: 1, monthlyRent: 3500 }).success).toBe(true);
  });

  it("requires signature review before activation", () => {
    expect(leaseStatusTransitions.DRAFT).not.toContain("ACTIVE");
    expect(leaseStatusTransitions.PENDING_SIGNATURE).toContain("ACTIVE");
  });

  it("validates renewal dates and money", () => {
    expect(renewLeaseSchema.safeParse({ startDate: "2027-01-01", endDate: "2027-12-31", monthlyRent: 4000, depositAmount: 4000 }).success).toBe(true);
    expect(renewLeaseSchema.safeParse({ startDate: "2027-12-31", endDate: "2027-01-01", monthlyRent: 4000 }).success).toBe(false);
  });
});
