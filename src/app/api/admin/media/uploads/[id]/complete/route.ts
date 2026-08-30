/**
 * หน้าที่ของไฟล์นี้: API /api/admin/media/uploads/[id]/complete รองรับ POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { completeUpload } from "@/server/media/service";
import { audit } from "@/server/auth/audit";
import { requestContext } from "@/server/security/request";

export const maxDuration = 60;
/** จุดเริ่มของคำขอ HTTP POST: สร้างข้อมูลหรือสั่งให้เกิดการทำงาน และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await cmsSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const mediaId = await completeUpload((await params).id, session.adminId); await audit({ actorId: session.adminId, action: "MEDIA_UPLOAD_COMPLETED", targetType: "Media", targetId: mediaId, result: "SUCCESS", ...requestContext(request) }); return NextResponse.json({ mediaId }); }
  catch (error) { return cmsError(error); }
}
