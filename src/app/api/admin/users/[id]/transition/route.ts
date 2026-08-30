/**
 * หน้าที่ของไฟล์นี้: API /api/admin/users/[id]/transition รองรับ POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentSession } from "@/server/auth/session";
import { permanentlyDeleteAdmin, restoreAdmin, trashAdmin } from "@/server/auth/admin-users";
import { audit } from "@/server/auth/audit";
import { assertSameOrigin, requestContext } from "@/server/security/request";

const schema = z.object({ action: z.enum(["trash", "restore", "delete"]) }).strict();
const messages: Record<string, string> = {
  LAST_SUPER_ADMIN: "ไม่สามารถย้าย Super Admin คนสุดท้ายลงถังขยะได้",
  SELF_ADMIN_OPERATION: "ไม่สามารถย้ายหรือลบบัญชีที่กำลังใช้งานอยู่ได้",
  ADMIN_ALREADY_TRASHED: "บัญชีอยู่ในถังขยะแล้ว",
  ADMIN_NOT_TRASHED: "บัญชีไม่ได้อยู่ในถังขยะ",
};

/** จุดเริ่มของคำขอ HTTP POST: สร้างข้อมูลหรือสั่งให้เกิดการทำงาน และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await currentSession();
  if (!session?.twoFactorAt || session.admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const id = (await params).id;
  const action = parsed.data.action;
  const auditAction = action === "trash" ? "ADMIN_TRASHED" : action === "restore" ? "ADMIN_RESTORED" : "ADMIN_DELETED_PERMANENTLY";
  try {
    if (action === "trash") await trashAdmin(id, session.adminId);
    else if (action === "restore") await restoreAdmin(id);
    else await permanentlyDeleteAdmin(id, session.adminId);
    await audit({ actorId: session.adminId, action: auditAction, targetType: "Admin", targetId: id, result: "SUCCESS", ...requestContext(request) });
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    await audit({ actorId: session.adminId, action: auditAction, targetType: "Admin", targetId: id, result: "FAILURE", errorCode: code, ...requestContext(request) });
    return NextResponse.json({ error: messages[code] ?? "ไม่สามารถดำเนินการได้" }, { status: 409 });
  }
}
