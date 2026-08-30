/**
 * หน้าที่ของไฟล์นี้: API /api/admin/content/[kind] รองรับ GET, POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
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
export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { const kind = contentKindSchema.parse((await params).kind); return NextResponse.json(await service.list(kind, Object.fromEntries(request.nextUrl.searchParams))); } catch (error) { return cmsError(error); }
}
/** จุดเริ่มของคำขอ HTTP POST: สร้างข้อมูลหรือสั่งให้เกิดการทำงาน และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const context = requestContext(request); let kind: ReturnType<typeof contentKindSchema.parse> | undefined;
  try { kind = contentKindSchema.parse((await params).kind); const record = await service.create(kind, await request.json(), { id: session.adminId, role: session.admin.role }, context); invalidatePublicContent(kind); return NextResponse.json({ record }, { status: 201 }); } catch (error) { await auditCmsFailure({ actorId: session.adminId, action: "CONTENT_CREATE_FAILED", kind, context, error }); return cmsError(error, context.requestId); }
}
