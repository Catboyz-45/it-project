/**
 * หน้าที่ของไฟล์นี้: API /api/admin/company รองรับ GET, PATCH; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { companyInputSchema } from "@/server/services/company.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { requestContext } from "@/server/security/request";
import { invalidatePublicContent } from "@/server/services/public-cache";
/** จุดเริ่มของคำขอ HTTP GET: อ่านข้อมูลโดยไม่แก้ไขข้อมูล และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function GET() { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const company = await db.company.findUnique({ where: { singletonKey: "PRIMARY" } }); return NextResponse.json({ company }, { headers: { "Cache-Control": "no-store" } }); }
/** จุดเริ่มของคำขอ HTTP PATCH: แก้เฉพาะช่องที่ส่งมา และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function PATCH(request: NextRequest) {
  const session = await cmsSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try {
    const data = companyInputSchema.parse(await request.json());
    const expectedUpdatedAt = request.headers.get("if-unmodified-since");
    if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) {
      return NextResponse.json({ error: "ไม่พบเวอร์ชันข้อมูล กรุณาโหลดหน้าใหม่ก่อนบันทึก" }, { status: 428 });
    }
    const context = requestContext(request);
    const company = await db.$transaction(async tx => {
      const current = await tx.company.findUnique({ where: { singletonKey: "PRIMARY" }, select: { id: true } });
      if (!current) throw new Error("COMPANY_NOT_FOUND");
      if (data.logoMediaId) {
        const logo = await tx.media.findFirst({ where: { id: data.logoMediaId, kind: "IMAGE", status: "READY", deletedAt: null }, select: { id: true } });
        if (!logo) throw new Error("INVALID_COMPANY_LOGO");
        await tx.media.update({ where: { id: logo.id }, data: { orphanExpiresAt: null } });
      }
      const updated = await tx.company.updateMany({
        where: { id: current.id, updatedAt: new Date(expectedUpdatedAt) },
        data,
      });
      if (updated.count !== 1) throw new Error("COMPANY_STALE_WRITE");
      const record = await tx.company.findUniqueOrThrow({ where: { id: current.id } });
      await tx.auditLog.create({ data: { actorId: session.adminId, action: "COMPANY_UPDATED", targetType: "Company", targetId: record.id, result: "SUCCESS", requestId: context.requestId, userAgent: context.userAgent, metadata: context.ipHash ? { ipHash: context.ipHash } : undefined } });
      return record;
    });
    invalidatePublicContent();
    return NextResponse.json({ company });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_STALE_WRITE") {
      return NextResponse.json({ error: "ข้อมูลถูกแก้ไขโดยผู้ดูแลคนอื่นแล้ว กรุณาโหลดหน้าใหม่และตรวจสอบข้อมูลก่อนบันทึก" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return NextResponse.json({ error: "ไม่พบข้อมูลบริษัท กรุณาติดต่อผู้ดูแลระบบ" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INVALID_COMPANY_LOGO") {
      return NextResponse.json({ error: "ไฟล์โลโก้ไม่พร้อมใช้งานหรือชนิดไฟล์ไม่ถูกต้อง" }, { status: 422 });
    }
    return cmsError(error);
  }
}
