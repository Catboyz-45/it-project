
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SuperAdminResourceTables } from "@/components/admin/SuperAdminResourceTables";
import { initialAuditLogsTable } from "@/lib/server/super-admin-initial";

// หน้าดูบันทึกเหตุการณ์ อ่านอย่างเดียว ตารางกับการแบ่งหน้าอยู่ใน SuperAdminResourceTables
export default async function SuperAdminAuditLogsPage() {
  // layout ตรวจบทบาทไปแล้ว ตรงนี้ดึงตารางหน้าแรกให้มาพร้อม HTML
  const initialTable = await initialAuditLogsTable();
  return <>
    <SuperAdminPageHeader
      description="ติดตามเหตุการณ์สำคัญ ผู้ดำเนินการ หอพักที่เกี่ยวข้อง และผลลัพธ์ของคำขอ"
      title="Audit Log"
    />
    <SuperAdminResourceTables initialTables={{ "audit-logs": initialTable }} resources={["audit-logs"]} />
  </>;
}
