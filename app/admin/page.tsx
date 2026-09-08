/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นหน้าจอของเส้นทาง /admin ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Property Admin Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default async function PropertyAdminPage() {
  const auth = await requirePageAuth();
  if (auth.role === "SUPER_ADMIN") redirect("/super-admin");
  const property = await getDatabase().property.findFirst({
    where: { id: { in: auth.propertyIds }, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (property) redirect(`/admin/properties/${property.id}`);
  return <main><h1>ยังไม่มีหอพักที่ดูแล</h1><p>กรุณาติดต่อแอดมินใหญ่เพื่อมอบหมายหอพักให้บัญชีนี้</p></main>;
}
