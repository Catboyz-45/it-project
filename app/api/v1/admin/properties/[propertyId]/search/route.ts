import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getDatabase } from "@/lib/server/db";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// ค้นรวมทั้งหอ ผู้เช่า ห้อง บิล และสัญญาในคำขอเดียว
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
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
