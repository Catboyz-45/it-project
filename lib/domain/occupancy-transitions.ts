/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “occupancy transitions” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { z } from "zod";

const money = z.coerce.number().finite().min(0).max(10_000_000);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “occupancy Transition Schema” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export const occupancyTransitionSchema = z.object({
  type: z.enum(["MOVE_OUT", "MOVE_ROOM"]),
  destinationRoomId: z.string().cuid().optional(),
  effectiveDate: z.coerce.date(),
  reason: z.string().trim().min(1).max(500),
  deductions: z.array(z.object({
    label: z.string().trim().min(1).max(160),
    amount: money,
  }).strict()).max(30).default([]),
  settlementNote: z.string().trim().max(1000).optional(),
}).strict().superRefine((input, context) => {
  if (input.type === "MOVE_ROOM" && !input.destinationRoomId) {
    context.addIssue({ code: "custom", path: ["destinationRoomId"], message: "กรุณาเลือกห้องปลายทาง" });
  }
  if (input.type === "MOVE_OUT" && input.destinationRoomId) {
    context.addIssue({ code: "custom", path: ["destinationRoomId"], message: "การย้ายออกต้องไม่มีห้องปลายทาง" });
  }
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Deposit Deduction” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type DepositDeduction = { label: string; amount: number };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกอบหรือคำนวณผลลัพธ์ของ “calculate Deposit Settlement” จากข้อมูลที่ได้รับ
 * รับค่า:
 * - depositAmount: ค่า “deposit Amount” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - deductions: ค่า “deductions” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - outstandingAmount: ค่า “outstanding Amount” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function calculateDepositSettlement(
  depositAmount: number,
  deductions: DepositDeduction[],
  outstandingAmount: number,
) {
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “deduction Amount” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - total: ค่า “total” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const deductionAmount = deductions.reduce((total, item) => total + item.amount, 0);
  const balance = depositAmount - deductionAmount - outstandingAmount;
  return {
    deductionAmount,
    refundAmount: Math.max(balance, 0),
    amountDue: Math.max(-balance, 0),
  };
}
