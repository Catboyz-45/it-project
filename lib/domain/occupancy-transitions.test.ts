import { describe, expect, it } from "vitest";
import { calculateDepositSettlement, occupancyTransitionSchema } from "@/lib/domain/occupancy-transitions";

describe("occupancy transition", () => {
  // เงินประกัน 7000 หักค่าทำความสะอาด 500 และบิลค้าง 1000 เหลือคืน 5500
  it("calculates a deposit refund after deductions and outstanding invoices", () => {
    expect(calculateDepositSettlement(7000, [{ label: "ทำความสะอาด", amount: 500 }], 1000)).toEqual({
      deductionAmount: 500,
      refundAmount: 5500,
      amountDue: 0,
    });
  });

  // หักเกินเงินประกันก็ไม่คืนติดลบ แต่กลายเป็นยอดที่ต้องเรียกเก็บเพิ่มแทน
  it("calculates an amount due when charges exceed the deposit", () => {
    expect(calculateDepositSettlement(2000, [{ label: "ค่าเสียหาย", amount: 2500 }], 300)).toEqual({
      deductionAmount: 2500,
      refundAmount: 0,
      amountDue: 800,
    });
  });

  // ย้ายห้องต้องมีห้องปลายทาง ส่วนย้ายออกส่งมาไม่ได้ เพราะไม่มีห้องให้ย้ายไป
  it("requires a destination only for room moves", () => {
    expect(occupancyTransitionSchema.safeParse({ type: "MOVE_ROOM", effectiveDate: "2026-08-01", reason: "เปลี่ยนห้อง", deductions: [] }).success).toBe(false);
    expect(occupancyTransitionSchema.safeParse({ type: "MOVE_OUT", destinationRoomId: "cm000000000000000000001", effectiveDate: "2026-08-01", reason: "ย้ายออก", deductions: [] }).success).toBe(false);
  });
});
