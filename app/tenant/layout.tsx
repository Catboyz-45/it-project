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

export default async function TenantLayout({ children }: Readonly<{ children: ReactNode }>) {
  // ตรวจสิทธิ์บนเซิร์ฟเวอร์ก่อนแตะข้อมูลใด ๆ ไม่เชื่อค่าที่ส่งมาจากฝั่งผู้ใช้
  const auth = await requirePageAuth();
  // ไม่ใช่ผู้เช่าก็ส่งกลับหน้าแรก ให้ระบบพาไปยังพื้นที่ของบทบาทตัวเอง
  if (auth.role !== "TENANT" || !auth.tenantProfileId) redirect("/");

  const profile = await getTenantAccount(auth.tenantProfileId);
  // ผู้เช่าหนึ่งคนอาจมีหลายห้อง คุกกี้จำไว้ว่าดูห้องไหนอยู่
  const selectedId = (await cookies()).get(tenantOccupancyCookieName)?.value;
  // ต้องเช็คสถานะด้วย ไม่ใช่เชื่อคุกกี้อย่างเดียว เพราะห้องนั้นอาจย้ายออกไปแล้ว
  // หาไม่เจอก็ตกไปที่ห้องที่เข้าพักล่าสุด กติกาเดียวกับ findActiveOccupancyForPage ที่หน้าลูกใช้
  // ถ้าเลือกคนละแบบ แถบข้างจะบอกห้องหนึ่ง แต่เนื้อหาในหน้าเป็นของอีกห้อง
  const active = profile.occupancies.filter(({ status }) => status === "ACTIVE");
  const selected = active.find(({ id }) => id === selectedId)
    ?? active.toSorted((a, b) => startedTime(b.startedAt) - startedTime(a.startedAt))[0];

  return (
    <TenantPortal initialAccount={profile} initialSelectedOccupancyId={selected?.id ?? null}>
      {children}
    </TenantPortal>
  );
}

// ห้องที่ยังไม่มีวันเข้าพักขึ้นก่อน ตรงกับ orderBy startedAt desc ของ PostgreSQL ที่วาง null ไว้หน้าสุด
function startedTime(value: Date | string | null) {
  return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
}
