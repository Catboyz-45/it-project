/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นหน้าจอของเส้นทาง /super-admin/subscriptions ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import { SuperAdminForms } from "@/components/admin/SuperAdminForms";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SubscriptionPaymentReview } from "@/components/admin/SubscriptionPaymentReview";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Super Admin Subscriptions Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default function SuperAdminSubscriptionsPage() {
  return <>
    <SuperAdminPageHeader
      description="ตรวจหลักฐานการชำระ เปิดใช้หรือต่ออายุสมาชิก และช่วยแก้สถานะแพ็กเกจเมื่อจำเป็น"
      title="การชำระสมาชิก"
    />
    <SubscriptionPaymentReview />
    <SuperAdminForms sections={["subscription"]} />
  </>;
}
