
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SuperAdminResourceTables } from "@/components/admin/SuperAdminResourceTables";

// หน้าจัดการแพ็กเกจ ส่งชื่อ resource เข้าไปตัวเดียว ตารางที่เหลือใช้ร่วมกับหน้าอื่น
export default function SuperAdminPlansPage() {
  return <>
    <SuperAdminPageHeader
      description="ตรวจสอบราคา ขีดจำกัดห้อง สถานะการขาย และจำนวนสมาชิกของแต่ละแพ็กเกจ"
      title="แพ็กเกจ SaaS"
    />
    <SuperAdminResourceTables resources={["plans"]} />
  </>;
}
