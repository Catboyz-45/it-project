/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “audit” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Audit Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type AuditInput = {
  request: NextRequest;
  requestId?: string;
  userId?: string;
  propertyId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  result: "SUCCESS" | "FAILURE";
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “write Audit Log Unsafe” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function writeAuditLogUnsafe(input: AuditInput) {
  const forwarded = input.request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  await getDatabase().auditLog.create({
    data: {
      userId: input.userId,
      propertyId: input.propertyId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      result: input.result,
      requestId: input.requestId?.slice(0, 80)
        || input.request.headers.get("x-request-id")?.slice(0, 80)
        || randomUUID(),
      ipAddress: forwarded?.slice(0, 64),
      userAgent: input.request.headers.get("user-agent")?.slice(0, 500),
    },
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “write Audit Log” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function writeAuditLog(input: AuditInput) {
  try {
    await writeAuditLogUnsafe(input);
  } catch (error) {
    if (input.propertyId) {
      try {
        await writeAuditLogUnsafe({ ...input, propertyId: undefined });
        return;
      } catch {
        // Fall through to structured logging.
      }
    }
    console.error(JSON.stringify({
      level: "error",
      event: "audit_log_failed",
      requestId: input.request.headers.get("x-request-id"),
      action: input.action,
      message: error instanceof Error ? error.message : "Unknown error",
    }));
  }
}

export const writeAuditLogSafely = writeAuditLog;
