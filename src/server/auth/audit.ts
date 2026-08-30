/**
 * หน้าที่ของไฟล์นี้: ตรรกะยืนยันตัวตน audit ทำงานเฉพาะฝั่งเซิร์ฟเวอร์เพื่อดูแลบัญชี เซสชัน 2FA หรือสิทธิ์อย่างปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { db } from "@/server/db";

/** บันทึกเหตุการณ์ผ่าน audit เพื่อให้ตรวจสอบย้อนหลังได้ โดยไม่ควรใส่รหัสผ่านหรือ token */
export async function audit(input: { actorId?: string | null; action: string; targetType?: string; targetId?: string; result: "SUCCESS" | "FAILURE"; requestId?: string; ipHash?: string; userAgent?: string | null; errorCode?: string; metadata?: Record<string, string | number | boolean> }) {
  await db.auditLog.create({ data: { actorId: input.actorId, action: input.action, targetType: input.targetType, targetId: input.targetId, result: input.result, requestId: input.requestId, userAgent: input.userAgent, errorCode: input.errorCode, metadata: { ...(input.metadata ?? {}), ...(input.ipHash ? { ipHash: input.ipHash } : {}) } } }).catch(() => undefined);
}
