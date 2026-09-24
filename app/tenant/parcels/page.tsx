// หน้าพัสดุ render บนเซิร์ฟเวอร์ทั้งหน้า เหลือเป็น JavaScript แค่แท็บกับปุ่มโหลดเพิ่ม
// มุมมองที่เลือกเก็บไว้ใน URL จึงกดย้อนกลับและแชร์ลิงก์ได้
import { cookies } from "next/headers";
import { Package } from "lucide-react";
import { LoadMoreParcels } from "@/components/tenant/LoadMoreList";
import { ParcelCard, ParcelHistoryTable, type TenantParcel } from "@/components/tenant/ParcelViews";
import { RecordViewTabs } from "@/components/tenant/RecordViewTabs";
import { Empty } from "@/components/tenant/primitives";
import { requirePageAuth } from "@/lib/server/auth";
import { listTenantParcels } from "@/lib/server/property-operations";
import { findActiveOccupancyForPage, tenantOccupancyCookieName } from "@/lib/server/tenant-auth";
import { TENANT_RECORD_VIEW_IDS, type TenantRecordView } from "@/lib/tenant-record-view";

const pageSize = 20;

export default async function TenantParcelsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ view?: string }>;
}>) {
  const auth = await requirePageAuth();
  const selectedId = (await cookies()).get(tenantOccupancyCookieName)?.value;
  const occupancy = auth.tenantProfileId
    ? await findActiveOccupancyForPage(auth.tenantProfileId, selectedId)
    : null;
  if (!occupancy || !auth.tenantProfileId) {
    return <Empty description="เมื่อเจ้าของหออนุมัติการเข้าพักแล้ว พัสดุจะมาแสดงที่นี่" icon={<Package />} text="ยังไม่มีข้อมูลการเข้าพัก" />;
  }

  // ค่ามาจาก URL ที่ผู้ใช้พิมพ์เองได้ ไม่อยู่ในรายการที่รู้จักก็ตกไปที่ปัจจุบัน
  const requested = (await searchParams).view;
  const view: TenantRecordView = TENANT_RECORD_VIEW_IDS.includes(requested as TenantRecordView)
    ? requested as TenantRecordView
    : "current";
  const result = await listTenantParcels(auth.tenantProfileId, occupancy.roomId, { page: 1, pageSize }, view);
  const items = result.data as unknown as TenantParcel[];

  return <div className="grid gap-5">
    <RecordViewTabs currentLabel="พัสดุรอรับ" historyLabel="ประวัติการรับ" id="tenant-parcels" path="/tenant/parcels" view={view} />
    <div aria-labelledby={`tenant-parcels-tab-${view}`} id="tenant-parcels-panel" role="tabpanel" tabIndex={0}>
      {view === "history"
        ? <div className="grid gap-5"><ParcelHistoryTable items={items} total={result.pageInfo.total ?? null} /></div>
        : <ParcelWaitingList hasNextPage={result.pageInfo.hasNextPage} items={items} pageSize={pageSize} />}
    </div>
  </div>;
}

// รายการพัสดุที่ยังรอรับ ไม่มีเลยก็บอกว่ายังไม่มี ไม่ใช่โชว์กล่องเปล่า
function ParcelWaitingList({ hasNextPage, items, pageSize }: Readonly<{
  hasNextPage: boolean;
  items: Array<Parameters<typeof ParcelCard>[0] & { id: string }>;
  pageSize: number;
}>) {
  if (items.length === 0) return <Empty description="พัสดุที่หอรับไว้ให้จะมาแสดงที่นี่" icon={<Package />} text="ไม่มีพัสดุรอรับ" />;
  return <div className="grid gap-5">
    {items.map((item) => <ParcelCard key={item.id} {...item} />)}
    <LoadMoreParcels initialCount={items.length} initialHasNextPage={hasNextPage} pageSize={pageSize} />
  </div>;
}
