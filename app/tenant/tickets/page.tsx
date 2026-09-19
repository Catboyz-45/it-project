// หน้าแจ้งเรื่องยังโต้ตอบเยอะ (สร้างเรื่อง ตอบกลับ ขยายแถว) แผงจึงยังเป็น Client Component
// แต่รายการหน้าแรกดึงบนเซิร์ฟเวอร์แล้วส่งลงไปกับ HTML
import { cookies } from "next/headers";
import { TenantSectionPanel } from "@/components/tenant/TenantPortal";
import { requirePageAuth } from "@/lib/server/auth";
import { listTenantTickets } from "@/lib/server/property-operations";
import { findActiveOccupancyForPage, tenantOccupancyCookieName } from "@/lib/server/tenant-auth";

export default async function TenantTicketsPage() {
  const auth = await requirePageAuth();
  const selectedId = (await cookies()).get(tenantOccupancyCookieName)?.value;
  const occupancy = auth.tenantProfileId
    ? await findActiveOccupancyForPage(auth.tenantProfileId, selectedId)
    : null;
  if (!occupancy || !auth.tenantProfileId) return <TenantSectionPanel tab="tickets" />;

  // ดึงเฉพาะมุมมองที่กำลังดำเนินการ ประวัติค่อยโหลดตอนกดแท็บ
  const current = await listTenantTickets(auth.tenantProfileId, auth.userId, { page: 1, pageSize: 20 });
  return <TenantSectionPanel
    initialTickets={{
      current: {
        data: JSON.parse(JSON.stringify(current.data)),
        hasNextPage: current.pageInfo.hasNextPage,
        total: current.pageInfo.total ?? null,
      },
    }}
    tab="tickets"
  />;
}
