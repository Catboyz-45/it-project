// หน้าประกาศ render บนเซิร์ฟเวอร์ รายการหน้าแรกมาพร้อม HTML
// เหลือเป็น JavaScript เฉพาะปุ่มโหลดเพิ่ม ซึ่งผู้ใช้ส่วนใหญ่ไม่ได้กด
import { cookies } from "next/headers";
import { Bell } from "lucide-react";
import { AnnouncementCard } from "@/components/tenant/AnnouncementCard";
import { LoadMoreAnnouncements } from "@/components/tenant/LoadMoreList";
import { Empty } from "@/components/tenant/primitives";
import { requirePageAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { listTenantAnnouncements } from "@/lib/server/property-operations";
import { findActiveOccupancyForPage, tenantOccupancyCookieName } from "@/lib/server/tenant-auth";

const pageSize = 20;

export default async function TenantAnnouncementsPage() {
  const auth = await requirePageAuth();
  const selectedId = (await cookies()).get(tenantOccupancyCookieName)?.value;
  const occupancy = auth.tenantProfileId
    ? await findActiveOccupancyForPage(auth.tenantProfileId, selectedId)
    : null;
  if (!occupancy) {
    return <Empty description="เมื่อเจ้าของหออนุมัติการเข้าพักแล้ว ประกาศจะมาแสดงที่นี่" icon={<Bell />} text="ยังไม่มีข้อมูลการเข้าพัก" />;
  }

  // ประกาศกรองตามอาคาร ชั้น และห้อง จึงต้องรู้ว่าห้องนี้อยู่ตรงไหนก่อน
  const room = await getDatabase().room.findUnique({
    where: { id: occupancy.roomId },
    select: { buildingId: true, floorId: true },
  });
  const result = room
    ? await listTenantAnnouncements(occupancy.propertyId, room.buildingId, room.floorId, occupancy.roomId, { page: 1, pageSize })
    : { data: [], pageInfo: { page: 1, pageSize, hasNextPage: false } };

  if (!result.data.length) {
    return <Empty description="ประกาศจากหอพักจะมาแสดงที่นี่" icon={<Bell />} text="ยังไม่มีประกาศ" />;
  }
  return <div className="grid gap-5">
    {result.data.map((item) => <AnnouncementCard key={item.id} {...item} />)}
    <LoadMoreAnnouncements
      initialCount={result.data.length}
      initialHasNextPage={result.pageInfo.hasNextPage}
      pageSize={pageSize}
    />
  </div>;
}
