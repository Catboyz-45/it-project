// หน้าบิลยังโต้ตอบเยอะ (กางรายละเอียด ส่งสลิป) แผงจึงยังเป็น Client Component
// แต่รายการหน้าแรกดึงบนเซิร์ฟเวอร์แล้วส่งลงไปกับ HTML เบราว์เซอร์จึงไม่ต้องยิงซ้ำ
import { cookies } from "next/headers";
import { TenantSectionPanel } from "@/components/tenant/TenantPortal";
import { requirePageAuth } from "@/lib/server/auth";
import { findActiveOccupancyForPage, tenantOccupancyCookieName } from "@/lib/server/tenant-auth";
import { listTenantInvoices } from "@/lib/server/tenant-portal";

export default async function TenantInvoicesPage() {
  const auth = await requirePageAuth();
  const selectedId = (await cookies()).get(tenantOccupancyCookieName)?.value;
  const occupancy = auth.tenantProfileId
    ? await findActiveOccupancyForPage(auth.tenantProfileId, selectedId)
    : null;
  // บิลเป็นของผู้เช่าหลักเท่านั้น ผู้พักร่วมให้แผงอธิบายเอง ไม่ต้องถามฐานข้อมูล
  if (!occupancy || !auth.tenantProfileId || occupancy.role !== "PRIMARY") {
    return <TenantSectionPanel tab="invoices" />;
  }

  // ดึงเฉพาะมุมมองปัจจุบันซึ่งเป็นแท็บที่เปิดมาก่อน ประวัติค่อยโหลดตอนกด
  const current = await listTenantInvoices(auth.tenantProfileId, occupancy.roomId, occupancy.role, { page: 1, pageSize: 20 });
  return <TenantSectionPanel
    initialInvoices={{
      // ปกติข้อมูลเดินทางผ่าน JSON วันที่กับ Decimal จึงถึงหน้าจอเป็นสตริง
      current: {
        data: JSON.parse(JSON.stringify(current.data)),
        hasNextPage: current.pageInfo.hasNextPage,
        total: current.pageInfo.total ?? null,
      },
    }}
    tab="invoices"
  />;
}
