/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: ดูแลขั้นตอนสร้างหรือจัดรูปแบบเอกสารในหัวข้อ “preview data”
 * การทำงาน: รับข้อมูลที่ผ่านการตรวจแล้ว สร้างผลลัพธ์เอกสารอย่างสม่ำเสมอ และส่งต่อให้ storage โดยไม่เปิดเผยตำแหน่งไฟล์จริงแก่ผู้ใช้
 */

import type { DocumentData } from "@/lib/documents/placeholders";
import type { DocumentKind } from "@/lib/documents/types";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Document Preview Data” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - kind: ค่า “kind” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<DocumentData> ตามสัญญา TypeScript ของฟังก์ชัน
 */
export async function getDocumentPreviewData(
  propertyId: string,
  kind: DocumentKind,
): Promise<DocumentData> {
  if (kind === "contract") {
    const lease = await getDatabase().lease.findFirst({
      where: { propertyId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: {
        property: { select: { name: true } },
        room: { select: { number: true } },
        tenants: {
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
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “amount” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - types: ค่า “types” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
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
