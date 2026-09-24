import { z } from "zod";
import { paymentSubmissionStatusSchema } from "@/lib/domain/enums";

export const paymentInvoiceIdSchema = z.cuid();

// ตรวจผลการตรวจหลักฐานการชำระ
export const paymentReviewSchema = z.object({
  // เอาเฉพาะสองค่านี้จากรายการสถานะเต็ม เพราะ PENDING_REVIEW เป็นค่าตั้งต้น ไม่ใช่ผลการตรวจ
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

// รูปแบบของ QR ชำระเงินตามมาตรฐาน EMVCo ทุกช่องเขียนเป็น รหัส + ความยาวสองหลัก + ค่า
const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

// CRC-16/CCITT-FALSE ตามที่มาตรฐานกำหนด แอปธนาคารใช้ค่านี้ตรวจว่า QR ไม่ถูกแก้ระหว่างทาง
// 0xffff คือค่าตั้งต้น ส่วน 0x1021 คือ polynomial ทั้งสองค่ามาจากมาตรฐาน ห้ามเปลี่ยน
function crc16(value: string) {
  let crc = 0xffff;
  for (const character of new TextEncoder().encode(value)) {
    crc ^= character << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// สร้างข้อความสำหรับ QR พร้อมเพย์ ให้ผู้เช่าสแกนจ่ายได้ตรงยอด
export function createPromptPayPayload(promptPayId: string, amount: number) {
  // ตัดขีดกับช่องว่างออกก่อน ผู้ใช้กรอกเบอร์มาได้หลายรูปแบบ
  const digits = promptPayId.replace(/\D/g, "");
  let target: string;
  let targetTag: "01" | "02";
  // เบอร์ไทย 10 หลัก ต้องแปลงเป็นรูปแบบสากล ตัด 0 หน้าแล้วเติมรหัสประเทศ 0066
  if (/^0\d{9}$/.test(digits)) {
    target = `0066${digits.slice(1)}`;
    targetTag = "01";
  // 13 หลักคือเลขประจำตัวประชาชนหรือเลขผู้เสียภาษี ใช้เป็นตัวรับได้เหมือนกัน แต่คนละรหัสช่อง
  } else if (/^\d{13}$/.test(digits)) {
    target = digits;
    targetTag = "02";
  } else {
    throw new Error("PromptPay ID must be a Thai phone number or 13-digit identifier");
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new Error("Invalid PromptPay amount");
  // A000000677010111 คือรหัสประจำระบบพร้อมเพย์ที่มาตรฐานกำหนดไว้ตายตัว
  const merchant = field("00", "A000000677010111") + field(targetTag, target);
  const withoutCrc = [
    field("00", "01"),
    field("01", "12"),
    field("29", merchant),
    // 764 คือรหัสสกุลเงินบาทตาม ISO 4217 และ TH คือรหัสประเทศ
    field("53", "764"),
    field("54", amount.toFixed(2)),
    field("58", "TH"),
    // "6304" คือหัวของช่อง CRC ต้องรวมเข้าไปก่อนคำนวณ แล้วค่อยต่อค่า CRC ท้ายสุด
    "6304",
  ].join("");
  return `${withoutCrc}${crc16(withoutCrc)}`;
}
