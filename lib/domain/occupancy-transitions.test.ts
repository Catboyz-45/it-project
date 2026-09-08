/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “occupancy transitions.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { calculateDepositSettlement, occupancyTransitionSchema } from "@/lib/domain/occupancy-transitions";

describe("occupancy transition", () => {
  it("calculates a deposit refund after deductions and outstanding invoices", () => {
    expect(calculateDepositSettlement(7000, [{ label: "ทำความสะอาด", amount: 500 }], 1000)).toEqual({
      deductionAmount: 500,
      refundAmount: 5500,
      amountDue: 0,
    });
  });

  it("calculates an amount due when charges exceed the deposit", () => {
    expect(calculateDepositSettlement(2000, [{ label: "ค่าเสียหาย", amount: 2500 }], 300)).toEqual({
      deductionAmount: 2500,
      refundAmount: 0,
      amountDue: 800,
    });
  });

  it("requires a destination only for room moves", () => {
    expect(occupancyTransitionSchema.safeParse({ type: "MOVE_ROOM", effectiveDate: "2026-08-01", reason: "เปลี่ยนห้อง", deductions: [] }).success).toBe(false);
    expect(occupancyTransitionSchema.safeParse({ type: "MOVE_OUT", destinationRoomId: "cm000000000000000000001", effectiveDate: "2026-08-01", reason: "ย้ายออก", deductions: [] }).success).toBe(false);
  });
});
