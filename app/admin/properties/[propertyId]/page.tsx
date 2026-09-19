import { OwnerSectionPanel } from "@/components/dorm/DormDashboard";

// เข้าหอโดยไม่ระบุหน้าย่อย ให้ตกที่ภาพรวมเป็นค่าเริ่มต้น
// เปลือกทั้งหมดอยู่ใน layout หน้านี้จึงเหลือแค่เนื้อของหน้า
export default function PropertyWorkspacePage() {
  return <OwnerSectionPanel page="overview" />;
}
