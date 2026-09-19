import type { DocumentData } from "@/lib/documents/placeholders";
import type { DocumentKind } from "@/lib/documents/types";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

// หาข้อมูลจริงจากหอนั้นมาใช้ดูตัวอย่างเอกสาร ไม่ใช้ข้อมูลสมมติ
// เจ้าของหอจะได้เห็นว่าเอกสารจริงหน้าตาเป็นยังไงกับข้อมูลของตัวเอง
export async function getDocumentPreviewData(
  propertyId: string,
  kind: DocumentKind,
): Promise<DocumentData> {
  if (kind === "contract") {
    const lease = await getDatabase().lease.findFirst({
      where: { propertyId },
      // เอาสัญญาที่แก้ล่าสุด เพราะน่าจะเป็นฉบับที่เจ้าของหอกำลังสนใจอยู่
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: {
        property: { select: { name: true } },
        room: { select: { number: true } },
        tenants: {
          // เอาผู้เช่าหลักคนเดียว เพราะชื่อบนสัญญาคือคนนั้น
          orderBy: { isPrimary: "desc" },
          take: 1,
          include: {
            occupancy: {
              include: {
                tenantProfile: {
                  include: { user: { select: { displayName: true } } },
                },
              },
            },
          },
        },
      },
    });
    const tenant = lease?.tenants[0]?.occupancy.tenantProfile;
    // ยังไม่มีสัญญาเลยก็ดูตัวอย่างไม่ได้ บอกไปตรง ๆ ว่าต้องไปสร้างก่อน
    if (!lease || !tenant) throw new ApiError(409, "กรุณาสร้างสัญญาที่มีผู้เช่าก่อนดูตัวอย่าง");
    return {
      reference_id: lease.leaseNumber,
      property_name: lease.property.name,
      room_number: lease.room.number,
      tenant_name: tenant.user.displayName,
      tenant_phone: tenant.phone,
      tenant_address: tenant.address ?? "",
      start_date: lease.startDate.toISOString().slice(0, 10),
      end_date: lease.endDate.toISOString().slice(0, 10),
      rent_amount: Number(lease.monthlyRent),
      deposit_amount: Number(lease.depositAmount),
    };
  }

  const invoice = await getDatabase().invoice.findFirst({
    where: { propertyId },
    orderBy: [{ billingMonth: "desc" }, { id: "desc" }],
    include: {
      property: { select: { name: true } },
      room: {
        select: {
          number: true,
          occupancies: {
            where: { status: "ACTIVE", role: "PRIMARY" },
            take: 1,
            include: { tenantProfile: { include: { user: { select: { displayName: true } } } } },
          },
        },
      },
      items: true,
    },
  });
  if (!invoice) throw new ApiError(409, "กรุณาสร้างบิลก่อนดูตัวอย่าง");
  const amount = (types: string[]) => invoice.items
    .filter((item) => types.includes(item.type))
    .reduce((sum, item) => sum + Number(item.amount), 0);
  return {
    reference_id: invoice.invoiceNumber,
    property_name: invoice.property.name,
    room_number: invoice.room.number,
    tenant_name: invoice.room.occupancies[0]?.tenantProfile.user.displayName ?? "ไม่พบผู้เช่าปัจจุบัน",
    billing_month: invoice.billingMonth.toLocaleDateString("th-TH", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    rent_amount: amount(["RENT"]),
    water_amount: amount(["WATER"]),
    electricity_amount: amount(["ELECTRICITY"]),
    service_amount: amount(["SERVICE", "OTHER"]),
    total_amount: Number(invoice.total),
  };
}
