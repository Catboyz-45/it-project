// Server Component ที่ตรวจสิทธิ์และดึงข้อมูลตั้งต้นให้ทั้งพื้นที่ผู้เช่า
// อยู่ที่ layout ไม่ใช่ page เพราะ Next คง layout ไว้ตอนเปลี่ยนหน้าลูก
// ข้อมูลร่วมอย่างห้องและยอดแจ้งเตือนจึงโหลดครั้งเดียว ไม่ใช่ทุกครั้งที่กดเมนู
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TenantPortal } from "@/components/tenant/TenantPortal";
import { requirePageAuth } from "@/lib/server/auth";
import { tenantOccupancyCookieName } from "@/lib/server/tenant-auth";
import { getTenantAccount } from "@/lib/server/tenant-portal";

export default async function TenantLayout({ children }: { children: ReactNode }) {
  // ตรวจสิทธิ์บนเซิร์ฟเวอร์ก่อนแตะข้อมูลใด ๆ ไม่เชื่อค่าที่ส่งมาจากฝั่งผู้ใช้
  const auth = await requirePageAuth();
  // ไม่ใช่ผู้เช่าก็ส่งกลับหน้าแรก ให้ระบบพาไปยังพื้นที่ของบทบาทตัวเอง
  if (auth.role !== "TENANT" || !auth.tenantProfileId) redirect("/");

  const profile = await getTenantAccount(auth.tenantProfileId);
  // ผู้เช่าหนึ่งคนอาจมีหลายห้อง คุกกี้จำไว้ว่าดูห้องไหนอยู่
  const selectedId = (await cookies()).get(tenantOccupancyCookieName)?.value;
  // ต้องเช็คสถานะด้วย ไม่ใช่เชื่อคุกกี้อย่างเดียว เพราะห้องนั้นอาจย้ายออกไปแล้ว
  // หาไม่เจอก็ตกไปที่ห้องที่ยังใช้งานอยู่ห้องแรก
  const selected = profile.occupancies.find(({ id, status }) => id === selectedId && status === "ACTIVE")
    ?? profile.occupancies.find(({ status }) => status === "ACTIVE");

  return (
    <TenantPortal initialAccount={profile} initialSelectedOccupancyId={selected?.id ?? null}>
      {children}
    </TenantPortal>
  );
}
