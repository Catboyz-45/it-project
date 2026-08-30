/**
 * หน้าที่ของไฟล์นี้: API /api/admin/content/[kind]/[id] รองรับ GET, PATCH; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { ContentService } from "@/server/cms/content.service";
import { auditCmsFailure, cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { contentKindSchema } from "@/server/cms/schemas";
import { requestContext } from "@/server/security/request";
import { invalidatePublicContent } from "@/server/services/public-cache";

const service = new ContentService();
/** จุดเริ่มของคำขอ HTTP GET: อ่านข้อมูลโดยไม่แก้ไขข้อมูล และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { const values = await params; const record = await service.get(contentKindSchema.parse(values.kind), values.id); return record ? NextResponse.json({ record }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 }); } catch (error) { return cmsError(error); }
}
/** จุดเริ่มของคำขอ HTTP PATCH: แก้เฉพาะช่องที่ส่งมา และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const context = requestContext(request); const values = await params; let kind: ReturnType<typeof contentKindSchema.parse> | undefined;
  try { kind = contentKindSchema.parse(values.kind); const record = await service.update(kind, values.id, await request.json(), { id: session.adminId, role: session.admin.role }, context, request.headers.get("if-unmodified-since")); invalidatePublicContent(kind); return NextResponse.json({ record }); } catch (error) { await auditCmsFailure({ actorId: session.adminId, action: "CONTENT_UPDATE_FAILED", kind, targetId: values.id, context, error }); return cmsError(error, context.requestId); }
}
