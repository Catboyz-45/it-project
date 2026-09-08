/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Tenant Portal Route” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TenantPortal } from "@/components/tenant/TenantPortal";
import type { TenantTab } from "@/lib/navigation-routes";
import { requirePageAuth } from "@/lib/server/auth";
import { tenantOccupancyCookieName } from "@/lib/server/tenant-auth";
import { getTenantAccount } from "@/lib/server/tenant-portal";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tenant Portal Route” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { activeTab }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export async function TenantPortalRoute({ activeTab }: { activeTab: TenantTab }) {
  const auth = await requirePageAuth();
  if (auth.role !== "TENANT" || !auth.tenantProfileId) redirect("/");

  const profile = await getTenantAccount(auth.tenantProfileId);
  const selectedId = (await cookies()).get(tenantOccupancyCookieName)?.value;
  const selected = profile.occupancies.find(({ id, status }) => id === selectedId && status === "ACTIVE")
    ?? profile.occupancies.find(({ status }) => status === "ACTIVE");

  return (
    <TenantPortal
      activeTab={activeTab}
      initialAccount={profile}
      initialSelectedOccupancyId={selected?.id ?? null}
    />
  );
}
