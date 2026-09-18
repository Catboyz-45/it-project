/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นหน้าจอของเส้นทาง /super-admin ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import { Activity, Building2, CreditCard, DoorOpen, ShieldCheck, UsersRound } from "lucide-react";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { getSuperAdminDashboardAggregation } from "@/lib/server/dashboard-aggregation";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Super Admin Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default async function SuperAdminPage() {
  const aggregation = await getSuperAdminDashboardAggregation();

  return <>
    <SuperAdminPageHeader description="ติดตามสุขภาพของแพลตฟอร์ม สมาชิก รายได้ และงานที่ต้องดำเนินการ" title="แดชบอร์ด" />
    <section className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-6">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/[.08] px-2.5 py-1 text-xs font-semibold text-[#4651c7]"><ShieldCheck size={14} /> SUPER ADMIN</span>
      <h2 className="mt-3 max-w-3xl text-2xl font-bold tracking-[-.02em] text-[#292a30]">ภาพรวมทุกหอในแพลตฟอร์ม</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#62646c]">ใช้เมนูด้านซ้ายเพื่อจัดการบัญชี หอพัก แพ็กเกจ การชำระสมาชิก และตรวจสอบ Audit Log</p>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Stat icon={<Building2 />} label="หอที่เปิดใช้งาน" value={aggregation.properties.active} tone="bg-brand/10 text-[#4651c7]" />
      <Stat icon={<UsersRound />} label="แอดมินประจำหอ" value={aggregation.users.PROPERTY_ADMIN ?? 0} tone="bg-pink-50 text-pink-700" />
      <Stat icon={<Activity />} label="MRR" value={`฿${aggregation.revenue.mrr.toLocaleString("th-TH")}`} tone="bg-emerald-50 text-emerald-700" />
      <Stat icon={<CreditCard />} label="สมาชิก Active" value={aggregation.subscriptions.active} tone="bg-brand/10 text-[#4651c7]" />
      <Stat icon={<DoorOpen />} label="Trial" value={aggregation.subscriptions.trial} tone="bg-pink-50 text-pink-700" />
      <Stat icon={<Activity />} label="หมดอายุใน 30 วัน" value={aggregation.subscriptions.expiringWithin30Days} tone="bg-amber-50 text-amber-700" />
    </section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <CompactStat label="ห้องในระบบ" value={aggregation.usage.rooms} />
      <CompactStat label="ผู้เช่าที่ใช้งาน" value={aggregation.usage.activeTenants} />
      <CompactStat label="รายการชำระรอตรวจ" value={aggregation.operations.pendingPayments} />
      <CompactStat label="Ticket ที่ยังเปิด" value={aggregation.operations.openTickets} />
    </section>
  </>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Stat” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { icon, label, tone, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function Stat({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: React.ReactNode }) {
  return <article className="panel flex items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-md [&>svg]:size-4 ${tone}`}>{icon}</span><div><strong className="block text-xl font-semibold text-[#292a30]">{value}</strong><span className="text-sm text-[#62646c]">{label}</span></div></article>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Compact Stat” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { label, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function CompactStat({ label, value }: { label: string; value: number }) {
  return <article className="panel"><span className="text-sm text-[#62646c]">{label}</span><strong className="mt-1.5 block text-xl font-semibold text-[#292a30]">{value.toLocaleString("th-TH")}</strong></article>;
}
