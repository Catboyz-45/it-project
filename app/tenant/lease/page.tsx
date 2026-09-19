// หน้าสัญญาเป็น Server Component ทั้งหน้า ข้อมูลมาพร้อม HTML
// ไม่มี useState ไม่มีการยิง API จากเบราว์เซอร์ จึงไม่มีช่วงโหลดให้ต้องเอา skeleton ไปคั่น
import { cookies } from "next/headers";
import { FileText } from "lucide-react";
import { LeaseView } from "@/components/tenant/LeaseView";
import { Empty } from "@/components/tenant/primitives";
import { requirePageAuth } from "@/lib/server/auth";
import { findActiveOccupancyForPage, tenantOccupancyCookieName } from "@/lib/server/tenant-auth";
import { getTenantLease } from "@/lib/server/tenant-portal";

export default async function TenantLeasePage() {
  const auth = await requirePageAuth();
  const selectedId = (await cookies()).get(tenantOccupancyCookieName)?.value;
  const occupancy = auth.tenantProfileId
    ? await findActiveOccupancyForPage(auth.tenantProfileId, selectedId)
    : null;

  // ยังไม่มีห้องที่อนุมัติ ยังไม่มีสัญญาให้ดู
  if (!occupancy || !auth.tenantProfileId) {
    return <Empty description="เมื่อเจ้าของหออนุมัติการเข้าพักแล้ว สัญญาจะมาแสดงที่นี่" icon={<FileText />} text="ยังไม่มีข้อมูลการเข้าพัก" />;
  }
  // สัญญาเป็นเรื่องของผู้เช่าหลัก ผู้พักร่วมไม่ใช่คนเซ็นจึงไม่เห็น
  if (occupancy.role !== "PRIMARY") {
    return <Empty icon={<FileText />} text="เฉพาะผู้เช่าหลักเท่านั้นที่ดูสัญญาได้" />;
  }

  const lease = await getTenantLease(auth.tenantProfileId, occupancy.roomId, occupancy.role);
  return <LeaseView current={lease.current} upcoming={lease.upcoming} />;
}
