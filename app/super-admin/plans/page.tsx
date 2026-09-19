
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SuperAdminResourceTables } from "@/components/admin/SuperAdminResourceTables";
import { initialPlansTable } from "@/lib/server/super-admin-initial";

// หน้าจัดการแพ็กเกจ ส่งชื่อ resource เข้าไปตัวเดียว ตารางที่เหลือใช้ร่วมกับหน้าอื่น
export default async function SuperAdminPlansPage() {
  // layout ตรวจบทบาทไปแล้ว ตรงนี้ดึงตารางหน้าแรกให้มาพร้อม HTML
  const initialTable = await initialPlansTable();
  return <>
    <SuperAdminPageHeader
      description="ตรวจสอบราคา ขีดจำกัดห้อง สถานะการขาย และจำนวนสมาชิกของแต่ละแพ็กเกจ"
      title="แพ็กเกจ SaaS"
    />
    <SuperAdminResourceTables initialTables={{ "plans": initialTable }} resources={["plans"]} />
  </>;
}
