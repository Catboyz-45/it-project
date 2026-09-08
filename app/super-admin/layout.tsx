/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโครงหน้าและส่วนที่ใช้ร่วมกันของเส้นทาง /super-admin ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import { redirect } from "next/navigation";
import { SuperAdminNavigation } from "@/components/admin/SuperAdminNavigation";
import { SuperAdminChatWidget } from "@/components/admin/SuperAdminChatWidget";
import { PlatformBrand } from "@/components/ui/PlatformBrand";
import { SidebarAccountMenu } from "@/components/ui/SidebarAccountMenu";
import { requirePageAuth } from "@/lib/server/auth";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Super Admin Layout” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default async function SuperAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await requirePageAuth();
  if (auth.role !== "SUPER_ADMIN") redirect("/admin");

  return <main className="shell super-admin-shell text-[#292a30]">
    <aside className="sidebar super-admin-sidebar">
      <div className="brand mb-5">
        <PlatformBrand className="[&_small]:text-[#73757d] [&_strong]:text-base" context="Control" imageClassName="size-11" showTagline />
      </div>
      <SuperAdminNavigation />
      <SidebarAccountMenu displayName={auth.displayName} email={auth.email} role="SUPER_ADMIN" />
    </aside>
    <section className="workspace super-admin-workspace">
      <div className="super-admin-content mx-auto max-w-[1500px] space-y-6 px-6 py-7">
        {children}
      </div>
    </section>
    <SuperAdminChatWidget />
  </main>;
}
