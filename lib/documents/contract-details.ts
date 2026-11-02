import type { ContractDocumentData } from "@/lib/documents/placeholders";
import { thaiBahtText } from "@/lib/documents/thai-baht-text";
import { getDatabase } from "@/lib/server/db";

// เติมข้อมูลที่สัญญาจริงต้องใช้แต่หน้าเว็บไม่ได้ส่งมา โดยอ่านจากฐานข้อมูลของหอนั้นเอง
// หาสัญญาจากเลขที่สัญญาภายในหอเดียวกันเท่านั้น จึงไม่มีทางดึงข้อมูลข้ามหอ
export async function withContractDetails(propertyId: string, data: ContractDocumentData): Promise<ContractDocumentData> {
  const database = getDatabase();
  const [settings, lease] = await Promise.all([
    database.propertySettings.findUnique({
      where: { propertyId },
      select: { address: true, contactPhone: true, dueDay: true, electricityUnitRate: true, legalName: true, lessorName: true, waterUnitRate: true },
    }),
    database.lease.findFirst({
      where: { propertyId, leaseNumber: data.reference_id },
      select: {
        activatedAt: true,
        createdAt: true,
        room: {
          select: {
            furnitureItems: {
              orderBy: { furnitureOption: { name: "asc" } },
              select: { quantity: true, furnitureOption: { select: { name: true } } },
            },
          },
        },
        tenants: {
          orderBy: { isPrimary: "desc" },
          take: 1,
          select: { occupancy: { select: { tenantProfile: { select: { address: true, phone: true } } } } },
        },
      },
    }),
  ]);
  const tenant = lease?.tenants[0]?.occupancy.tenantProfile;
  // วันที่ทำสัญญาคือวันที่สัญญาเริ่มมีผล ถ้ายังเป็นฉบับร่างก็ใช้วันที่สร้าง
  const contractDate = lease ? (lease.activatedAt ?? lease.createdAt).toISOString().slice(0, 10) : "";
  const furniture = lease?.room.furnitureItems
    .map((item) => item.quantity > 1 ? `${item.furnitureOption.name} ${item.quantity} ชิ้น` : item.furnitureOption.name)
    .join(", ");

  return {
    ...data,
    // หน้าสัญญาส่งเบอร์กับที่อยู่มาว่าง เติมจากโปรไฟล์ผู้เช่าหลัก แต่ถ้าส่งมาแล้วก็ใช้ของที่ส่งมา
    tenant_phone: data.tenant_phone || tenant?.phone || "",
    tenant_address: data.tenant_address || tenant?.address || "",
    lessor_name: settings?.lessorName || settings?.legalName || data.property_name,
    property_address: settings?.address ?? "",
    property_phone: settings?.contactPhone ?? "",
    contract_date: contractDate,
    rent_amount_text: thaiBahtText(data.rent_amount),
    deposit_amount_text: thaiBahtText(data.deposit_amount),
    water_rate: Number(settings?.waterUnitRate ?? 0),
    electricity_rate: Number(settings?.electricityUnitRate ?? 0),
    payment_due_day: settings ? String(settings.dueDay) : "",
    furniture_list: furniture || "-",
  };
}
