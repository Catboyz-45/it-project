// Server Component ที่ตรวจสิทธิ์และดึงข้อมูลตั้งต้น ก่อนส่งให้หน้าจอฝั่งเบราว์เซอร์
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TenantPortal } from "@/components/tenant/TenantPortal";
import type { TenantTab } from "@/lib/navigation-routes";
import { requirePageAuth } from "@/lib/server/auth";
import { tenantOccupancyCookieName } from "@/lib/server/tenant-auth";
import { getTenantAccount } from "@/lib/server/tenant-portal";

export async function TenantPortalRoute({ activeTab }: { activeTab: TenantTab }) {
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
    <TenantPortal
      activeTab={activeTab}
      initialAccount={profile}
      initialSelectedOccupancyId={selected?.id ?? null}
    />
  );
}
