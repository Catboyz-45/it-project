/**
 * หน้าที่ของไฟล์นี้: API /api/admin/content/[kind]/[id]/transition รองรับ POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { ContentService } from "@/server/cms/content.service";
import { auditCmsFailure, cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { contentKindSchema, transitionSchema } from "@/server/cms/schemas";
import { requestContext } from "@/server/security/request";
import { invalidatePublicContent } from "@/server/services/public-cache";

const service = new ContentService();
/** จุดเริ่มของคำขอ HTTP POST: สร้างข้อมูลหรือสั่งให้เกิดการทำงาน และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const context = requestContext(request); const values = await params; let kind: ReturnType<typeof contentKindSchema.parse> | undefined; let attemptedAction = "UNKNOWN";
  try { kind = contentKindSchema.parse(values.kind); const parsed = transitionSchema.parse(await request.json()); attemptedAction = parsed.action.toUpperCase(); const result = await service.transition(kind, values.id, parsed.action, { id: session.adminId, role: session.admin.role }, context); invalidatePublicContent(kind); return NextResponse.json(result); } catch (error) { await auditCmsFailure({ actorId: session.adminId, action: `CONTENT_${attemptedAction}_FAILED`, kind, targetId: values.id, context, error }); return cmsError(error, context.requestId); }
}
