
import { TenantPortalRoute } from "@/components/tenant/TenantPortalRoute";

// /tenant คือหน้าแรกของผู้เช่า ตัวจริงอยู่ใน TenantPortalRoute ไฟล์นี้แค่บอกว่าให้เปิดแท็บไหน
export default async function TenantPage() {
  return <TenantPortalRoute activeTab="home" />;
}
