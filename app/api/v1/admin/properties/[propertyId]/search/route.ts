/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/admin/properties/[propertyId]/search สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string }> };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const query = z.string().trim().min(2).max(100).parse(request.nextUrl.searchParams.get("query"));
    const contains = { contains: query, mode: "insensitive" as const };
    const [rooms, tenants, invoices, leases] = await Promise.all([
      getDatabase().room.findMany({ where: { propertyId, number: contains }, take: 5, select: { id: true, number: true, status: true } }),
      getDatabase().tenantProfile.findMany({ where: { occupancies: { some: { propertyId } }, OR: [{ user: { displayName: contains } }, { user: { email: contains } }, { phone: contains }] }, take: 5, select: { id: true, phone: true, user: { select: { displayName: true } }, occupancies: { where: { propertyId, status: { in: ["ACTIVE", "PENDING"] } }, take: 1, select: { room: { select: { number: true } } } } } }),
      getDatabase().invoice.findMany({ where: { propertyId, OR: [{ invoiceNumber: contains }, { room: { number: contains } }] }, take: 5, select: { id: true, invoiceNumber: true, status: true, total: true, room: { select: { number: true } } } }),
      getDatabase().lease.findMany({ where: { propertyId, OR: [{ leaseNumber: contains }, { room: { number: contains } }] }, take: 5, select: { id: true, leaseNumber: true, status: true, room: { select: { number: true } } } }),
    ]);
    return NextResponse.json({ data: [
      ...rooms.map((r) => ({ id: r.id, type: "room", title: `ห้อง ${r.number}`, subtitle: r.status, href: `/admin/properties/${propertyId}/rooms` })),
      ...tenants.map((t) => ({ id: t.id, type: "tenant", title: t.user.displayName, subtitle: `${t.occupancies[0]?.room.number ? `ห้อง ${t.occupancies[0].room.number} · ` : ""}${t.phone}`, href: `/admin/properties/${propertyId}/tenants` })),
      ...invoices.map((i) => ({ id: i.id, type: "invoice", title: i.invoiceNumber, subtitle: `ห้อง ${i.room.number} · ฿${i.total.toString()} · ${i.status}`, href: `/admin/properties/${propertyId}/invoices` })),
      ...leases.map((l) => ({ id: l.id, type: "lease", title: l.leaseNumber, subtitle: `ห้อง ${l.room.number} · ${l.status}`, href: `/admin/properties/${propertyId}/contracts` })),
    ] });
  } catch (error) { return apiErrorResponse(error, request); }
}
