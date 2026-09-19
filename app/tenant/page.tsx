import { TenantSectionPanel } from "@/components/tenant/TenantPortal";

// /tenant คือหน้าแรกของผู้เช่า เปลือกทั้งหมดอยู่ใน layout หน้านี้จึงเหลือแค่เนื้อของแท็บ
export default function TenantPage() {
  return <TenantSectionPanel tab="home" />;
}
