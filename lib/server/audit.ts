import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDatabase } from "@/lib/server/db";

// บันทึกว่าใครทำอะไรเมื่อไร ใช้ตามสอบย้อนหลังเวลามีเรื่อง
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

// ตัวเขียนจริง เรียกตรง ๆ ไม่ได้ เพราะไม่ได้ดักข้อผิดพลาดไว้
async function writeAuditLogUnsafe(input: AuditInput) {
  // x-forwarded-for อาจมีหลาย IP ต่อกัน เอาตัวแรกซึ่งเป็นของผู้ใช้จริง
  const forwarded = input.request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  await getDatabase().auditLog.create({
    data: {
      userId: input.userId,
      propertyId: input.propertyId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      result: input.result,
      // ตัดความยาวทุกค่าที่มาจาก header เพราะเป็นข้อมูลที่ผู้ส่งกำหนดเองได้ ไม่ควรให้ยาวเท่าไรก็ได้
      requestId: input.requestId?.slice(0, 80)
        || input.request.headers.get("x-request-id")?.slice(0, 80)
        // ไม่มี requestId มาเลยก็สร้างให้ เพราะทุกรายการต้องอ้างอิงกลับไปที่คำขอได้
        || randomUUID(),
      ipAddress: forwarded?.slice(0, 64),
      userAgent: input.request.headers.get("user-agent")?.slice(0, 500),
    },
  });
}

// ตัวที่เรียกใช้จริง เขียน log ไม่สำเร็จต้องไม่ทำให้งานหลักของผู้ใช้ล้มไปด้วย
export async function writeAuditLog(input: AuditInput) {
  try {
    await writeAuditLogUnsafe(input);
  } catch (error) {
    // สาเหตุที่พบบ่อยคือหอนั้นถูกลบไปแล้วจน foreign key ไม่ผ่าน ลองใหม่โดยไม่ผูกกับหอ
    // ได้บันทึกไว้แบบไม่มีหอ ยังดีกว่าไม่มีบันทึกเลย
    if (input.propertyId) {
      try {
        await writeAuditLogUnsafe({ ...input, propertyId: undefined });
        return;
      } catch {
        // ยังไม่ผ่านอีกก็ตกไปเขียนลง log ของระบบข้างล่างแทน
      }
    }
    // เขียนเป็น JSON บรรทัดเดียว ให้ระบบเก็บ log ค้นหาตามฟิลด์ได้
    // ไม่ใส่ข้อมูลส่วนบุคคลลงไป มีแค่รหัสอ้างอิงกับชื่อการกระทำ
    console.error(JSON.stringify({
      level: "error",
      event: "audit_log_failed",
      requestId: input.request.headers.get("x-request-id"),
      action: input.action,
      message: error instanceof Error ? error.message : "Unknown error",
    }));
  }
}

// ชื่อเดิมที่โค้ดเก่ายังเรียกอยู่ เก็บไว้ให้ไม่ต้องไล่แก้ทุกที่พร้อมกัน
export const writeAuditLogSafely = writeAuditLog;
