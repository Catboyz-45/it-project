/**
 * หน้าที่ของไฟล์นี้: API /api/admin/media/[id] รองรับ PATCH, DELETE; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { trashMedia, updateMediaAltText } from "@/server/media/service";
import { audit } from "@/server/auth/audit";
import { requestContext } from "@/server/security/request";
import { updateMediaAltTextSchema } from "@/server/media/validation";

/** จุดเริ่มของคำขอ HTTP PATCH: แก้เฉพาะช่องที่ส่งมา และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await cmsSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request))
    return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try {
    const input = updateMediaAltTextSchema.parse(await request.json());
    const id = (await params).id;
    const updated = await updateMediaAltText(id, input.altText);
    await audit({
      actorId: session.adminId,
      action: "MEDIA_ALT_TEXT_UPDATED",
      targetType: "Media",
      targetId: id,
      result: "SUCCESS",
      ...requestContext(request),
    });
    return NextResponse.json(updated, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return cmsError(error);
  }
}

/** จุดเริ่มของคำขอ HTTP DELETE: ลบหรือย้ายข้อมูลออกตามกฎ retention และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await cmsSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request))
    return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try {
    const id = (await params).id;
    await trashMedia(id);
    await audit({
      actorId: session.adminId,
      action: "MEDIA_TRASHED",
      targetType: "Media",
      targetId: id,
      result: "SUCCESS",
      ...requestContext(request),
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return cmsError(error);
  }
}
