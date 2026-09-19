import { notFound } from "next/navigation";
import { TenantSectionPanel } from "@/components/tenant/TenantPortal";
import { tenantTabFromSegments } from "@/lib/navigation-routes";

// [...section] รับได้ทุกเส้นทางย่อยของผู้เช่า ทำให้ทุกแท็บใช้ไฟล์เดียวกัน
export default async function TenantSectionPage({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = await params;
  const activeTab = tenantTabFromSegments(section);
  // เส้นทางที่ไม่รู้จักตอบว่าไม่พบ ส่วน home มีไฟล์ของตัวเองที่ระดับบน
  if (!activeTab || activeTab === "home") notFound();
  return <TenantSectionPanel tab={activeTab} />;
}
