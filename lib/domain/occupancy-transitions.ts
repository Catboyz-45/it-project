import { z } from "zod";

// กฎของช่องจำนวนเงิน finite กัน Infinity กับ NaN ส่วนเพดานกันกรอกเกินจริงจนผิดสังเกต
const money = z.coerce.number().finite().min(0).max(10_000_000);

export const occupancyTransitionSchema = z.object({
  type: z.enum(["MOVE_OUT", "MOVE_ROOM"]),
  destinationRoomId: z.string().cuid().optional(),
  effectiveDate: z.coerce.date(),
  reason: z.string().trim().min(1).max(500),
  deductions: z.array(z.object({
    label: z.string().trim().min(1).max(160),
    amount: money,
  // จำกัด 30 รายการ กันส่งรายการยาวมาถล่มเซิร์ฟเวอร์
  }).strict()).max(30).default([]),
  settlementNote: z.string().trim().max(1000).optional(),
// superRefine เพราะเงื่อนไขขึ้นกับความสัมพันธ์ระหว่างสองฟิลด์ ตรวจทีละฟิลด์ไม่พอ
}).strict().superRefine((input, context) => {
  if (input.type === "MOVE_ROOM" && !input.destinationRoomId) {
    context.addIssue({ code: "custom", path: ["destinationRoomId"], message: "กรุณาเลือกห้องปลายทาง" });
  }
  // ย้ายออกแล้วส่งห้องปลายทางมาแปลว่าฝั่งที่เรียกเข้าใจผิด ปฏิเสธไปเลยดีกว่าทำงานต่อแบบมั่ว
  if (input.type === "MOVE_OUT" && input.destinationRoomId) {
    context.addIssue({ code: "custom", path: ["destinationRoomId"], message: "การย้ายออกต้องไม่มีห้องปลายทาง" });
  }
});

export type DepositDeduction = { label: string; amount: number };

// สรุปเงินประกันตอนย้ายออก เอาเงินประกันตั้ง ลบรายการหัก ลบบิลที่ค้าง
// เหลือเป็นบวกคือคืนผู้เช่า ติดลบคือต้องเรียกเก็บเพิ่ม
export function calculateDepositSettlement(
  depositAmount: number,
  deductions: DepositDeduction[],
  outstandingAmount: number,
) {
  const deductionAmount = deductions.reduce((total, item) => total + item.amount, 0);
  const balance = depositAmount - deductionAmount - outstandingAmount;
  return {
    deductionAmount,
    // แยกเป็นสองค่าที่ไม่ติดลบ ผู้เรียกจะได้ไม่ต้องมาเช็คเครื่องหมายเอง
    refundAmount: Math.max(balance, 0),
    amountDue: Math.max(-balance, 0),
  };
}
