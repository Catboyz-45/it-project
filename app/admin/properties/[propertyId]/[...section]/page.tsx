import { notFound } from "next/navigation";
import { PropertyWorkspaceRoute } from "@/components/dorm/PropertyWorkspaceRoute";
import { ownerPageFromSegments } from "@/lib/navigation-routes";

// [...section] รับได้ทุกเส้นทางย่อยของหอ ทำให้ทุกหน้าใช้ไฟล์เดียวกัน
export default async function PropertyWorkspaceSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string; section: string[] }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { propertyId, section } = await params;
  const { tab } = await searchParams;
  const activePage = ownerPageFromSegments(section);
  // เส้นทางที่ไม่รู้จักตอบว่าไม่พบ ค่ามาจาก URL ที่ผู้ใช้พิมพ์เองได้
  // ส่วน overview มีไฟล์ของตัวเองที่ระดับบน จึงไม่ควรมาโผล่ที่นี่
  if (!activePage || activePage === "overview") notFound();
  // หน้าบิลรับ ?tab=payments เพื่อเปิดมาที่แท็บตรวจการชำระเลย ใช้กับลิงก์จากการแจ้งเตือน
  const initialInvoiceView = activePage === "invoices" && tab === "payments" ? "payments" : "invoices";
  return <PropertyWorkspaceRoute activePage={activePage} initialInvoiceView={initialInvoiceView} propertyId={propertyId} />;
}
