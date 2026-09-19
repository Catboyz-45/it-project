
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SuperAdminResourceTables } from "@/components/admin/SuperAdminResourceTables";

// หน้าดูบันทึกเหตุการณ์ อ่านอย่างเดียว ตารางกับการแบ่งหน้าอยู่ใน SuperAdminResourceTables
export default function SuperAdminAuditLogsPage() {
  return <>
    <SuperAdminPageHeader
      description="ติดตามเหตุการณ์สำคัญ ผู้ดำเนินการ หอพักที่เกี่ยวข้อง และผลลัพธ์ของคำขอ"
      title="Audit Log"
    />
    <SuperAdminResourceTables resources={["audit-logs"]} />
  </>;
}
