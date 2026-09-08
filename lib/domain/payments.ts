/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “payments” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { z } from "zod";
import { paymentSubmissionStatusSchema } from "@/lib/domain/enums";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “payment Invoice Id Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const paymentInvoiceIdSchema = z.string().cuid();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “payment Review Schema” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export const paymentReviewSchema = z.object({
  status: paymentSubmissionStatusSchema.extract(["APPROVED", "REJECTED"]),
  rejectionNote: z.string().trim().min(1).max(500).optional(),
}).strict().superRefine((value, context) => {
  if (value.status === "REJECTED" && !value.rejectionNote) {
    context.addIssue({ code: "custom", message: "กรุณาระบุเหตุผลที่ปฏิเสธ", path: ["rejectionNote"] });
  }
  if (value.status === "APPROVED" && value.rejectionNote) {
    context.addIssue({ code: "custom", message: "รายการที่อนุมัติไม่ควรมีเหตุผลปฏิเสธ", path: ["rejectionNote"] });
  }
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “field” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - id: ค่า “id” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “crc16” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function crc16(value: string) {
  let crc = 0xffff;
  for (const character of new TextEncoder().encode(value)) {
    crc ^= character << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Prompt Pay Payload” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - promptPayId: รหัสภายในของ prompt Pay
 * - amount: ค่า “amount” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function createPromptPayPayload(promptPayId: string, amount: number) {
  const digits = promptPayId.replace(/\D/g, "");
  let target: string;
  let targetTag: "01" | "02";
  if (/^0\d{9}$/.test(digits)) {
    target = `0066${digits.slice(1)}`;
    targetTag = "01";
  } else if (/^\d{13}$/.test(digits)) {
    target = digits;
    targetTag = "02";
  } else {
    throw new Error("PromptPay ID must be a Thai phone number or 13-digit identifier");
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new Error("Invalid PromptPay amount");
  const merchant = field("00", "A000000677010111") + field(targetTag, target);
  const withoutCrc = [
    field("00", "01"),
    field("01", "12"),
    field("29", merchant),
    field("53", "764"),
    field("54", amount.toFixed(2)),
    field("58", "TH"),
    "6304",
  ].join("");
  return `${withoutCrc}${crc16(withoutCrc)}`;
}
